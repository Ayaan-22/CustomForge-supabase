# 🔐 Authentication & Security Flow

CustomForge implements a robust, multi-layered authentication system using JWT, refresh tokens, and optional Two-Factor Authentication (2FA).

## 🛡️ Core Concepts

1. **Stateful vs Stateless**: We use JWT (JSON Web Tokens) for stateless authentication, but maintain session security via HTTP-only cookies.
2. **Access & Refresh Tokens**:
   - **Access Token**: Purpose-bound short-lived JWT (15m default), stored only in browser memory and sent as Bearer authorization.
   - **Refresh Token**: A separate purpose/audience JWT with unique identifier, stored in an HttpOnly cookie. Only its hash is stored in the user row; it cannot authenticate normal API routes.
3. **MFA (2FA)**: Time-based One-Time Password (TOTP) support for enhanced security.

---

## 🔄 Authentication Lifecycle

### 1. Registration & Verification

- User signs up via `POST /auth/register`.
- A verification token is generated and emailed.
- The email link opens a GET confirmation page. Only explicit confirmation calls `POST /auth/verify-email/:token` with CSRF to consume the token and issue a session. API GET returns 405 without changing verification or cookies.

### 2. Login Flow

- User provides credentials to `POST /auth/login`.
- System checks for 2FA requirement.
- If 2FA is enabled:
  - System returns a "2FA required" status.
  - User repeats `/auth/login` with the credentials and current TOTP code. `/auth/2fa/verify` instead confirms authenticated enrollment.
- System issues Access and Refresh tokens.

### 3. Protection Middleware

All protected routes use the `protect` middleware:

```javascript
// Example Route Protection
router.get('/profile', authMiddleware.protect, userController.getProfile);
```

- Validates a purpose-bound access JWT from the Bearer header, never a refresh cookie.
- Attaches the `user` object to the request.
- Checks if the user's password was changed after the token was issued.

Refresh uses a conditional database update matching the current hash, active account, unexpired session and observed password-change timestamp. Concurrent requests cannot both replace the same binding. Cookie/database expiry is calculated at issuance and capped by JWT expiry. Logout waits for conditional refresh revocation; a changed binding returns 409 and database failure returns 503, preserving cookies for retry. Access tokens remain valid for their short lifetime unless the account/password changes. Sessions issued before purpose separation require a new sign-in.

Same-origin tabs share fresh session state only through memory-held BroadcastChannel messages and a Web Locks state recheck. Cookie-changing auth requests share the lock; refresh has a 30-second HTTP budget. Tokens are never placed in localStorage. Locks/broadcasts are origin scoped, while cookies can be shared across ports on the same hostname. Storefront/admin on different localhost ports therefore still rely on server rotation/conflict checks.

---

## 🏗️ Frontend Security Patterns

### Centralized Auth Hook

Always use the `useAuth()` hook to access user state and authentication status.

```typescript
import { useAuth } from "@/lib/auth-context";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Redirect to="/login" />;

  return <div>Welcome, {user.name}</div>;
}
```

### Route Guarding

Use the `ProtectedRoute` component to wrap authenticated layouts or pages. This prevents "flash of unauthenticated content" and ensures consistent redirection.

---

## 🔒 Security Best Practices

| Feature | Implementation |
| :--- | :--- |
| **Password Hashing** | Bcrypt with high cost factor. |
| **Cookies** | `HttpOnly`, `Secure`, and `SameSite: Strict` flags. |
| **CSRF Protection** | Cookie/header equality plus a server HMAC bound to the current refresh or anonymous cookie. Production requires a distinct CSRF_SECRET. |
| **Rate Limiting** | Pre-authentication IP budgets plus account budgets after verified identity; optional Redis store required across multiple API processes. |
| **Headers** | **Helmet.js** integration for XSS and clickjacking protection. |
| **Input and output handling** | Zod validates structured inputs; parameterized database access prevents SQL injection, while UI/templates escape rendered text. |

---

## 🚦 Authorization Roles

We use a Role-Based Access Control (RBAC) system:

- **USER**: Standard permissions (browsing, ordering, profile).
- **ADMIN**: Elevated permissions (user management, analytics, system logs).

```javascript
// Restricting access to admins only
router.delete('/products/:id', 
  authMiddleware.protect, 
  authMiddleware.restrictTo('admin'), 
  productController.deleteProduct
);
```
