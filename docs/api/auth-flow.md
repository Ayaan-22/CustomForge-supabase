# 🔐 Authentication & Security Flow

CustomForge implements a robust, multi-layered authentication system using JWT, refresh tokens, and optional Two-Factor Authentication (2FA).

## 🛡️ Core Concepts

1. **Stateful vs Stateless**: We use JWT (JSON Web Tokens) for stateless authentication, but maintain session security via HTTP-only cookies.
2. **Access & Refresh Tokens**:
   - **Access Token**: Short-lived (e.g., 15m), stored in memory or short-lived cookie.
   - **Refresh Token**: Long-lived, stored in an HTTP-only cookie, used to rotate access tokens.
3. **MFA (2FA)**: Time-based One-Time Password (TOTP) support for enhanced security.

---

## 🔄 Authentication Lifecycle

### 1. Registration & Verification

- User signs up via `POST /auth/signup`.
- A verification token is generated and emailed.
- Account remains "unverified" until the email link is clicked (`GET /auth/verify-email/:token`).

### 2. Login Flow

- User provides credentials to `POST /auth/login`.
- System checks for 2FA requirement.
- If 2FA is enabled:
  - System returns a "2FA required" status.
  - User must provide TOTP code to `/auth/2fa/verify`.
- System issues Access and Refresh tokens.

### 3. Protection Middleware

All protected routes use the `protect` middleware:

```javascript
// Example Route Protection
router.get('/profile', authMiddleware.protect, userController.getProfile);
```

- Validates JWT from the request header/cookie.
- Attaches the `user` object to the request.
- Checks if the user's password was changed after the token was issued.

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
| **CSRF Protection** | Enforced via SameSite cookies and custom headers. |
| **Rate Limiting** | Strict limits on `/login` and `/forgot-password` endpoints. |
| **Headers** | **Helmet.js** integration for XSS and clickjacking protection. |
| **Data Sanitization** | Prevention against NoSQL/SQL injection and XSS. |

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
