import {useAuthStore} from './auth-store';
import {API_BASE, request, refreshSession, ApiError} from './transport';
type User = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
type Session = {token: string; data: {user: User}};
type Message = {message?: string};
async function authRequest<T>(path: string, method: string, body?: unknown, protectedRequest = false): Promise<T> {
  const response = await request(`${API_BASE}/auth${path}`, {
    method, ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}),
  }, protectedRequest);
  return response.json();
}
function acceptSession(session: Session) {
  if (!session.token || !session.data?.user || session.data.user.role !== 'admin') {
    useAuthStore.getState().clearAuth();
    throw new ApiError('Access denied: Admin role required', 403);
  }
  useAuthStore.getState().setToken(session.token);
  useAuthStore.getState().setUser(session.data.user);
  return session;
}
export const authClient = {
  register: (data: unknown) => authRequest<Message>('/register', 'POST', data),
  login: async (data: {email: string; password: string; twoFactorToken?: string}) => {
    try {
      const session = acceptSession(await authRequest<Session>('/login','POST',data));
      useAuthStore.getState().setTwoFactorToken(data.twoFactorToken || null);
      return session;
    } catch (error) {
      if (error instanceof ApiError && error.code === '2FA_REQUIRED') useAuthStore.getState().setRequiresTwoFactor(true);
      throw error;
    }
  },
  logout: async () => {
    const result = await authRequest<Message>('/logout','POST');
    useAuthStore.getState().clearAuth();
    return result;
  },
  verifyEmail: (token: string) => authRequest<Message>(`/verify-email/${encodeURIComponent(token)}`,'GET'),
  sendVerificationEmail: () => authRequest<Message>('/send-verification-email','POST',undefined,true),
  forgotPassword: (email: string) => authRequest<Message>('/forgot-password','POST',{email}),
  resetPassword: (token: string, password: string) => authRequest<Message>(`/reset-password/${encodeURIComponent(token)}`,'POST',{password,passwordConfirm: password}),
  refreshToken: refreshSession,
  updatePassword: async (data: {passwordCurrent: string; password: string; passwordConfirm: string}) => acceptSession(await authRequest<Session>('/update-password','PATCH',data,true)),
  enableTwoFactor: (password: string) => authRequest<{data: {secret: string; otpauthUrl: string}}>('/2fa/enable','POST',{password},true),
  verifyTwoFactor: (token: string) => authRequest<Message>('/2fa/verify','POST',{token},true),
  disableTwoFactor: (token: string, password: string) => authRequest<Message>('/2fa/disable','DELETE',{token,password},true),
  verifyTwoFactorForLogin: (email: string, password: string, twoFactorToken: string): Promise<Session> => authClient.login({email,password,twoFactorToken}),
};
