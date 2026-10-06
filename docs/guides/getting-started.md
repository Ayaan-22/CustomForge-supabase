# 🏁 Getting Started

> Historical setup guide. Its example repository URL, Node version and commands may be outdated. Use the [root README](../../README.md) for the current Node.js 22+, npm, environment, migration and startup instructions.

Follow this guide to set up your local development environment and get CustomForge running.

## 📋 Prerequisites

Ensure you have the following installed:

- **Node.js** (v18.x or higher)
- **npm** or **pnpm**
- **Git**

---

## ⚙️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/customforge-supabase.git
cd customforge-supabase
```

### 2. Install Dependencies

Install all package dependencies for the backend, client, and admin modules.

```bash
# Backend
cd server && npm install

# Client
cd ../client && npm install

# Admin
cd ../admin && npm install
```

---

## 🔑 Environment Configuration

Each module requires a `.env` file. You can find `.env.example` files in each directory.

### Backend (`/server/.env`)

```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_secret
JWT_EXPIRES=7d
EMAIL_USERNAME=your_email
EMAIL_PASSWORD=your_email_password
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
NODE_ENV=development
```

### Client (`/client/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 🚀 Running the Project

For the best experience, run the backend and frontend modules in separate terminal windows.

### 1. Start the Backend

```bash
cd server
npm run dev
```

### 2. Start the Storefront

```bash
cd client
npm run dev
```

### 3. Start the Admin Dashboard

```bash
cd admin
npm run dev
```

The services will be available at:

- **API**: `http://localhost:5000`
- **Storefront**: `http://localhost:3000`
- **Admin**: `http://localhost:3001`

---

## 🧪 Testing

### API Testing

A comprehensive **Postman Collection** is included in the root directory:
`ecommerce_postman_collection_structured.json`.

Import this into Postman to test all authentication, cart, and order flows.

### Linting & Code Style

Run linting checks to ensure code quality:

```bash
npm run lint
```

---

## 🛠️ Common Tasks

### Database Migrations

If you need to update the database schema, apply the SQL scripts located in:
`server/models/migrations/schema.sql`

### Generating 2FA Secrets

You can use the built-in utility or the admin dashboard to generate TOTP secrets for testing user accounts.
