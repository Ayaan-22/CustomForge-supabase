import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/db.js', () => ({ getSupabaseClient: (req) => req.supabase }));
vi.mock('../../middleware/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../utils/email.js', () => ({ default: class {} }));
import { getMyOrders } from '../../controllers/orderController.js';

const rows = [
  { id: 'stripe-order', user_id: 'owner', status: 'pending', is_paid: false, payment_method: 'stripe', total_price: 125, items: [{ product_id: 'gpu', name: 'Gaming GPU', price: 125, quantity: 1 }] },
  { id: 'delivery-order', user_id: 'owner', status: 'pending', is_paid: false, payment_method: 'cod', total_price: 45, items: [{ product_id: 'mouse', name: 'Gaming mouse', price: 45, quantity: 1 }] },
  { id: 'other-account-order', user_id: 'other-account', status: 'pending', is_paid: false, payment_method: 'stripe', total_price: 500, items: [] },
];

async function history(role = 'user') {
  let projection = [];
  const filters = [];
  const query = {
    select: vi.fn((columns) => {
      // Model the database projection rather than returning fields the real
      // select omitted; removing payment_method must break this regression.
      projection = columns.split('items:')[0].split(',').map(field => field.trim()).filter(Boolean);
      return query;
    }),
    eq: vi.fn((field, value) => { filters.push([field, value]); return query; }),
    order: vi.fn(() => query),
    range: vi.fn(async (from, to) => {
      const owned = rows.filter(row => filters.every(([field, value]) => row[field] === value));
      return {
        data: owned.slice(from, to + 1).map(row => ({
          ...Object.fromEntries(projection.map(field => [field, row[field]])),
          items: row.items,
        })),
        count: owned.length,
        error: null,
      };
    }),
  };
  const supabase = { from: vi.fn(() => query) };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await getMyOrders({
    user: { id: 'owner', role },
    // A supplied other owner must never replace the authenticated owner scope.
    query: { page: '1', limit: '20', userId: 'other-account' },
    supabase,
  }, res, next);
  return { body: res.json.mock.calls[0]?.[0], next, supabase, query };
}

describe('owner order history response', () => {
  it.each(['user', 'admin'])('retains real payment methods while listing only the %s account’s orders', async (role) => {
    const result = await history(role);
    expect(result.next).not.toHaveBeenCalled();
    expect(result.supabase.from).toHaveBeenCalledExactlyOnceWith('orders');
    expect(result.query.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(result.query.range).toHaveBeenCalledWith(0, 19);
    expect(result.body).toMatchObject({ page: 1, limit: 20, total: 2, results: 2 });
    expect(result.body.data).toEqual([
      expect.objectContaining({ id: 'stripe-order', paymentMethod: 'stripe', isPaid: false, status: 'pending', total: 125, items: [expect.objectContaining({ productId: 'gpu', quantity: 1 })] }),
      expect.objectContaining({ id: 'delivery-order', paymentMethod: 'cod', isPaid: false, status: 'pending', total: 45 }),
    ]);
    expect(result.body.data.map(order => order.id)).not.toContain('other-account-order');
  });
});
