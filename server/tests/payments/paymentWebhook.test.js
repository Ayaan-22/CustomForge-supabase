import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({event:null,order:null,attempt:null,lookupError:null,updateError:null,noWrite:false,updates:[],rpcs:[],construct:vi.fn(),session:vi.fn(),intent:vi.fn()}));
vi.mock('stripe',()=>({default:class {
  webhooks={constructEvent:()=>{state.construct();return state.event;}};
  checkout={sessions:{retrieve:state.session}};
  paymentIntents={retrieve:state.intent};
}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../config/db.js',()=>{
  const db={
    from:table=>{let writing=false;const q={select:()=>q,eq:()=>q,
      maybeSingle:async()=>({data:writing?(state.updateError||state.noWrite?null:{id:state.order.id}):table==='orders'?state.order:state.attempt,error:writing?state.updateError:state.lookupError}),
      update:data=>{writing=true;state.updates.push(data);return q;}};return q;},
    rpc:async(name,args)=>{state.rpcs.push({name,args});return {data:state.noWrite?null:{paid:true,reconciliationRequired:!!state.order.inventory_released_at},error:state.updateError};},
  };
  return {getServiceClient:()=>db,getSupabaseClient:()=>db};
});
import {handleWebhook} from '../../controllers/paymentController.js';
const run=()=>new Promise((resolve,reject)=>handleWebhook({headers:{'stripe-signature':'signed'},body:Buffer.from('{}'),ip:'127.0.0.1'}, {json:resolve,status(){return this;}},reject));
beforeEach(()=>{
  state.updates=[];state.rpcs=[];state.noWrite=false;state.lookupError=null;state.updateError=null;state.construct.mockClear();
  state.order={id:'order',status:'pending',is_paid:false,total_price:10,user_id:'user',payment_method:'stripe',updated_at:'2026-10-04T00:00:00Z',payment_result:{stripeCustomerId:'cus_user',transaction_id:'pi'}};
  state.attempt={order_id:'order',attempt_id:'attempt',session_id:'cs_order',customer_id:'cus_user',amount_cents:1000,legacy:false};
  state.event={id:'event',created:1,type:'payment_intent.succeeded',data:{object:{id:'pi',status:'succeeded',currency:'usd',metadata:{orderId:'order',userId:'user',attemptId:'attempt'},customer:'cus_user',payment_intent:'pi',amount:1000,amount_received:1000}}};
  state.session.mockReset().mockResolvedValue({id:'cs_order',mode:'payment',status:'complete',payment_status:'paid',metadata:{orderId:'order',userId:'user',attemptId:'attempt'},currency:'usd',amount_total:1000,customer:'cus_user',payment_intent:'pi'});
  state.intent.mockReset();
});
describe('authoritative Stripe webhook settlement',()=>{
  it('accepts freshly signed old-event retries and uses transactional settlement',async()=>{
    expect(await run()).toEqual({received:true});expect(state.construct).toHaveBeenCalledOnce();
    expect(state.rpcs[0]).toMatchObject({name:'settle_stripe_order',args:{p_attempt_id:'attempt',p_session_id:'cs_order',p_intent_id:'pi',p_amount_cents:1000}});
  });
  it('returns retryable failure for database lookup errors',async()=>{state.lookupError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503});});
  it('does not acknowledge failed transactional settlement',async()=>{state.updateError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503});});
  it('does not settle an already recorded payment twice',async()=>{state.order.is_paid=true;await run();expect(state.rpcs).toHaveLength(0);});
  it('rejects currency mismatch before writing',async()=>{state.event.data.object.currency='eur';await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.rpcs).toHaveLength(0);});
  it('does not mark partial refunds as fully refunded',async()=>{state.event.type='charge.refunded';state.event.data.object.amount_refunded=100;state.order.status='paid';state.order.is_paid=true;await run();expect(state.updates[0]).toMatchObject({status:'paid',payment_result:{refund:{amount:1}}});});
  it('records late captured payments for review through the transactional RPC',async()=>{
    state.order.inventory_released_at='2026-10-07T00:00:00Z';state.order.status='cancelled';
    expect(await run()).toEqual({received:true});expect(state.rpcs[0].name).toBe('settle_stripe_order');expect(state.updates).toHaveLength(0);
  });
  it('does not restock merely retryable payment failures',async()=>{state.event.type='payment_intent.payment_failed';await run();expect(state.rpcs).toHaveLength(0);});
  it('handles session expiry using current provider state',async()=>{
    state.event.type='checkout.session.expired';state.event.data.object.id='cs_order';
    state.session.mockResolvedValue({id:'cs_order',mode:'payment',status:'expired',payment_status:'unpaid',metadata:{orderId:'order',userId:'user',attemptId:'attempt'},currency:'usd',amount_total:1000,customer:'cus_user',payment_intent:null});
    await run();expect(state.rpcs[0]).toMatchObject({name:'release_stripe_reservation',args:{p_reason:'session_expired',p_session_id:'cs_order'}});
  });
});
describe('payment identity consistency',()=>{
  it('rejects one-cent underpayments',async()=>{state.event.data.object.amount_received=999;await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.rpcs).toHaveLength(0);});
  it('rejects second payments for an already settled order',async()=>{state.order.is_paid=true;state.event.data.object.id='pi_other';await expect(run()).rejects.toMatchObject({statusCode:503});});
  it('rejects mismatched customer metadata',async()=>{state.event.data.object.customer='cus_other';await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.rpcs).toHaveLength(0);});
  it('rejects mismatched PaymentIntent/session identity',async()=>{state.event.data.object.id='pi_other';await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.rpcs).toHaveLength(0);});
  it('rejects refunds for a different payment',async()=>{state.order.is_paid=true;state.event.type='charge.refunded';state.event.data.object.payment_intent='pi_other';state.event.data.object.amount_refunded=100;await expect(run()).rejects.toMatchObject({statusCode:503});});
  it('preserves cumulative refunds on out-of-order delivery',async()=>{state.order.is_paid=true;state.order.payment_result.refund={amount:5};state.event.type='charge.refunded';state.event.data.object.amount_refunded=100;await run();expect(state.updates).toHaveLength(0);});
  it('retries an unconfirmed database transaction',async()=>{state.noWrite=true;await expect(run()).rejects.toMatchObject({statusCode:503});});
});
