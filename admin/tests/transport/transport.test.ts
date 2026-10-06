import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest';
const state = vi.hoisted(() => ({accessToken:'access',twoFactorToken:'123456',user:{id:'admin',role:'admin'},clearAuth:vi.fn(),setToken:vi.fn(),setUser:vi.fn()}));
vi.mock('@/lib/auth-store', () => ({useAuthStore:{getState:() => state}}));
const json = (body:unknown,status=200) => Response.json(body,{status});
let request: typeof import('@/lib/transport').request;
beforeEach(async () => {vi.resetModules();vi.clearAllMocks();({request}=await import('@/lib/transport'));});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('admin API security transport', () => {
  it.each(['http://127.0.0.1:3002', 'http://localhost:3002'])('keeps login and CSRF on %s despite legacy public API URLs', async origin => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:5000/api/v1');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://127.0.0.1:5000');
    vi.resetModules();
    const transport = await import('@/lib/transport');
    let cookieBinding: string | null = null;
    const fetcher = vi.fn(async (path: string, init: RequestInit) => {
      // Model Strict-cookie acceptance and sending: cross-site requests cannot
      // establish the binding needed by login even if bootstrap returns JSON.
      const url = new URL(path, origin);
      if (url.pathname.endsWith('/csrf-token')) {
        cookieBinding = url.origin === origin ? 'anonymous-session-csrf' : null;
        return json({ data: { csrfToken: 'anonymous-session-csrf' } });
      }
      const header = new Headers(init.headers).get('x-csrf-token');
      const accepted = url.origin === origin && header === cookieBinding;
      return accepted ? json({token:'session',data:{user:state.user}}) : json({message:'Invalid CSRF token',code:'CSRF_INVALID'},403);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await transport.request(`${transport.API_BASE}/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}, false);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([path]) => new URL(path,origin).origin)).toEqual([origin,origin]);
    for (const [,init] of fetcher.mock.calls) expect(init.credentials).toBe('include');
    expect(new Headers(fetcher.mock.calls[1][1].headers).has('authorization')).toBe(false);
  });
  it('sends fresh CSRF, bearer and current TOTP on protected writes', async () => {
    const fetcher=vi.fn(async (url:string,init:RequestInit) => {
      if(url.endsWith('/csrf-token'))return json({data:{csrfToken:'csrf'}});
      const headers=new Headers(init.headers);
      expect(headers.get('authorization')).toBe('Bearer access');
      expect(headers.get('x-csrf-token')).toBe('csrf');
      expect(headers.get('x-2fa-token')).toBe('123456');
      expect(init.credentials).toBe('include');
      return json({success:true});
    });vi.stubGlobal('fetch',fetcher);
    await request('/api/v1/admin/products',{method:'POST',body:'{}'});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not refresh or clear the session for a TOTP challenge', async () => {
    const fetcher=vi.fn(async()=>json({message:'Two-factor authentication required'},401));vi.stubGlobal('fetch',fetcher);
    await expect(request('/api/v1/admin/orders')).rejects.toMatchObject({status:401,code:'2FA_REQUIRED'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(state.clearAuth).not.toHaveBeenCalled();
  });
  it('shares refresh between concurrent expired requests', async () => {
    let refreshed=false, refreshes=0;
    vi.stubGlobal('fetch',vi.fn(async (url:string) => {
      if(url.endsWith('/csrf-token'))return json({data:{csrfToken:'csrf'}});
      if(url.endsWith('/refresh')) {refreshes++; await Promise.resolve(); refreshed=true; return json({token:'new',data:{user:state.user}});}
      return refreshed ? json({data:[]}) : json({message:'Expired'},401);
    }));
    await Promise.all([request('/api/v1/admin/orders'),request('/api/v1/admin/products')]);
    expect(refreshes).toBe(1);expect(state.setToken).toHaveBeenCalledWith('new');
  });
  it('does not leak internal server errors',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>json({message:'database secret stack'},500)));
    await expect(request('/api/v1/admin/users')).rejects.toThrow('The service is unavailable');
  });
  it('does not fetch CSRF for read-only requests',async()=>{
    const fetcher=vi.fn(async()=>json({data:[]}));vi.stubGlobal('fetch',fetcher);
    await request('/api/v1/admin/users');expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reacquires the cookie-bound token once after another tab rotates the session',async()=>{
    let bootstraps=0,writes=0;
    const fetcher=vi.fn(async(url:string,init:RequestInit)=>{
      if(url.endsWith('/csrf-token')) return json({data:{csrfToken:`binding-${++bootstraps}`}});
      writes++;
      if(writes===1) return json({message:'Invalid CSRF token',code:'CSRF_INVALID'},403);
      expect(new Headers(init.headers).get('x-csrf-token')).toBe('binding-2');
      return json({success:true});
    });
    vi.stubGlobal('fetch',fetcher);
    await request('/api/v1/auth/login',{method:'POST',body:'{}'},false);
    expect(bootstraps).toBe(2);expect(writes).toBe(2);
  });
  it('stops after one retry if the browser still cannot establish a CSRF binding',async()=>{
    let bootstraps=0,writes=0;
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      if(url.endsWith('/csrf-token')) {bootstraps++;return json({data:{csrfToken:'binding'}});}
      writes++;return json({message:'Invalid CSRF token',code:'CSRF_INVALID'},403);
    }));
    await expect(request('/api/v1/auth/login',{method:'POST',body:'{}'},false)).rejects.toMatchObject({status:403,code:'CSRF_INVALID'});
    expect(bootstraps).toBe(2);expect(writes).toBe(2);
  });
});
