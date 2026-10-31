import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../config/db.js', () => ({ getSupabaseClient: (req) => req.supabase }));
vi.mock('../../models/User.js', async (original) => ({
  ...await original(), findUserById: vi.fn(),
}));
import { findUserById } from '../../models/User.js';
import { getMe, getWishlistController } from '../../controllers/userController.js';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const rows = [
  { product_id: first, products: { id: first, name: 'Gaming GPU', images: ['/gpu.png'], final_price: 125, category: 'GPU' } },
  { product_id: second, products: null },
];
beforeEach(() => findUserById.mockReset().mockResolvedValue({ id: 'owner', password: 'secret' }));

async function invoke(handler, data = rows, error = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ eq });
  const supabase = { from: vi.fn().mockReturnValue({ select }) };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await handler({ user: { id: 'owner' }, supabase }, res, next);
  return { body: res.json.mock.calls[0]?.[0], supabase, eq, next };
}

describe('wishlist response contract', () => {
  it.each([getWishlistController, getMe])('returns usable product IDs with request-scoped ownership in %s', async (handler) => {
    const result = await invoke(handler);
    const items = handler === getMe ? result.body.data.wishlist : result.body.data;
    expect(items).toEqual([
      { id: first, productId: first, name: 'Gaming GPU', image: '/gpu.png', finalPrice: 125, category: 'GPU' },
      { id: second, productId: second },
    ]);
    expect(new Set(items.map(item => item.productId)).size).toBe(items.length);
    expect(result.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(findUserById).toHaveBeenCalledWith('owner', {}, result.supabase);
    expect(result.body.data).not.toHaveProperty('password');
    expect(result.next).not.toHaveBeenCalled();
  });
  it('returns an empty list without fabricating products', async () => {
    expect((await invoke(getWishlistController, [])).body).toEqual({success:true,results:0,data:[]});
  });
  it('propagates database failures rather than returning a false empty wishlist', async () => {
    const result = await invoke(getWishlistController, null, {message:'database unavailable'});
    expect(result.body).toBeUndefined();
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({message:'database unavailable'}));
  });
});
