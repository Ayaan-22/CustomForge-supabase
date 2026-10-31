# 🏗️ System Overview & Architecture

CustomForge is a high-performance, production-grade e-commerce platform built with a modular and scalable architecture.

## 🚀 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend (Client)** | Next.js, TailwindCSS | Modern, responsive user interface. |
| **Admin Portal** | Next.js, Radix UI | Management dashboard and analytics. |
| **Backend (API)** | Node.js, Express.js | Core business logic and API orchestration. |
| **Database** | Supabase (Postgres) | Scalable relational storage and Auth. |
| **Payments** | Stripe, PayPal | Secure financial transactions. |
| **Validation** | Zod, Joi | Multi-layer data integrity. |
| **Logging** | Winston | Enterprise-grade logging and audit trails. |

---

## 📁 Project Structure

The codebase is organized into three primary modules, ensuring clear separation of concerns.

### 1. `/server` (The Backend)

Follows the **Controller-Service-Model** pattern.

- `/controllers`: Request handling and response orchestration.
- `/models`: Database schemas and data access logic (Supabase integration).
- `/routes`: API endpoint definitions and middleware mapping.
- `/utils`: Shared helpers (email, logging, error handling).
- `/config`: Environment and database configuration.

### 2. `/client` (The Consumer Storefront)

A Next.js application optimized for SEO and conversion.

- `/app`: Next.js App Router (pages and layouts).
- `/components`: Reusable UI elements.
- `/services`: API client wrappers and data fetching.
- `/lib`: Auth context, constants, and utilities.

### 3. `/admin` (The Management Dashboard)

Dedicated portal for store managers and system administrators.

- Focuses on CRUD operations, analytics visualization, and log monitoring.

---

## 🧩 Key Architectural Patterns

### 1. Centralized Error Handling

The backend uses a global error-handling middleware that catches all synchronous and asynchronous errors, providing consistent JSON responses and logging.

### 2. Service Layer (Logic Abstraction)

Business logic is abstracted away from controllers into services (or model methods), making the code testable and reusable.

### 3. Atomic Transactions

Crucial operations like checkout and inventory updates are performed within atomic transactions to prevent partial updates and data corruption.

### 4. Modular Styling

TailwindCSS is used across the frontend for consistent, design-system-driven styling without the overhead of custom CSS files.

---

## 🔒 Security Posture

- **JWT + Refresh Tokens**: Secure session management.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions.
- **Data Sanitization**: Built-in protection against common web vulnerabilities.
- **Environment Isolation**: Strict separation of development and production configurations.
