# 📂 Restaurant Management System - Project Structure

## 🎯 Complete File Organization

```
BackEnd/
│
├── 📄 COMPLETION_SUMMARY.md          ← Project completion details
├── 📄 API_DOCUMENTATION.md           ← Complete API reference (40+ endpoints)
├── 📄 QUICK_START.md                 ← 5-minute setup guide
├── 📄 README.md                      ← Full project documentation
│
├── 📦 package.json                   ← Node dependencies & scripts
├── ⚙️  .env                          ← Environment variables
├── 🚫 .gitignore                     ← Git ignore patterns
│
├── 🖥️  server.js                     ← Express app entry point
├── 🌱 seed.js                        ← Database seeding script
│
├── 📁 config/
│   └── database.js                   ← MongoDB connection setup
│
├── 📁 models/ (7 Schemas)
│   ├── User.js                       ← User with roles & restaurants
│   ├── Restaurant.js                 ← Restaurant management
│   ├── MenuItem.js                   ← Menu items per restaurant
│   ├── Order.js                      ← Order tracking
│   ├── OrderItem.js                  ← Order line items
│   ├── Payment.js                    ← Payment processing
│   └── SystemSettings.js             ← Global configuration
│
├── 📁 services/ (6 Business Logic Services)
│   ├── authService.js                ← Auth, login, signup, tokens
│   ├── restaurantService.js          ← Restaurant CRUD
│   ├── menuService.js                ← Menu item management
│   ├── orderService.js               ← Order lifecycle
│   ├── paymentService.js             ← Payment & billing
│   └── userService.js                ← User management
│
├── 📁 controllers/ (6 Request Handlers)
│   ├── authController.js             ← Auth endpoints
│   ├── restaurantController.js       ← Restaurant handlers
│   ├── menuController.js             ← Menu handlers
│   ├── orderController.js            ← Order handlers
│   ├── paymentController.js          ← Payment handlers
│   └── userController.js             ← User handlers
│
├── 📁 routes/ (6 Route Groups)
│   ├── authRoutes.js                 ← /api/auth/*
│   ├── restaurantRoutes.js           ← /api/restaurants/*
│   ├── menuRoutes.js                 ← /api/menu/*
│   ├── orderRoutes.js                ← /api/orders/*
│   ├── paymentRoutes.js              ← /api/payments/*
│   └── userRoutes.js                 ← /api/users/*
│
├── 📁 middlewares/ (4 Custom Middlewares)
│   ├── authenticate.js               ← JWT verification
│   ├── authorize.js                  ← Role-based access control
│   ├── errorHandler.js               ← Global error handling
│   └── validateRestaurantOwnership.js ← Data isolation validation
│
├── 📁 utils/ (3 Helper Utilities)
│   ├── logger.js                     ← File-based logging
│   ├── responseHandler.js            ← Standard response formatting
│   └── constants.js                  ← Application constants
│
├── 📁 validators/
│   └── index.js                      ← Input validation rules
│
└── 📁 logs/ (Generated at runtime)
    ├── app.log                       ← Application logs
    └── error.log                     ← Error logs
```

---

## 📊 Statistics

| Component | Count |
|-----------|-------|
| **Models** | 7 |
| **Services** | 6 |
| **Controllers** | 6 |
| **Routes** | 6 |
| **Middleware** | 4 |
| **Utilities** | 3 |
| **API Endpoints** | 40+ |
| **Total .js Files** | 36+ |
| **Documentation Files** | 4 |

---

## 🔄 Data Flow Architecture

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│   authenticate.js    │ ← Verify JWT Token
│   (Middleware)       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   authorize.js       │ ← Check Role Permissions
│   (Middleware)       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   validators/index.js│ ← Validate Request Data
│   (Middleware)       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Controller           │ ← Request Handler
│ (e.g., orderController)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Service              │ ← Business Logic
│ (e.g., orderService) │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Model                │ ← Database Query
│ (e.g., Order)        │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   MongoDB            │ ← Data Storage
│   Database           │
└──────────────────────┘
         │
         ├─→ Response
         │
         ▼
┌──────────────────────┐
│ responseHandler.js   │ ← Format Response
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   Client/Response    │ ← JSON Response
└──────────────────────┘
```

---

## 📡 API Routes Structure

```
/api/
│
├── /auth                           (3 endpoints)
│   ├── POST   /login               ← User login
│   ├── POST   /signup              ← User registration
│   └── GET    /me                  ← Get current user
│
├── /restaurants                    (5 endpoints)
│   ├── POST   /                    ← Create restaurant
│   ├── GET    /                    ← List restaurants
│   ├── GET    /:id                 ← Get restaurant
│   ├── PUT    /:id                 ← Update restaurant
│   └── DELETE /:id                 ← Delete restaurant
│
├── /menu                           (6 endpoints)
│   ├── POST   /                    ← Create menu item
│   ├── GET    /restaurant/:rid      ← Get menu items
│   ├── GET    /restaurant/:rid/category/:cat
│   ├── GET    /:id                 ← Get menu item
│   ├── PUT    /:id                 ← Update menu item
│   └── DELETE /:id                 ← Delete menu item
│
├── /orders                         (7 endpoints)
│   ├── POST   /                    ← Create order
│   ├── GET    /restaurant/:rid      ← Get orders
│   ├── GET    /:id                 ← Get order details
│   ├── POST   /:oid/items          ← Add item to order
│   ├── PUT    /:id/status          ← Update status
│   ├── DELETE /:oid/items/:iid     ← Remove item
│   └── PUT    /:id/complete        ← Complete order
│
├── /payments                       (6 endpoints)
│   ├── POST   /                    ← Create payment
│   ├── GET    /restaurant/:rid      ← Get payments
│   ├── GET    /:id                 ← Get payment details
│   ├── PUT    /:id/status          ← Update status
│   ├── POST   /:id/refund          ← Refund payment
│   └── GET    /restaurant/:rid/daily-report
│
└── /users                          (7 endpoints)
    ├── GET    /                    ← List all users
    ├── GET    /restaurant/:rid      ← Get restaurant users
    ├── GET    /:id                 ← Get user details
    ├── PUT    /:id                 ← Update user
    ├── PUT    /:id/deactivate      ← Deactivate user
    ├── PUT    /:id/activate        ← Activate user
    └── DELETE /:id                 ← Delete user
```

---

## 🔐 Role-Based Access Control

```
┌──────────────────────────────────────────┐
│          MAIN_ADMIN                      │
│  (Manage all restaurants & system)       │
└─────────────────┬────────────────────────┘
      Can access all endpoints

┌──────────────────────────────────────────┐
│      RESTAURANT_ADMIN                    │
│  (Manage single restaurant)              │
└─────────────────┬────────────────────────┘
      Can:
      - View own restaurant
      - Manage menu items
      - Manage own staff
      - View orders & reports
      Cannot:
      - Access other restaurants
      - Manage other admins

┌──────────────────────────────────────────┐
│            WAITER                        │
│  (Create orders & add items)             │
└─────────────────┬────────────────────────┘
      Can:
      - Create orders
      - Add items to orders
      - Remove items
      - View menu
      - View order status
      Cannot:
      - Modify prices
      - Access payments
      - Manage users

┌──────────────────────────────────────────┐
│             CHEF                         │
│  (Prepare orders)                        │
└─────────────────┬────────────────────────┘
      Can:
      - View orders
      - Update to PREPARING
      - Update to READY
      - View order details
      Cannot:
      - Create orders
      - Process payments
      - Manage users

┌──────────────────────────────────────────┐
│            CASHIER                       │
│  (Process payments & billing)            │
└─────────────────┬────────────────────────┘
      Can:
      - View completed orders
      - Create payments
      - Update payment status
      - Process refunds
      - View transaction history
      Cannot:
      - Modify orders
      - Manage menu
      - Manage users
```

---

## 📝 Key File Responsibilities

### Core Files
| File | Purpose |
|------|---------|
| `server.js` | Sets up Express app, middleware, routes |
| `seed.js` | Populates DB with sample data |
| `.env` | Stores configuration variables |

### Configuration
| File | Purpose |
|------|---------|
| `config/database.js` | Manages MongoDB connection |

### Models (Database Schemas)
| File | Purpose |
|------|---------|
| `models/User.js` | User schema with password hashing |
| `models/Restaurant.js` | Restaurant details & addresses |
| `models/MenuItem.js` | Menu items with pricing & categories |
| `models/Order.js` | Orders with status tracking |
| `models/OrderItem.js` | Line items in orders |
| `models/Payment.js` | Payment records with GST |
| `models/SystemSettings.js` | Global system configuration |

### Services (Business Logic)
| File | Purpose |
|------|---------|
| `services/authService.js` | Authentication & token management |
| `services/restaurantService.js` | Restaurant CRUD operations |
| `services/menuService.js` | Menu item management & filtering |
| `services/orderService.js` | Order lifecycle & item handling |
| `services/paymentService.js` | Payment processing & reporting |
| `services/userService.js` | User management & activation |

### Controllers (Request Handlers)
| File | Purpose |
|------|---------|
| `controllers/authController.js` | Handles auth requests |
| `controllers/restaurantController.js` | Handles restaurant requests |
| `controllers/menuController.js` | Handles menu requests |
| `controllers/orderController.js` | Handles order requests |
| `controllers/paymentController.js` | Handles payment requests |
| `controllers/userController.js` | Handles user requests |

### Routes (API Endpoints)
| File | Purpose |
|------|---------|
| `routes/authRoutes.js` | Auth endpoints (/api/auth/*) |
| `routes/restaurantRoutes.js` | Restaurant endpoints (/api/restaurants/*) |
| `routes/menuRoutes.js` | Menu endpoints (/api/menu/*) |
| `routes/orderRoutes.js` | Order endpoints (/api/orders/*) |
| `routes/paymentRoutes.js` | Payment endpoints (/api/payments/*) |
| `routes/userRoutes.js` | User endpoints (/api/users/*) |

### Middleware
| File | Purpose |
|------|---------|
| `middlewares/authenticate.js` | Verifies JWT tokens |
| `middlewares/authorize.js` | Checks role-based permissions |
| `middlewares/errorHandler.js` | Global error handling |
| `middlewares/validateRestaurantOwnership.js` | Validates data access |

### Utilities
| File | Purpose |
|------|---------|
| `utils/logger.js` | File-based logging system |
| `utils/responseHandler.js` | Formats standardized responses |
| `utils/constants.js` | Application-wide constants |
| `validators/index.js` | Input validation rules |

---

## 🚀 Execution Flow Example: Creating an Order

```
1. CLIENT REQUEST
   POST /api/orders
   {
     "tableNumber": 5,
     "restaurantId": "...",
     "createdBy": "..."
   }
   
2. MIDDLEWARE CHAIN
   → authenticate.js: Verify JWT token
   → authorize.js: Check WAITER role
   → validators/index.js: Validate input
   
3. CONTROLLER
   → orderController.createOrder()
   
4. SERVICE
   → orderService.createOrder()
   
5. MODEL
   → Order.create()
   → MongoDB: Insert document
   
6. RESPONSE FORMATTING
   → responseHandler.sendSuccess()
   
7. CLIENT RESPONSE
   {
     "success": true,
     "message": "Order created successfully",
     "data": {
       "_id": "...",
       "tableNumber": 5,
       "status": "PENDING",
       ...
     }
   }
```

---

## 🔗 Database Relationships

```
┌─────────────────┐
│   User          │
│ (5 roles)       │
└────────┬────────┘
         │ restaurantId
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Restaurant     │◄─────│  MenuItem       │
│  (Main entity)  │      │  (Per rest.)    │
└────────┬────────┘      └─────────────────┘
         │
         ├─→┌─────────────────┐
         │  │     Order       │
         │  │ (Per rest.)     │
         │  └────────┬────────┘
         │           │
         │           ▼
         │  ┌─────────────────┐
         │  │   OrderItem     │
         │  │ (Order lines)   │
         │  └─────────────────┘
         │
         └─→┌─────────────────┐
            │    Payment      │
            │ (Per rest.)     │
            └─────────────────┘
```

---

## 📈 Scalability Features

✅ **Database Indexing** - On restaurantId, status, dates
✅ **Pagination** - Handle large datasets
✅ **Lean Queries** - Optimize read operations
✅ **Connection Pooling** - Efficient DB connections
✅ **Data Isolation** - Multi-tenant separation
✅ **Error Handling** - Prevent cascading failures
✅ **Logging** - Monitor performance

---

**Generated**: May 2, 2024  
**Status**: ✅ Complete
