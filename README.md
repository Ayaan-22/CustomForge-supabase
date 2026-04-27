# 🛠️ CustomForge: Production-Grade E-Commerce Platform

CustomForge is a full-stack, high-performance e-commerce ecosystem built with **Node.js**, **Next.js**, and **Supabase**. It features a robust hardware product system, secure checkout flows, and a dedicated admin management suite.

---

## ✨ Key Features

- **🔐 Secure Auth**: JWT-based session management with 2FA and refresh tokens.
- **🛒 Smart Cart**: Soft preview vs. strict checkout validation logic.
- **⚡ Atomic Orders**: Transactional order processing with inventory locks.
- **💳 Payments**: Integrated support for Stripe, PayPal, and COD.
- **📊 Admin Portal**: Comprehensive dashboard for orders, users, and analytics.
- **📝 Audit Trails**: Enterprise-grade logging for all system activities.

---

## 📚 Documentation Index

Our documentation is organized to help you get up and running quickly.

### 🏁 Getting Started

- **[Installation Guide](docs/getting-started.md)**: Setup, dependencies, and environment configuration.
- **[Quick Start](docs/getting-started.md#running-the-project)**: How to run the platform locally.

### 🏗️ Architecture

- **[System Overview](docs/architecture/system-overview.md)**: Tech stack and project structure.
- **[Database Schema](docs/architecture/database-schema.md)**: Data models and validation rules.

### 🔌 API Reference

- **[API Endpoints](docs/api/endpoints.md)**: Comprehensive list of all available routes.
- **[Auth Flow](docs/api/auth-flow.md)**: Authentication and security details.
- **[Order Processing](docs/api/cart-orders.md)**: Cart and checkout business logic.

### 📜 Historical Reports

- **[Supabase Migration](docs/reports/supabase-migration.md)**: Details on the transition to Supabase.
- **[Auth Audit](docs/reports/auth-audit.md)**: Security and UI authentication review.
- **[Schema Alignment](docs/reports/schema-alignment.md)**: Consistency checks between frontend and backend.

---

## 🛠️ Tech Stack

| Module | Core Technologies |
| :--- | :--- |
| **Backend** | Node.js, Express.js, Supabase, Winston |
| **Storefront** | Next.js, TailwindCSS, SWR |
| **Admin** | Next.js, Radix UI, Lucide |
| **Auth** | JWT, Bcrypt, TOTP (2FA) |
| **Payments** | Stripe API, PayPal SDK |

---

## 🚀 Quick Commands

```bash
# Run everything locally
cd server && npm run dev
cd ../client && npm run dev
cd ../admin && npm run dev
```

---

## 🛡️ License & Support

This project is intended for production use. For configuration issues or feature requests, please refer to the **[Getting Started](docs/getting-started.md)** guide or consult the **[API Reference](docs/api/endpoints.md)**.

---
*Built with ❤️ by the CustomForge Team.*
