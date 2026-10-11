import { getServiceClient } from "../config/db.js";
import { logger } from "../middleware/logger.js";
import Email from "./email.js";

const sendConfirmation = async (job, order, { signal }) => {
  const origin = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:3000";
  const email = new Email({ email: job.recipient_email, name: job.recipient_name },
    `${origin}/orders/${order.id}`, { messageId: `<order-${job.id}@customforge.local>`, signal });
  await email.sendOrderConfirmation(order);
};

// Bound even injected transports that ignore cancellation; actual PostgREST
// requests also receive the signal so timed-out network requests are cancelled.
const abortable = (operation, signal) => {
  signal.throwIfAborted();
  const pending = operation && typeof operation.abortSignal === "function" ? operation.abortSignal(signal) : operation;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(pending).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

const finish = async (client, job, success, error, signal) => {
  const result = await abortable(client.rpc("finish_order_email", {
    p_id: job.id, p_lease_token: job.lease_token, p_success: success, p_error: error,
  }), signal);
  if (result.error) throw new Error("Unable to persist email delivery outcome");
  if (!result.data) throw new Error("Email delivery lease was replaced");
};

export const processOrderEmailOutbox = async ({ client = getServiceClient(), send = sendConfirmation, limit = 10,
  workTimeoutMs = 90_000, renewalIntervalMs = 30_000 } = {}) => {
  if (!Number.isFinite(workTimeoutMs) || workTimeoutMs <= 0 || workTimeoutMs > 90_000) throw new Error("Email work deadline must be at most 90 seconds");
  if (!Number.isFinite(renewalIntervalMs) || renewalIntervalMs <= 0 || renewalIntervalMs > 30_000) throw new Error("Email lease renewal interval must be at most 30 seconds");
  let processed = 0;
  // Claim only the job being sent: slow SMTP must not expire leases of jobs
  // waiting in a local batch while another process is also consuming the queue.
  for (let index = 0; index < limit; index++) {
    const controller = new AbortController();
    const { signal } = controller;
    const deadline = setTimeout(() => controller.abort(new Error("Order email work deadline exceeded")), workTimeoutMs);
    deadline.unref?.();
    let heartbeat;
    let renewing = null;
    try {
      const claimed = await abortable(client.rpc("claim_order_emails", { p_limit: 1 }), signal);
      if (claimed.error) throw new Error("Unable to claim order email outbox");
      const job = claimed.data?.[0];
      if (!job) break;
      const renew = () => {
        if (!renewing) renewing = abortable(client.rpc("renew_order_email_lease", {
          p_id: job.id, p_lease_token: job.lease_token,
        }), signal).then(result => {
          if (result.error || !result.data) throw new Error("Order email lease renewal failed or ownership was lost");
        }).finally(() => { renewing = null; });
        return renewing;
      };
      heartbeat = setInterval(() => {
        void renew().catch(error => controller.abort(error));
      }, renewalIntervalMs);
      heartbeat.unref?.();
      let deliveryError = null;
      try {
        const { data: order, error } = await abortable(client.from("orders")
          .select("*, orderItems:order_items(name, price, quantity)").eq("id", job.order_id).maybeSingle(), signal);
        if (error || !order) throw new Error("Order snapshot is unavailable");
        // Verify ownership immediately before any external SMTP side effect.
        try { await renew(); } catch (error) { controller.abort(error); }
        signal.throwIfAborted();
        await abortable(send(job, order, { signal }), signal);
        signal.throwIfAborted();
      } catch (error) {
        // Lease loss/timeout must stop the batch. Do not acknowledge or start
        // another job while an aborted SMTP delivery may still be settling.
        if (signal.aborted) throw signal.reason;
        deliveryError = "DELIVERY_FAILED";
        logger.error("Order confirmation delivery will be retried", { jobId: job.id, orderId: job.order_id });
      }
      clearInterval(heartbeat);
      if (renewing) await renewing;
      signal.throwIfAborted();
      // An acknowledgement failure leaves the lease retryable. SMTP cannot
      // guarantee exactly-once delivery after a crash, even with Message-ID.
      await finish(client, job, deliveryError === null, deliveryError, signal);
      processed++;
    } finally {
      clearInterval(heartbeat);
      clearTimeout(deadline);
    }
  }
  return processed;
};

export const startOrderEmailWorker = ({ intervalMs = 15000, ...options } = {}) => {
  let stopped = false;
  let running = null;
  const tick = () => {
    if (stopped || running) return;
    running = processOrderEmailOutbox(options)
      .catch(() => logger.error("Order email worker failed; pending deliveries remain retryable"))
      .finally(() => { running = null; });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
};
