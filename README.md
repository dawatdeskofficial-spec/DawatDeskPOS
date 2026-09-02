# Servia - Restaurant Management System

Servia is a full-stack restaurant operations app with role dashboards for platform admins, restaurant admins, waiters, chefs, and cashiers. The backend is an Express.js + MongoDB/Mongoose REST API; the frontend is React + TypeScript + TanStack Router + Tailwind.

## Project Structure

- `BackEnd/`: Express.js + Mongoose REST API.
- `flavor-fusion-os/`: React + Vite + TypeScript web application.

## Prerequisites

- Node.js (v18 or newer)
- MongoDB (Running locally on `mongodb://127.0.0.1:27017/restaurantDB`)

## Setup

### 1. Backend

1. Navigate to the backend directory:
   ```bash
   cd BackEnd
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure you have a `.env` file in `BackEnd/` with the following variables:
   ```
   PORT=5001
   MONGO_URI=mongodb://127.0.0.1:27017/restaurantDB
   JWT_SECRET=supersecret123
   CORS_ORIGIN=http://localhost:8080
   ```
4. Seed the database with initial users and data:
   ```bash
   node seed.js
   ```
5. Start the backend server:
   ```bash
   npm run dev
   ```

### 2. Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd flavor-fusion-os
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Root CLI shortcuts

From the project root, you can run the backend or frontend directly:

```bash
npm run backend
npm run frontend
npm run build:frontend
npm run test:backend
```

### 4. Usage & Access Roles

Open `http://localhost:5173` in your browser. Use the seeded credentials below to access different dashboards:

| Role | Email | Password | Dashboard Access |
|---|---|---|---|
| Main Admin | `admin@servia.com` | `admin123` | Developer Console, overall management |
| Restaurant Admin | `manager.golden@restaurant.com` | `manager@123` | Menu, Orders, Staff, Reports |
| Chef | `chef.john@golden.com` | `chef@123` | Kitchen Queue, Order tracking |
| Waiter | `waiter.alice@golden.com` | `waiter@123` | Tables, Order Pad, My Orders |
| Cashier | `cashier.bob@golden.com` | `cashier@123` | Billing Counter, Open Bills |

## Roles

- `main_admin`: manages all restaurants, users, platform settings, and cross-restaurant reports.
- `restaurant_admin`: manages only their assigned restaurant's menu, staff, orders, bills, and reports.
- `waiter`: creates orders, adds items, serves ready items, and can void unpaid pending orders with a reason.
- `chef`: starts kitchen items and marks prepared items ready.
- `cashier`: collects payment for served orders, prints bills, and closes paid orders.

Public signup is disabled for all staff/admin roles. Staff accounts should be created by a main admin or the assigned restaurant admin.

## Order Lifecycle

1. Waiter creates an order for a restaurant table.
2. Chef moves kitchen items from `PENDING` to `PREPARING`.
3. Chef marks prepared items `READY`.
4. Waiter serves ready items; once all kitchen items are delivered, the order becomes `SERVED`.
5. Cashier collects payment; successful payment closes the order as `COMPLETED`.
6. Unpaid pending/pre-payment orders can be voided with a reason. Completed paid orders use the refund flow instead.

## Payment Lifecycle

1. Cashier selects a `SERVED` order.
2. Optional discount is entered at billing.
3. Backend creates one `Payment` record per order with subtotal, configured GST, discount, total, method, receipt number, status `COMPLETED`, and `paidAt`.
4. Only after payment creation succeeds does the backend mark the order `COMPLETED`.
5. Duplicate payment for the same order is rejected.
6. Restaurant admin bills are read from real `Payment` records and can be refunded with a required reason.

## Environment Variables

Backend `.env`:

```bash
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/restaurantDB
JWT_SECRET=replace-with-a-strong-secret
CORS_ORIGIN=http://localhost:5173
```

Frontend `.env`:

```bash
VITE_API_BASE_URL=http://localhost:5001
```

## Quality Checks

Frontend:

```bash
cd FrontEnd
npm run lint
npm run build
```

Backend unit smoke tests:

```bash
cd BackEnd
npm test
```

## Known Limitations

- Backend tests currently cover authorization and restaurant ownership smoke cases; full API lifecycle integration tests are still needed.
- Receipt numbers are generated sequentially per restaurant using current payment count; high-concurrency production deployments should replace this with an atomic counter.
- GST is global system settings based, not per restaurant.
- Remaining frontend lint warnings are Fast Refresh warnings from shared UI/auth/router exports.
