import AppError from './appError.js';

export function ensureOrderPaymentReconciled(order) {
  if (order.status === 'payment_review' || order.inventory_released_at
    || order.payment_result?.reconciliationRequired === true) {
    throw new AppError('This payment requires reconciliation before fulfillment or returns',409);
  }
}
