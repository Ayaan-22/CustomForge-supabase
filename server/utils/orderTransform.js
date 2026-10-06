// server/utils/orderTransform.js

/**
 * Map order from database format (snake_case) to frontend format (camelCase)
 */
export function mapOrderToFrontend(order) {
  if (!order) return null;

  return {
    id: order.id,
    userId: order.user_id,
    status: order.status,
    isPaid: Boolean(order.is_paid),
    paymentMethod: order.payment_method,
    returnStatus: order.return_status,
    subtotal: order.items_price,
    discount: order.discount_amount,
    shipping: order.shipping_price,
    tax: order.tax_price,
    total: order.total_price,
    address: order.shipping_address,
    paymentIntentId: order.payment_intent_id,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items:
      (order.items ?? order.orderItems)?.map((item) => ({
        productId: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })) || [],
  };
}
