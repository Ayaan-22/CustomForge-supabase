import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({order:null,attempt:null,operations:[],writeError:null,claimError:null,create:vi.fn(),retrieve:vi.fn(),list:vi.fn(),customer:vi.fn()}));
vi.mock('stripe',()=>({default:class {
  customers={retrieve:state.customer};
  checkout={sessions:{create:state.create,retrieve:state.retrieve,list:state.list}};
}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../config/db.js',()=>{
  const db={
    from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='orders'?state.order:{id:'user',stripe_customer_id:'cus_existing'},error:null})};return q;},
    rpc:async(name,args)=>{
      state.operations.push({name,args});
      return name==='claim_stripe_checkout' ? {data:state.attempt,error:state.claimError}
        : {data:state.writeError?null:{id:state.order.id},error:state.writeError};
    },
  };
  return {getServiceClient:()=>db,getSupabaseClient:()=>db};
});
import {createStripeSession} from '../../controllers/paymentController.js';
const id='10000000-0000-4000-8000-000000000001';
const attemptId='30000000-0000-4000-8000-000000000001';
const run=()=>new Promise((resolve,reject)=>createStripeSession({body:{orderId:id},user:{id:'user',role:'user'}},{json:resolve,status(){return this;}},reject));
const session=(extra={})=>({id:'cs_new',mode:'payment',metadata:{orderId:id,userId:'user',attemptId},amount_total:2500,currency:'usd',customer:'cus_existing',status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/session',...extra});
beforeEach(()=>{
  process.env.CLIENT_URL='http://localhost:3100';
  state.customer.mockReset().mockResolvedValue({id:'cus_existing',metadata:{userId:'user'}});
  state.order={id,user_id:'user',status:'pending',total_price:25,is_paid:false,payment_method:'stripe'};
  state.attempt={order_id:id,attempt_id:attemptId,customer_id:'cus_existing',amount_cents:2500,
    redirect_origin:'http://localhost:3100',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),legacy:false};
  state.operations=[];state.writeError=null;state.claimError=null;
  state.create.mockReset().mockResolvedValue(session());state.retrieve.mockReset();state.list.mockReset().mockResolvedValue({data:[],has_more:false});
});

describe('durable Stripe checkout attempt',()=>{
  it('rejects payment after the order deadline before creating or inspecting provider resources',async()=>{
    state.order.payment_expires_at=new Date(Date.now()-1).toISOString();
    await expect(run()).rejects.toMatchObject({statusCode:409});
    expect(state.customer).not.toHaveBeenCalled();expect(state.create).not.toHaveBeenCalled();expect(state.operations).toEqual([]);
  });
  it('claims before provider creation and binds the same immutable attempt',async()=>{
    await run();
    const [body,options]=state.create.mock.calls[0];
    expect(state.operations.map(({name})=>name)).toEqual(['claim_stripe_checkout','bind_stripe_checkout']);
    expect(body.payment_intent_data.metadata).toEqual({orderId:id,userId:'user',attemptId});
    expect(body.metadata).toEqual(body.payment_intent_data.metadata);
    expect(body.expires_at).toBe(Math.floor(new Date(state.attempt.expires_at).getTime()/1000));
    expect(options.idempotencyKey).toBe('checkout-'+attemptId);
    expect(state.operations[1].args).toMatchObject({p_attempt_id:attemptId,p_session_id:'cs_new',p_customer_id:'cus_existing'});
  });
  it('reuses a bound open session without creating another payable session',async()=>{
    state.attempt.session_id='cs_open';state.retrieve.mockResolvedValue(session({id:'cs_open'}));
    expect((await run()).sessionId).toBe('cs_open');expect(state.create).not.toHaveBeenCalled();
  });
  it('recovers an orphaned creation response and binds it without another create',async()=>{
    state.list.mockResolvedValue({data:[session()],has_more:false});
    await run();expect(state.create).not.toHaveBeenCalled();
    expect(state.operations.at(-1).name).toBe('bind_stripe_checkout');
  });
  it('holds a completed session for settlement instead of offering another payment',async()=>{
    state.attempt.session_id='cs_done';state.retrieve.mockResolvedValue(session({id:'cs_done',status:'complete',url:null}));
    await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('does not start a new generation for an expired reservation',async()=>{
    state.attempt.session_id='cs_expired';state.retrieve.mockResolvedValue(session({id:'cs_expired',status:'expired',url:null}));
    await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('keeps retry parameters stable if redirect configuration changes',async()=>{
    process.env.CLIENT_URL='https://new.example.com';await run();
    expect(state.create.mock.calls[0][0].success_url).toBe(`http://localhost:3100/orders/${id}?success=true`);
  });
  it('refuses new provider creation too close to its fixed expiry',async()=>{
    state.attempt.expires_at=new Date(Date.now()+30*60000).toISOString();
    await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('does not guess that an unbound legacy order never had a payment session',async()=>{
    state.attempt.legacy=true;await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('fails before Stripe creation if the reservation claim loses to expiration',async()=>{
    state.claimError={code:'P0001'};await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('reports failed session binding without handing out an unbound URL',async()=>{
    state.writeError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503});
  });
});

describe('Stripe input and account boundaries',()=>{
  it('checks ownership before talking to Stripe',async()=>{
    state.order.user_id='someone-else';await expect(run()).rejects.toMatchObject({statusCode:403});expect(state.create).not.toHaveBeenCalled();
  });
  it('rejects another customer provider account',async()=>{
    state.customer.mockResolvedValue({metadata:{userId:'other'}});await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('rejects insecure public redirects',async()=>{
    process.env.CLIENT_URL='http://example.com';await expect(run()).rejects.toMatchObject({statusCode:503});
  });
  it('rejects a session associated with another attempt',async()=>{
    state.attempt.session_id='cs_open';state.retrieve.mockResolvedValue(session({id:'cs_open',metadata:{orderId:id,userId:'user',attemptId:'other'}}));
    await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled();
  });
  it('rejects switching a COD order to Stripe',async()=>{
    state.order.payment_method='cod';await expect(run()).rejects.toMatchObject({statusCode:409});
  });
  it.each([0,-1,10000.01,NaN])('rejects invalid amount %s',async amount=>{
    state.order.total_price=amount;await expect(run()).rejects.toMatchObject({statusCode:400});expect(state.create).not.toHaveBeenCalled();
  });
});
