import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), client: vi.fn() }));
vi.mock('../../config/db.js', () => ({ getSupabaseClient: mocks.client }));
vi.mock('../../middleware/logger.js', () => ({ logger: { error: vi.fn() } }));
vi.mock('../../utils/email.js', () => ({ default: class { sendOrderConfirmation = mocks.send; } }));
import { createOrder } from '../../controllers/orderController.js';

afterEach(() => vi.clearAllMocks());
async function checkout(result, body = {}) {
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue(result);
  const req = { user: { id: 'owner' }, body: { shippingAddressId: 'address', paymentMethod: 'cod', idempotencyKey: 'stable-key', ...body } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await createOrder(req, res, next);
  await new Promise(resolve => setImmediate(resolve));
  return { req, res, next };
}
describe('atomic checkout controller', () => {
  it('passes only shipping/payment/key using the request-scoped client', async () => {
    const order = { id: 'created', orderItems: [{ quantity: 2 }] };
    const { req, res } = await checkout({ data: { order, reused: false } }, { user_id: 'victim', total_price: 0, is_paid: true });
    expect(mocks.client).toHaveBeenCalledWith(req);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('checkout_cart', {
      p_shipping_address_id: 'address', p_shipping_address: null, p_payment_method: 'cod', p_idempotency_key: 'stable-key',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({id:'created',isPaid:false,items:[expect.objectContaining({quantity:2})]}) }));
    expect(mocks.send).toHaveBeenCalledWith(order);
  });
  it('replays a committed order without sending a duplicate email', async () => {
    const { res } = await checkout({ data: { order: { id: 'existing' }, reused: true } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ idempotent: true }));
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([['22023',400],['42501',403],['P0001',409],['23505',409],['PGRST202',500]])('handles database failure %s without mail or compensating writes', async (code, status) => {
    const { next, res } = await checkout({ error: { code, message: 'Database failure' } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: status }));
    expect(res.json).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});

it('does not reserve inventory for disabled PayPal checkout',async()=>{const {next}=await checkout({}, {paymentMethod:'paypal'});expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:503}));expect(mocks.rpc).not.toHaveBeenCalled()});
it('does not create an unrecoverable checkout without a stable key',async()=>{const {next}=await checkout({}, {idempotencyKey:undefined});expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(mocks.rpc).not.toHaveBeenCalled()});
