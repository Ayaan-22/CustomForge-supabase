import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createStripeRecovery, findStripeSessions} from '../../utils/stripeRecovery.js';

const now = Date.parse('2026-10-08T12:00:00Z');
let order, attempt, session, intent, db, stripe, logger, settle, recovery;
beforeEach(()=>{
  order={id:'order',user_id:'owner',payment_method:'stripe',status:'pending',is_paid:false,total_price:20,created_at:'2026-10-08T09:00:00Z'};
  attempt={order_id:'order',attempt_id:'attempt',customer_id:'cus_owner',amount_cents:2000,session_id:'cs_order',legacy:false,created_at:'2026-10-08T09:30:00Z',expires_at:'2026-10-08T10:30:00Z'};
  session={id:'cs_order',mode:'payment',metadata:{orderId:'order',userId:'owner',attemptId:'attempt'},customer:'cus_owner',currency:'usd',amount_total:2000,status:'expired',payment_status:'unpaid',payment_intent:null};
  intent={id:'pi_order',status:'canceled',metadata:session.metadata,customer:'cus_owner',currency:'usd',amount:2000,amount_received:0};
  db={from:vi.fn(()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:attempt,error:null})};return q;}),rpc:vi.fn().mockResolvedValue({data:{released:true},error:null})};
  stripe={customers:{retrieve:vi.fn().mockResolvedValue({id:'cus_owner',metadata:{userId:'owner'}})},checkout:{sessions:{retrieve:vi.fn(async()=>session),list:vi.fn().mockResolvedValue({data:[],has_more:false}),expire:vi.fn(async()=>session)}},paymentIntents:{retrieve:vi.fn(async()=>intent)}};
  logger={info:vi.fn(),error:vi.fn()};settle=vi.fn().mockResolvedValue({paid:true});
  recovery=createStripeRecovery({stripe,db,logger,settle,now:()=>now});
});

describe('provider-confirmed inventory recovery',()=>{
  it('releases expired unpaid sessions with durable attempt identity',async()=>{
    await recovery.recoverOrder(order,{sessionId:'cs_order'});
    expect(db.rpc).toHaveBeenCalledWith('release_stripe_reservation',expect.objectContaining({p_order_id:'order',p_attempt_id:'attempt',p_session_id:'cs_order',p_reason:'session_expired'}));
  });
  it('ignores stale expiry for an older session',async()=>{
    expect(await recovery.recoverOrder(order,{sessionId:'cs_old'})).toEqual({stale:true});expect(db.rpc).not.toHaveBeenCalled();
  });
  it('preserves inventory when delayed expiry loses to provider settlement',async()=>{
    session.status='complete';session.payment_status='paid';session.payment_intent='pi_order';intent.status='succeeded';intent.amount_received=2000;
    await recovery.recoverOrder(order,{sessionId:'cs_order'});
    expect(settle).toHaveBeenCalledWith(intent,expect.objectContaining({session,attempt,order}));expect(db.rpc).not.toHaveBeenCalled();
  });
  it('preserves inventory for a completed payment still processing',async()=>{
    session.status='complete';session.payment_intent='pi_order';intent.status='processing';
    expect(await recovery.recoverOrder(order)).toEqual({pending:true});expect(db.rpc).not.toHaveBeenCalled();
  });
  it('keeps a failed card retryable while its session remains open',async()=>{
    session.status='open';session.payment_intent='pi_order';intent.status='requires_payment_method';attempt.expires_at='2026-10-08T12:30:00Z';order.payment_expires_at=attempt.expires_at;
    await recovery.recoverOrder(order);expect(db.rpc).not.toHaveBeenCalled();expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });
  it('verifies definitively canceled intents before releasing an expired session',async()=>{
    session.payment_intent='pi_order';await recovery.recoverOrder(order,{canceledIntent:intent});
    expect(db.rpc).toHaveBeenCalledWith('release_stripe_reservation',expect.objectContaining({p_intent_id:'pi_order',p_reason:'intent_cancelled'}));
  });
  it('ignores a canceled intent belonging to a previous payment',async()=>{
    session.payment_intent='pi_new';await recovery.recoverOrder(order,{canceledIntent:intent});expect(db.rpc).not.toHaveBeenCalled();
  });
  it('does not release based on an old cancellation event if provider state changed',async()=>{
    session.payment_intent='pi_order';stripe.paymentIntents.retrieve.mockResolvedValue({...intent,status:'processing'});
    await recovery.recoverOrder(order,{canceledIntent:intent});expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([{customer:'cus_other'},{currency:'eur'},{amount:1},{metadata:{orderId:'other',userId:'owner',attemptId:'attempt'}}])(
    'fails closed if current provider intent no longer matches its reservation: %s',async conflict=>{
      session.payment_intent='pi_order';stripe.paymentIntents.retrieve.mockResolvedValue({...intent,...conflict});
      await expect(recovery.recoverOrder(order,{canceledIntent:intent})).rejects.toThrow('does not match its reservation');
      expect(db.rpc).not.toHaveBeenCalled();
    });
  it('rechecks after expiration loses a race to checkout completion',async()=>{
    session.status='open';session.payment_intent='pi_order';intent.status='requires_payment_method';
    stripe.checkout.sessions.expire.mockRejectedValue({type:'StripeInvalidRequestError'});
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce(session).mockResolvedValue({...session,status:'complete',payment_status:'paid'});
    stripe.paymentIntents.retrieve.mockResolvedValueOnce(intent).mockResolvedValue({...intent,status:'succeeded',amount_received:2000});
    await recovery.recoverOrder(order);expect(settle).toHaveBeenCalledOnce();expect(db.rpc).not.toHaveBeenCalled();
  });
  it('fails closed when provider retrieval is unavailable',async()=>{
    stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('provider outage'));
    await expect(recovery.recoverOrder(order)).rejects.toThrow('provider outage');expect(db.rpc).not.toHaveBeenCalled();
  });
  it('preserves a paid or already released order without contacting the provider',async()=>{
    order.is_paid=true;await recovery.recoverOrder(order);order.is_paid=false;order.inventory_released_at='2026-10-08T10:00:00Z';await recovery.recoverOrder(order);
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('bounded unstarted and ambiguous creation recovery',()=>{
  it('releases an old order with no durable attempt through the fenced RPC',async()=>{
    attempt=null;await recovery.recoverOrder(order);
    expect(db.rpc).toHaveBeenCalledWith('release_stripe_reservation',expect.objectContaining({p_attempt_id:null,p_reason:'not_started'}));
  });
  it('does not release a fresh order before the two-hour reservation deadline',async()=>{
    attempt=null;order.created_at='2026-10-08T11:30:00Z';await recovery.recoverOrder(order);expect(db.rpc).not.toHaveBeenCalled();
  });
  it('discovers orphaned sessions instead of assuming create failed',async()=>{
    attempt.session_id=null;stripe.checkout.sessions.list.mockResolvedValue({data:[session],has_more:false});
    await recovery.recoverOrder(order);expect(db.rpc.mock.calls[0][1]).toMatchObject({p_session_id:'cs_order',p_reason:'session_expired'});
  });
  it('releases confirmed absent attempts after fixed expiry and creation grace',async()=>{
    attempt.session_id=null;await recovery.recoverOrder(order);
    expect(db.rpc.mock.calls[0][1]).toMatchObject({p_session_id:null,p_reason:'abandoned_attempt'});
  });
  it('holds creation attempts throughout the extra reconciliation grace',async()=>{
    attempt.session_id=null;attempt.expires_at='2026-10-08T11:57:00Z';await recovery.recoverOrder(order);expect(db.rpc).not.toHaveBeenCalled();
  });
  it('keeps multiple legacy sessions reserved for explicit reconciliation',async()=>{
    attempt.session_id=null;attempt.legacy=true;
    stripe.checkout.sessions.list.mockResolvedValue({data:[session,{...session,id:'cs_other'}],has_more:false});
    await expect(recovery.recoverOrder(order)).rejects.toThrow('Multiple payment sessions');expect(db.rpc).not.toHaveBeenCalled();
  });
  it('cancels an abandoned legacy order only after a complete account-wide provider scan',async()=>{
    attempt.session_id=null;attempt.customer_id=null;attempt.legacy=true;
    await recovery.recoverOrder(order);
    expect(stripe.checkout.sessions.list.mock.calls[0][0]).not.toHaveProperty('customer');
    expect(db.rpc).toHaveBeenCalledWith('release_stripe_reservation',expect.objectContaining({p_reason:'abandoned_attempt'}));
  });
  it('discovers and binds a legacy paid session before settling it',async()=>{
    attempt.session_id=null;attempt.customer_id=null;attempt.legacy=true;
    session.status='complete';session.payment_status='paid';session.payment_intent='pi_order';intent.status='succeeded';intent.amount_received=2000;
    stripe.checkout.sessions.list.mockResolvedValue({data:[session],has_more:false});
    db.rpc.mockImplementation(async name => ({data:name==='reconcile_legacy_stripe_checkout'
      ? {...attempt,customer_id:'cus_owner',session_id:'cs_order',intent_id:'pi_order'} : {released:true},error:null}));
    await recovery.recoverOrder(order);
    expect(settle).toHaveBeenCalledOnce();
    expect(db.rpc.mock.calls.map(call=>call[0])).toEqual(['reconcile_legacy_stripe_checkout']);
  });
  it('does not release a legacy order if its provider scan is incomplete or unavailable',async()=>{
    attempt.session_id=null;attempt.customer_id=null;attempt.legacy=true;
    stripe.checkout.sessions.list.mockRejectedValue(new Error('offline'));
    await expect(recovery.recoverOrder(order)).rejects.toThrow('offline');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects a discovered legacy session belonging to another owner',async()=>{
    attempt.session_id=null;attempt.customer_id=null;attempt.legacy=true;
    stripe.checkout.sessions.list.mockResolvedValue({data:[{...session,metadata:{...session.metadata,userId:'other'}}],has_more:false});
    await expect(recovery.recoverOrder(order)).rejects.toThrow('does not match its reservation');expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects a discovered customer whose provider metadata belongs to another owner',async()=>{
    attempt.session_id=null;attempt.customer_id=null;attempt.legacy=true;
    stripe.checkout.sessions.list.mockResolvedValue({data:[session],has_more:false});
    stripe.customers.retrieve.mockResolvedValue({id:'cus_owner',metadata:{userId:'other'}});
    await expect(recovery.recoverOrder(order)).rejects.toThrow('does not match order owner');expect(db.rpc).not.toHaveBeenCalled();
  });
  it('never infers an unbound intent is unpaid from an empty Checkout session list',async()=>{
    attempt.session_id=null;attempt.intent_id='pi_unbound';
    await expect(recovery.recoverOrder(order)).rejects.toThrow('intent requires reconciliation');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('expires an open session at the order deadline even if its provider expiry is later',async()=>{
    order.payment_expires_at='2026-10-08T11:59:00Z';attempt.expires_at='2026-10-08T15:00:00Z';session.status='open';
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({...session}).mockResolvedValue({...session,status:'expired'});
    await recovery.recoverOrder(order);
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_order');
    expect(db.rpc).toHaveBeenCalledWith('release_stripe_reservation',expect.objectContaining({p_reason:'session_expired'}));
  });
  it('releases an unstarted order exactly at its persisted deadline, independently of creation time',async()=>{
    attempt=null;order.created_at='2026-10-08T11:59:00Z';order.payment_expires_at=new Date(now).toISOString();
    await recovery.recoverOrder(order);expect(db.rpc).toHaveBeenCalledOnce();
  });
  it('keeps a reservation throughout the persisted payment window',async()=>{
    attempt=null;order.payment_expires_at=new Date(now+1).toISOString();
    await recovery.recoverOrder(order);expect(db.rpc).not.toHaveBeenCalled();
  });
  it('exhausts provider pagination before interpreting no sessions',async()=>{
    attempt.session_id=null;
    stripe.checkout.sessions.list.mockResolvedValueOnce({data:[{id:'cs_unrelated',metadata:{orderId:'other'}}],has_more:true}).mockResolvedValueOnce({data:[session],has_more:false});
    await recovery.recoverOrder(order);expect(stripe.checkout.sessions.list.mock.calls[1][0].starting_after).toBe('cs_unrelated');
    expect(db.rpc.mock.calls[0][1].p_session_id).toBe('cs_order');
  });
  it('never releases after a truncated provider scan',async()=>{
    attempt.session_id=null;stripe.checkout.sessions.list.mockResolvedValue({data:[{id:'cs_unrelated',metadata:{orderId:'other'}}],has_more:true});
    await expect(recovery.recoverOrder(order)).rejects.toThrow('manual reconciliation');expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects an orphaned session whose amount differs from reserved stock',async()=>{
    attempt.session_id=null;stripe.checkout.sessions.list.mockResolvedValue({data:[{...session,amount_total:1}],has_more:false});
    await expect(findStripeSessions(stripe,order,attempt)).rejects.toThrow('does not match');expect(db.rpc).not.toHaveBeenCalled();
  });
});

it('worker shutdown waits for the active scan and stops scheduling more work',async()=>{
  vi.useFakeTimers();
  let finishScan;
  const scan = new Promise(resolve => { finishScan = resolve; });
  const scanned=vi.fn().mockReturnValue(scan);
  db.from=()=>{const q={select:()=>q,eq:()=>q,is:()=>q,in:()=>q,lte:()=>q,order:()=>q,limit:scanned};return q;};
  const stop=recovery.start();
  const drained=vi.fn();const stopping=stop().then(drained);
  await Promise.resolve();expect(drained).not.toHaveBeenCalled();
  finishScan({data:[],error:null});await stopping;
  await vi.advanceTimersByTimeAsync(120000);expect(scanned).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
