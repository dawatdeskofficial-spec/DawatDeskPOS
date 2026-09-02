# Restaurant Management System - Project Understanding

## 1. Current Architecture

### Backend (Node.js + Express)
- **Database**: MongoDB Atlas
- **Port**: 5001 (production) / 5000 (default)
- **API Routes**:
  - `/api/auth` - User authentication & registration
  - `/api/restaurants` - Restaurant CRUD
  - `/api/menu` - Menu items management (RESTAURANT_ADMIN only)
  - `/api/orders` - Order CRUD (WAITER, RESTAURANT_ADMIN, MAIN_ADMIN)
  - `/api/payments` - Payment processing
  - `/api/users` - User management
  - `/api/settings` - System settings

### Frontend (Vue 3 + Vite + TypeScript)
- **Views** (all require authentication):
  - `/login` - Public login page
  - `/admin/dashboard` - Main admin dashboard (MAIN_ADMIN)
  - `/restaurant/*` - Restaurant owner pages (RESTAURANT_ADMIN)
  - `/waiter` - Waiter interface for taking orders
  - `/chef` - Chef kitchen display screen
  - `/cashier` - Cashier payment screen
  - `/customer-ordering` - Customer ordering (authenticated users only)
  - `/profile` - User profile

---

## 2. Current User Roles & Permissions

| Role | Function | Capabilities |
|------|----------|--------------|
| **MAIN_ADMIN** | System administrator | Manage all restaurants, users, settings |
| **RESTAURANT_ADMIN** | Restaurant owner | Manage menu, staff, settings for their restaurant |
| **WAITER** | Order taker | Create orders, add items, take payments |
| **CHEF** | Kitchen staff | View orders, mark items as PREPARING/READY |
| **CASHIER** | Payment processor | Process payments, mark orders as COMPLETED |

---

## 3. Data Models & Relationships

### Restaurant (Primary Entity)
```
Restaurant
├── _id (ObjectId) - Primary Key
├── name (String)
├── location, phone, email
├── maxTables (Number)
├── gstPercentage (Number)
└── status (ACTIVE/INACTIVE/CLOSED)
```

### MenuItem (Foreign Key: restaurantId)
```
MenuItem
├── _id (ObjectId)
├── name, description, price
├── category (APPETIZER|MAIN_COURSE|DESSERT|BEVERAGE|SIDES)
├── restaurantId (Foreign Key → Restaurant._id)
├── isAvailable (Boolean)
├── preparationTime (Number in minutes)
└── fulfillmentOwner (KITCHEN|WAITER)
```

### Order (Foreign Key: restaurantId, createdBy)
```
Order
├── _id (ObjectId)
├── tableNumber (Number)
├── restaurantId (Foreign Key → Restaurant._id)
├── status (PENDING|PREPARING|READY|SERVED|COMPLETED|CANCELLED)
├── createdBy (Foreign Key → User._id)
├── totalAmount, gst, discount
├── paymentStatus (PENDING|COMPLETED|CANCELLED)
└── timestamps
```

### OrderItem (Foreign Key: orderId, menuItemId)
```
OrderItem
├── _id (ObjectId)
├── orderId (Foreign Key → Order._id)
├── menuItemId (Foreign Key → MenuItem._id)
├── quantity (Number)
├── unitPrice (Number)
├── specialInstructions (String)
└── status (PENDING|PREPARING|READY|SERVED|CANCELLED)
```

### User (Foreign Key: restaurantId)
```
User
├── _id (ObjectId)
├── name, email, password, phone
├── role (MAIN_ADMIN|RESTAURANT_ADMIN|WAITER|CHEF|CASHIER)
├── restaurantId (Foreign Key → Restaurant._id) [null for MAIN_ADMIN]
├── isActive (Boolean)
└── timestamps
```

---

## 4. Current Order Workflow

### Step 1: WAITER Creates Order
- Waiter logs in → `/waiter` page
- Selects restaurant & table number
- Creates order (Order status = PENDING)
- Table becomes "occupied"

### Step 2: Add Menu Items to Order
- Waiter adds items from restaurant's menu
- Each OrderItem: quantity, price, special instructions
- Order total updates automatically

### Step 3: CHEF Prepares Items
- Chef logs in → `/chef` page
- Sees all PENDING items across all tables
- Marks items as PREPARING → READY
- Waiter notified when items ready

### Step 4: WAITER Serves Items
- Waiter takes READY items to customer
- Marks order items as SERVED

### Step 5: CASHIER Processes Payment
- Cashier logs in → `/cashier` page
- Selects order & processes payment
- Order status → COMPLETED
- Table becomes "vacant"

---

## 5. Current Issues & Limitations

❌ **No Public/Guest Ordering**: All order creation requires authentication (WAITER role)
❌ **No QR Code System**: No way to generate table-specific QR codes
❌ **No Self-Service**: Customers cannot directly place orders
❌ **No Guest User Model**: No way to identify customer, phone, preferences
❌ **Table-Based Only**: Orders tied to table numbers, not customers
❌ **Authentication Required**: All routes protected by JWT token

---

## 6. What You Want to Build

### QR Code Self-Ordering System
1. **QR Code Generation**: Each table gets a unique QR code linking to:
   ```
   https://yourdomain.com/order?qr={encodedRestaurantId+TableNumber}
   ```

2. **Public Ordering Page** (NO authentication required):
   - Guest visits URL by scanning QR code
   - Sees restaurant name & logo
   - Browses menu (items, prices, descriptions)
   - Adds items to cart
   - Enters customer name & phone (optional)
   - Places order → creates Order as "GUEST" user (or anonymous)

3. **Complete Workflow**:
   ```
   QR Scan → Self-Order Page → Cart → Place Order
                                           ↓
   CHEF sees order → Prepares items → WAITER notified
                                           ↓
   WAITER delivers → Customer gets item → CASHIER processes payment
                                           ↓
                                    Order COMPLETED
   ```

---

## 7. Implementation Plan (What We Need To Do)

### Backend Changes:
1. **Create Guest User Model** (or modify User)
   - Add `isGuest: Boolean` flag
   - Allow email/phone without requiring password

2. **Create Public Order Routes** (NO authentication):
   - `GET /api/public/restaurant/:id` - Get restaurant info
   - `GET /api/public/restaurant/:id/menu` - Get menu items
   - `POST /api/public/orders` - Create order (no auth required)
   - Order.createdBy = guest user or null
   - Order.status = PENDING (goes directly to kitchen/waiter)

3. **Modify Order Model**:
   - Add `customerName` (String)
   - Add `customerPhone` (String)
   - Add `guestEmail` (String, optional)
   - Keep `createdBy` but make it optional for guests

4. **Add QR Code Generation**:
   - Endpoint to generate QR for each table
   - QR encodes: restaurantId + tableNumber
   - Store QR in database or generate on-the-fly

### Frontend Changes:
1. **Create Public Ordering Page**:
   - `/order/:restaurantId/:tableNumber` OR `/order?qr=encoded`
   - No login required
   - Shows restaurant branding
   - Browse menu by category
   - Add to cart
   - Enter name & phone
   - Submit order

2. **Modify Existing Pages**:
   - CHEF page: Show both staff orders AND guest orders
   - WAITER page: Filter/manage guest orders
   - CASHIER page: Process guest orders

3. **Add Restaurant QR Management**:
   - `/restaurant/qr-codes` - View/download/print QR codes for all tables
   - Generate QR codes for all tables

---

## 8. Ready for Implementation?

Before proceeding, confirm:
- ✅ Understanding of data relationships (Restaurant → Menu → Order → OrderItem)
- ✅ Understand role-based workflow (Waiter → Chef → Waiter → Cashier)
- ✅ Current system has authentication on ALL routes
- ✅ Need to create PUBLIC routes for guest ordering
- ✅ QR code should link to a page that doesn't require login
- ✅ Guest orders must flow through SAME chef/waiter/cashier workflow

**Question**: Should guests also be able to track their order status in real-time?
**Question**: Should the system assign a unique order ID to guests for tracking?
**Question**: Do you want payment processing through the app or at the counter?

