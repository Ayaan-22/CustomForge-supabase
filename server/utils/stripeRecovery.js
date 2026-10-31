import AppError from './appError.js';

export const STRIPE_RESERVATION_MS = 2 * 60 * 60 * 1000;
const CREATION_GRACE_MS = 5 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

export const providerId = (value) => typeof value === 'string' ? value : value?.id || null;
export const paymentDeadline = order => order.payment_expires_at
  ? new Date(order.payment_expires_at).getTime()
  : new Date(order.created_at).getTime() + STRIPE_RESERVATION_MS;

export function verifyStripeSession(session, order, attempt) {
  if (!session || session.mode !== 'payment'
    || session.metadata?.orderId !== String(order.id)
    || session.metadata?.userId !== String(order.user_id)
    || (!attempt.legacy && session.metadata?.attemptId !== String(attempt.attempt_id))
    || (attempt.session_id && session.id !== attempt.session_id)
    || providerId(session.customer) !== attempt.customer_id
    || session.currency !== 'usd' || session.amount_total !== Number(attempt.amount_cents)
    || session.amount_total !== Math.round(Number(order.total_price) * 100)) {
    throw new AppError('Payment session does not match its reservation', 409);
  }
  return session;
}

export function verifyStripeIntent(intent, order, attempt) {
  if (!intent || intent.metadata?.orderId !== String(order.id)
    || intent.metadata?.userId !== String(order.user_id)
    || (!attempt.legacy && intent.metadata?.attemptId !== String(attempt.attempt_id))
    || (attempt.intent_id && intent.id !== attempt.intent_id)
    || providerId(intent.customer) !== attempt.customer_id
    || intent.currency !== 'usd' || intent.amount !== Number(attempt.amount_cents)) {
    throw new AppError('Payment intent does not match its reservation',409);
  }
  return intent;
}

export async function loadStripeAttempt(db, orderId) {
  const {data, error} = await db.from('stripe_checkout_attempts').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw new AppError('Unable to load payment reservation', 503);
  return data;
}

// Discovery is required after an ambiguous provider-create/DB-bind response.
// Exhaust pagination before interpreting "no session"; a capped scan fails closed.
export async function findStripeSessions(stripe, order, attempt, intentId = null, { discoverLegacy = false } = {}) {
  const unboundLegacy = discoverLegacy && attempt.legacy;
  const verify = session => verifyStripeSession(session, order,
    unboundLegacy && !attempt.customer_id ? {...attempt, customer_id:providerId(session.customer)} : attempt);
  if (attempt.session_id) {
    const session = await stripe.checkout.sessions.retrieve(attempt.session_id);
    return [verify(session)];
  }
  if (!attempt.customer_id && !unboundLegacy) {
    throw new AppError('Payment customer requires reconciliation', 409);
  }
  const sessions = [];
  let startingAfter;
  for (let page = 0; page < 10; page++) {
    const result = await stripe.checkout.sessions.list({
      // Legacy customer snapshots can be missing or have changed. Exhaust the
      // account's date-filtered sessions and verify order/owner/amount metadata.
      ...(!unboundLegacy ? {customer:attempt.customer_id} : {}),
      ...(intentId ? {payment_intent: intentId} : {created:{gte:Math.floor(new Date(attempt.created_at).getTime() / 1000) - 60}}),
      limit:100, ...(startingAfter ? {starting_after:startingAfter} : {}),
    });
    for (const session of result.data) {
      if (session.metadata?.orderId === String(order.id)) sessions.push(verify(session));
    }
    if (!result.has_more) return sessions;
    startingAfter = result.data.at(-1)?.id;
    if (!startingAfter) throw new AppError('Incomplete provider session scan', 503);
  }
  throw new AppError('Provider session scan requires manual reconciliation', 503);
}

async function release(db, order, attempt, session, intent, reason) {
  const {data, error} = await db.rpc('release_stripe_reservation', {
    p_order_id:order.id, p_attempt_id:attempt?.attempt_id || null,
    p_session_id:session?.id || null, p_intent_id:providerId(intent), p_reason:reason,
  });
  if (error || !data) throw new AppError('Inventory recovery could not be confirmed', 503);
  return data;
}

export function createStripeRecovery({stripe, db, logger, settle, now = () => Date.now()}) {
  async function recoverOrder(order, {sessionId = null, canceledIntent = null} = {}) {
    if (order.payment_method !== 'stripe' || order.is_paid || order.inventory_released_at) return {skipped:true};
    let attempt = await loadStripeAttempt(db, order.id);
    if (!attempt) {
      if (sessionId || canceledIntent) throw new AppError('Missing provider reservation requires reconciliation', 503);
      if (!Number.isFinite(paymentDeadline(order))) throw new AppError('Payment deadline is unavailable',503);
      if (paymentDeadline(order) > now()) return {pending:true};
      return release(db, order, null, null, null, 'not_started');
    }
    if (sessionId && attempt.session_id && sessionId !== attempt.session_id) return {stale:true};
    if (canceledIntent && (canceledIntent.metadata?.userId !== String(order.user_id)
      || (!attempt.legacy && canceledIntent.metadata?.attemptId !== String(attempt.attempt_id)))) return {stale:true};

    const sessions = await findStripeSessions(stripe, order, attempt, canceledIntent?.id || attempt.intent_id,
      {discoverLegacy:true});
    if (sessions.length > 1) throw new AppError('Multiple payment sessions require reconciliation', 409);
    if (!sessions.length) {
      if (sessionId || canceledIntent) throw new AppError('Provider session could not be reconciled', 503);
      // An intent without a Checkout Session might still be payable. It needs
      // explicit reconciliation, never an inference from an empty session list.
      if (attempt.intent_id) throw new AppError('Unbound payment intent requires reconciliation',409);
      if (new Date(attempt.expires_at).getTime() > now() - CREATION_GRACE_MS) return {pending:true};
      return release(db, order, attempt, null, null, 'abandoned_attempt');
    }

    let session = sessions[0];
    if (sessionId && session.id !== sessionId) return {stale:true};
    const intentId = providerId(session.payment_intent);
    if (attempt.legacy && !attempt.customer_id) {
      const customerId = providerId(session.customer);
      if (!customerId) throw new AppError('Payment customer requires reconciliation',409);
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || customer.metadata?.userId !== String(order.user_id)) {
        throw new AppError('Payment customer does not match order owner',409);
      }
      const {data:bound,error} = await db.rpc('reconcile_legacy_stripe_checkout', {
        p_order_id:order.id,p_attempt_id:attempt.attempt_id,p_customer_id:customerId,
        p_session_id:session.id,p_intent_id:intentId,
      });
      if (error || !bound) throw new AppError('Legacy payment identity could not be reconciled',503);
      attempt = bound;
      verifyStripeSession(session,order,attempt);
    }
    if (canceledIntent && intentId !== canceledIntent.id) return {stale:true};
    let intent = intentId ? await stripe.paymentIntents.retrieve(intentId) : null;
    if (intent) verifyStripeIntent(intent,order,attempt);
    if (intent?.status === 'succeeded') {
      await settle(intent, {order, attempt, session});
      return {paid:true};
    }
    // A failed card can be retried. Processing/authorized/completed sessions are
    // held for settlement/reconciliation rather than returning sellable stock.
    if (session.payment_status === 'paid' || (intent && ['processing','requires_capture'].includes(intent.status))) return {pending:true};
    if (canceledIntent && intent?.status !== 'canceled') return {pending:true};
    if (session.status === 'open') {
      if (!canceledIntent && Math.min(new Date(attempt.expires_at).getTime(),paymentDeadline(order)) > now()) return {pending:true};
      // expire is atomic at Stripe: if completion wins, retrieval below observes
      // it and preserves the reservation. A cancel redirect alone never releases.
      try { await stripe.checkout.sessions.expire(session.id); }
      catch (error) {
        if (error.type !== 'StripeInvalidRequestError') throw error;
      }
      session = verifyStripeSession(await stripe.checkout.sessions.retrieve(session.id), order, attempt);
      intent = providerId(session.payment_intent) ? await stripe.paymentIntents.retrieve(providerId(session.payment_intent)) : null;
      if (intent) verifyStripeIntent(intent,order,attempt);
      if (intent?.status === 'succeeded') { await settle(intent, {order, attempt, session}); return {paid:true}; }
    }
    if (session.payment_status === 'paid' || (intent && ['processing','requires_capture'].includes(intent.status))) return {pending:true};
    if (canceledIntent) {
      if (intent?.id !== canceledIntent.id || intent.status !== 'canceled' || session.status === 'open') return {pending:true};
      return release(db, order, attempt, session, intent, 'intent_cancelled');
    }
    if (session.status !== 'expired' || session.payment_status !== 'unpaid') return {pending:true};
    return release(db, order, attempt, session, intent, 'session_expired');
  }

  async function recoverEvent({sessionId = null, canceledIntent = null, orderId}) {
    const {data:order, error} = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !order) throw new AppError('Payment order is unavailable', 503);
    return recoverOrder(order, {sessionId, canceledIntent});
  }

  async function sweep(shouldStop = () => false) {
    const {data:orders, error} = await db.from('orders').select('*')
      .eq('payment_method','stripe').eq('is_paid',false).is('inventory_released_at',null)
      .in('status',['pending','processing']).lte('payment_expires_at',new Date(now()).toISOString())
      .order('payment_recovery_checked_at',{ascending:true,nullsFirst:true}).order('created_at',{ascending:true}).limit(50);
    if (error) throw new AppError('Unpaid payment recovery scan failed', 503);
    for (const order of orders || []) {
      if (shouldStop()) break;
      try {
        const result = await recoverOrder(order);
        if (result.released) logger.info('Unpaid Stripe reservation released', {orderId:order.id});
      } catch (error) {
        logger.error('Stripe reservation recovery requires retry or reconciliation', {orderId:order.id, error:error.message});
      } finally {
        // Rotate unresolved cases behind unexamined orders; one ambiguous old
        // payment must not starve recovery for the remainder of the catalog.
        const {error:checkError} = await db.from('orders').update({payment_recovery_checked_at:new Date(now()).toISOString()}).eq('id',order.id);
        if (checkError) logger.error('Payment recovery scan position could not be saved', {orderId:order.id,error:checkError.message});
      }
    }
  }

  function start() {
    let activeRun = null;
    let stopped = false;
    function tick() {
      if (activeRun || stopped) return activeRun;
      activeRun = sweep(() => stopped)
        .catch(error => logger.error('Stripe recovery worker failed', {error:error.message}))
        .finally(() => { activeRun = null; });
      return activeRun;
    }
    const timer = setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
    timer.unref?.();
    void tick();
    return async () => { stopped = true; clearInterval(timer); await activeRun; };
  }
  return {recoverEvent, recoverOrder, sweep, start};
}
