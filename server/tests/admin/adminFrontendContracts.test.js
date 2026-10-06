import { describe, it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({rows: [], update: vi.fn(), rpc: vi.fn(), or: vi.fn()}));
vi.mock('../../config/db.js', () => {
  const db = {rpc:state.rpc,from: () => {
    const q = {select: () => q, order: () => q, range: () => q, eq: () => q, or: value => {state.or(value);return q;},
      then: (resolve) => Promise.resolve({data: state.rows, count: state.rows.length, error: null}).then(resolve)};
    return q;
  }};
  return {getServiceClient: () => db};
});
vi.mock('../../middleware/logger.js', () => ({logger: {info: vi.fn(), error: vi.fn(), warn: vi.fn()}}));
import {getAllUsers, getAllProducts, getAllReviews, getProductStats, processRefund} from '../../controllers/adminController.js';
import {publicUser} from '../../utils/publicUser.js';
const run = (controller, query = {}) => new Promise((resolve, reject) => controller(
  {user: {id: 'admin', role: 'admin'}, query, params: {}, body: {}},
  {json: resolve}, reject,
));
beforeEach(() => {state.rows = [];state.or.mockClear();state.rpc.mockReset().mockResolvedValue({data:{totalProducts:1,lowStock:1,growth:null},error:null});});
describe('admin frontend contracts', () => {
  it('strips snake_case database credentials from paginated users', async () => {
    state.rows = [{id: 'customer', email: 'customer@example.test', password: 'hash', two_factor_secret: 'secret', refresh_token_hash: 'hash', password_reset_token: 'reset', email_verification_token: 'verify'}];
    const response = await run(getAllUsers);
    expect(response.data).toEqual([{id: 'customer', email: 'customer@example.test'}]);
    expect(response.count).toBe(1);
  });
  it('strips both database and domain credential field names', () => {
    expect(publicUser({id:'user', password:'hash', twoFactorSecret:'secret', two_factor_secret:'secret', refreshTokenHash:'refresh', refresh_token_hash:'refresh'})).toEqual({id:'user'});
  });
  it('does not invent product growth metrics', async () => {
    state.rows = [{id:'product', stock:2, is_active:true}];
    const response = await run(getProductStats);
    expect(response.data).toMatchObject({totalProducts:1, lowStock:1, growth:null});
    expect(state.rpc).toHaveBeenCalledWith('admin_analytics',{p_kind:'products',p_days:30,p_period:'daily'});
  });
  it('does not report a refund without provider settlement', async () => {
    await expect(run(processRefund)).rejects.toMatchObject({statusCode:503});
  });
  it.each([
    ['products', getAllProducts, ['name','brand','category','description']],
    ['users', getAllUsers, ['name','email']],
    ['reviews', getAllReviews, ['title','comment']],
  ])('keeps reserved punctuation inside a single search value for %s', async (_label, controller, fields) => {
    await run(controller, {search: 'Kit (2x16), "RGB"'});
    // Parentheses are LIKE-escaped by the existing search helper; OR grammar needs its own quoting.
    const quoted = String.raw`"%Kit \\(2x16\\), \"RGB\"%"`;
    expect(state.or).toHaveBeenCalledWith(fields.map(field => `${field}.ilike.${quoted}`).join(','));
  });
});

it('fails closed when analytics migration is unavailable',async()=>{state.rpc.mockResolvedValue({error:{code:'PGRST202'}});await expect(run(getProductStats)).rejects.toMatchObject({statusCode:503})});
