# Restaurant Management System - Backend API Documentation

## 🚀 Overview

This is a production-ready **Restaurant Management System (RMS)** backend built with Node.js, Express.js, MongoDB, and JWT authentication. It supports multi-restaurant operations with strict role-based access control (RBAC).

---

## ✨ Features

✅ **JWT-based Authentication** with bcrypt password hashing
✅ **Role-Based Access Control (RBAC)** - 5 roles with granular permissions
✅ **Multi-Restaurant Support** - Isolated data per restaurant
✅ **Complete Order Lifecycle** - From creation to payment
✅ **Secure Payment Processing** with GST calculation
✅ **Comprehensive Logging** - Track all system activities
✅ **Input Validation** - Using express-validator
✅ **Global Error Handling** - Centralized error management
✅ **Pagination & Filtering** - Optimized data retrieval

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v14+)
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: express-validator
- **Utilities**: dotenv, cors, morgan

---

## 📁 Project Structure

```
BackEnd/
├── config/
│   └── database.js              # MongoDB connection
├── models/
│   ├── User.js                  # User schema with role-based design
│   ├── Restaurant.js            # Restaurant details
│   ├── MenuItem.js              # Menu items per restaurant
│   ├── Order.js                 # Order management
│   ├── OrderItem.js             # Order line items
│   ├── Payment.js               # Payment processing
│   └── SystemSettings.js        # Global system configuration
├── services/
│   ├── authService.js           # Authentication logic
│   ├── restaurantService.js     # Restaurant management
│   ├── menuService.js           # Menu management
│   ├── orderService.js          # Order processing
│   ├── paymentService.js        # Payment handling
│   └── userService.js           # User management
├── controllers/
│   ├── authController.js        # Auth request handlers
│   ├── restaurantController.js  # Restaurant handlers
│   ├── menuController.js        # Menu handlers
│   ├── orderController.js       # Order handlers
│   ├── paymentController.js     # Payment handlers
│   └── userController.js        # User handlers
├── routes/
│   ├── authRoutes.js            # Authentication endpoints
│   ├── restaurantRoutes.js      # Restaurant endpoints
│   ├── menuRoutes.js            # Menu endpoints
│   ├── orderRoutes.js           # Order endpoints
│   ├── paymentRoutes.js         # Payment endpoints
│   └── userRoutes.js            # User endpoints
├── middlewares/
│   ├── authenticate.js          # JWT verification
│   ├── authorize.js             # Role-based authorization
│   ├── errorHandler.js          # Global error handling
│   └── validateRestaurantOwnership.js  # Restaurant access validation
├── utils/
│   ├── logger.js                # Logging utility
│   ├── responseHandler.js       # Standard response formatting
│   └── constants.js             # Application constants
├── validators/
│   └── index.js                 # Request validation rules
├── .env                         # Environment variables
├── server.js                    # Main application entry point
├── seed.js                      # Database seeding script
└── package.json                 # Dependencies configuration
```

---

## 🔐 User Roles & Permissions

### 1. **MAIN_ADMIN** (Master Admin)
- Manage all restaurants
- Create/update/delete restaurant staff
- Configure system settings
- View analytics and reports
- Override operations

### 2. **RESTAURANT_ADMIN** (Restaurant Manager)
- Manage own restaurant's menu
- Manage own restaurant's staff
- View restaurant orders and reports
- Cannot access other restaurants

### 3. **WAITER** (Service Staff)
- Create new orders
- Add/remove items from orders
- View menu
- Track order status

### 4. **CHEF** (Kitchen Staff)
- View pending orders
- Update order status (PENDING → PREPARING → READY)
- View order details and special instructions

### 5. **CASHIER** (Billing Staff)
- View completed orders
- Generate bills
- Process payments
- Process refunds
- View transaction history

---

## ⚙️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/restaurant_db

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_key_here

# Server Port
PORT=5000

# Environment
NODE_ENV=development
```

### 3. Seed Database (Optional)

Populate sample data:

```bash
npm run seed
```

### 4. Start Server

```bash
npm start
```

The server will start on `http://localhost:5000`

---

## 📡 API Endpoints

### Base URL
```
http://localhost:5000/api
```

---

## 🔑 Authentication Endpoints

### 1. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@restaurant.com",
  "password": "admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Admin Master",
      "email": "admin@restaurant.com",
      "role": "MAIN_ADMIN",
      "restaurantId": null
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@restaurant.com",
  "password": "secure@123",
  "role": "WAITER",
  "restaurantId": "507f1f77bcf86cd799439011"
}
```

### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <TOKEN>
```

---

## 🏪 Restaurant Endpoints

### 1. Create Restaurant (MAIN_ADMIN only)
```http
POST /api/restaurants
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "The Golden Fork",
  "location": "Downtown Plaza",
  "description": "Premium fine dining",
  "phone": "+1-555-0101",
  "email": "golden.fork@restaurant.com",
  "maxTables": 25,
  "address": {
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

### 2. Get All Restaurants (MAIN_ADMIN only)
```http
GET /api/restaurants?page=1&limit=10&status=ACTIVE
Authorization: Bearer <TOKEN>
```

### 3. Get Restaurant by ID
```http
GET /api/restaurants/:restaurantId
Authorization: Bearer <TOKEN>
```

### 4. Update Restaurant
```http
PUT /api/restaurants/:restaurantId
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "The Golden Fork Updated",
  "status": "ACTIVE"
}
```

### 5. Delete Restaurant (MAIN_ADMIN only)
```http
DELETE /api/restaurants/:restaurantId
Authorization: Bearer <TOKEN>
```

---

## 🍽️ Menu Endpoints

### 1. Create Menu Item (RESTAURANT_ADMIN)
```http
POST /api/menu
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Grilled Salmon",
  "description": "Fresh Atlantic salmon with herbs",
  "price": 32.99,
  "category": "MAIN_COURSE",
  "restaurantId": "507f1f77bcf86cd799439011",
  "isAvailable": true,
  "preparationTime": 20
}
```

### 2. Get Menu Items by Restaurant
```http
GET /api/menu/restaurant/:restaurantId?page=1&limit=20&category=MAIN_COURSE
Authorization: Bearer <TOKEN>
```

### 3. Get Menu by Category
```http
GET /api/menu/restaurant/:restaurantId/category/APPETIZER
Authorization: Bearer <TOKEN>
```

### 4. Get Menu Item by ID
```http
GET /api/menu/:menuItemId
Authorization: Bearer <TOKEN>
```

### 5. Update Menu Item
```http
PUT /api/menu/:menuItemId
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "price": 35.99,
  "isAvailable": true
}
```

### 6. Delete Menu Item
```http
DELETE /api/menu/:menuItemId
Authorization: Bearer <TOKEN>
```

---

## 📝 Order Endpoints

### 1. Create Order (WAITER)
```http
POST /api/orders
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "tableNumber": 5,
  "restaurantId": "507f1f77bcf86cd799439011",
  "createdBy": "507f1f77bcf86cd799439012",
  "notes": "No onions please"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "tableNumber": 5,
    "status": "PENDING",
    "totalAmount": 0,
    "createdAt": "2024-05-02T10:30:00Z"
  }
}
```

### 2. Get Orders by Restaurant
```http
GET /api/orders/restaurant/:restaurantId?page=1&limit=20&status=PENDING
Authorization: Bearer <TOKEN>
```

### 3. Get Order with Items
```http
GET /api/orders/:orderId
Authorization: Bearer <TOKEN>
```

### 4. Add Item to Order (WAITER)
```http
POST /api/orders/:orderId/items
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "menuItemId": "507f1f77bcf86cd799439014",
  "quantity": 2,
  "specialInstructions": "Medium rare"
}
```

### 5. Update Order Status
```http
PUT /api/orders/:orderId/status
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "status": "PREPARING"
}
```

**Status Flow:**
- WAITER creates order → `PENDING`
- CHEF updates → `PREPARING` → `READY`
- CASHIER marks → `SERVED` → `COMPLETED`

### 6. Remove Item from Order
```http
DELETE /api/orders/:orderId/items/:itemId
Authorization: Bearer <TOKEN>
```

### 7. Complete Order
```http
PUT /api/orders/:orderId/complete
Authorization: Bearer <TOKEN>
```

---

## 💳 Payment Endpoints

### 1. Create Payment (CASHIER)
```http
POST /api/payments
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "orderId": "507f1f77bcf86cd799439013",
  "restaurantId": "507f1f77bcf86cd799439011",
  "subtotal": 100,
  "discount": 10,
  "paymentMethod": "CASH"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439015",
    "orderId": "507f1f77bcf86cd799439013",
    "subtotal": 100,
    "gstPercentage": 5,
    "gstAmount": 4.5,
    "totalAmount": 94.5,
    "paymentMethod": "CASH",
    "status": "PENDING"
  }
}
```

### 2. Get Payments by Restaurant
```http
GET /api/payments/restaurant/:restaurantId?page=1&limit=20&status=COMPLETED
Authorization: Bearer <TOKEN>
```

### 3. Get Payment by ID
```http
GET /api/payments/:paymentId
Authorization: Bearer <TOKEN>
```

### 4. Update Payment Status
```http
PUT /api/payments/:paymentId/status
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

### 5. Refund Payment
```http
POST /api/payments/:paymentId/refund
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "reason": "Customer requested refund"
}
```

### 6. Get Daily Sales Report
```http
GET /api/payments/restaurant/:restaurantId/daily-report?date=2024-05-02
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "Sales report fetched successfully",
  "data": {
    "date": "2024-05-02",
    "totalSales": 1250.50,
    "totalGST": 62.53,
    "totalTransactions": 12,
    "payments": [...]
  }
}
```

---

## 👥 User Endpoints

### 1. Get All Users (MAIN_ADMIN)
```http
GET /api/users?page=1&limit=20&role=WAITER&isActive=true
Authorization: Bearer <TOKEN>
```

### 2. Get Users by Restaurant
```http
GET /api/users/restaurant/:restaurantId?page=1&limit=20
Authorization: Bearer <TOKEN>
```

### 3. Get User by ID
```http
GET /api/users/:userId
Authorization: Bearer <TOKEN>
```

### 4. Update User
```http
PUT /api/users/:userId
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.updated@restaurant.com"
}
```

### 5. Deactivate User
```http
PUT /api/users/:userId/deactivate
Authorization: Bearer <TOKEN>
```

### 6. Activate User
```http
PUT /api/users/:userId/activate
Authorization: Bearer <TOKEN>
```

### 7. Delete User (MAIN_ADMIN)
```http
DELETE /api/users/:userId
Authorization: Bearer <TOKEN>
```

---

## 🧪 Sample Test Credentials

After running `npm run seed`, use these credentials:

### MAIN_ADMIN
```
Email: admin@restaurant.com
Password: admin@123
```

### RESTAURANT_ADMIN (Golden Fork)
```
Email: manager.golden@restaurant.com
Password: manager@123
```

### WAITER (Golden Fork)
```
Email: john.waiter@restaurant.com
Password: waiter@123
```

### CHEF (Golden Fork)
```
Email: chef.michael@restaurant.com
Password: chef@123
```

### CASHIER (Golden Fork)
```
Email: david.cashier@restaurant.com
Password: cashier@123
```

---

## 🔄 Complete Order Workflow Example

### Step 1: Login as Waiter
```bash
POST /api/auth/login
{
  "email": "john.waiter@restaurant.com",
  "password": "waiter@123"
}
```
Get token: `YOUR_TOKEN`

### Step 2: Create Order
```bash
POST /api/orders
Authorization: Bearer YOUR_TOKEN
{
  "tableNumber": 5,
  "restaurantId": "RESTAURANT_ID",
  "createdBy": "WAITER_ID",
  "notes": "VIP Customer"
}
```
Get orderId: `ORDER_ID`

### Step 3: Add Items to Order
```bash
POST /api/orders/ORDER_ID/items
Authorization: Bearer YOUR_TOKEN
{
  "menuItemId": "MENU_ITEM_ID",
  "quantity": 2
}
```

### Step 4: Chef Updates Order Status
```bash
# Login as Chef
POST /api/auth/login
{
  "email": "chef.michael@restaurant.com",
  "password": "chef@123"
}

# Update to PREPARING
PUT /api/orders/ORDER_ID/status
Authorization: Bearer CHEF_TOKEN
{
  "status": "PREPARING"
}

# Update to READY
PUT /api/orders/ORDER_ID/status
Authorization: Bearer CHEF_TOKEN
{
  "status": "READY"
}
```

### Step 5: Cashier Processes Payment
```bash
# Login as Cashier
POST /api/auth/login
{
  "email": "david.cashier@restaurant.com",
  "password": "cashier@123"
}

# Mark order as SERVED
PUT /api/orders/ORDER_ID/status
Authorization: Bearer CASHIER_TOKEN
{
  "status": "SERVED"
}

# Create Payment
POST /api/payments
Authorization: Bearer CASHIER_TOKEN
{
  "orderId": "ORDER_ID",
  "restaurantId": "RESTAURANT_ID",
  "subtotal": 100,
  "paymentMethod": "CASH"
}

# Complete Order
PUT /api/orders/ORDER_ID/complete
Authorization: Bearer CASHIER_TOKEN
```

---

## 🚨 Error Handling

All errors return in this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

### Common Error Codes

- **400** - Bad Request / Validation Error
- **401** - Unauthorized / Invalid Token
- **403** - Forbidden / Insufficient Permissions
- **404** - Not Found
- **500** - Internal Server Error

---

## 📊 Database Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (MAIN_ADMIN | RESTAURANT_ADMIN | WAITER | CHEF | CASHIER),
  restaurantId: ObjectId,
  isActive: Boolean
}
```

### Restaurant
```javascript
{
  name: String,
  location: String,
  description: String,
  phone: String,
  email: String,
  status: String (ACTIVE | INACTIVE | CLOSED),
  maxTables: Number,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  }
}
```

### MenuItem
```javascript
{
  name: String,
  description: String,
  price: Number,
  category: String (APPETIZER | MAIN_COURSE | DESSERT | BEVERAGE | SIDES),
  restaurantId: ObjectId,
  isAvailable: Boolean,
  preparationTime: Number (minutes)
}
```

### Order
```javascript
{
  tableNumber: Number,
  restaurantId: ObjectId,
  status: String (PENDING | PREPARING | READY | SERVED | COMPLETED),
  createdBy: ObjectId,
  totalAmount: Number,
  gst: Number,
  discount: Number,
  paymentStatus: String (PENDING | COMPLETED | CANCELLED)
}
```

### Payment
```javascript
{
  orderId: ObjectId,
  restaurantId: ObjectId,
  subtotal: Number,
  gstPercentage: Number,
  gstAmount: Number,
  totalAmount: Number,
  paymentMethod: String (CASH | CARD | DIGITAL_WALLET | CHEQUE),
  status: String (PENDING | COMPLETED | FAILED | REFUNDED),
  paidAt: Date
}
```

---

## 🔒 Security Features

✅ **JWT-based Authentication** - Secure token-based authentication
✅ **Bcrypt Password Hashing** - Industry-standard password hashing
✅ **Role-Based Access Control** - Granular permission system
✅ **Restaurant Data Isolation** - Multi-tenant security
✅ **Input Validation** - All inputs validated using express-validator
✅ **CORS Protection** - Configured for production
✅ **Error Handling** - No sensitive data in error messages
✅ **Logging** - All activities logged for audit trail

---

## 📈 Performance Optimization

✅ **Database Indexing** - Indexes on frequently queried fields
✅ **Pagination** - Built-in pagination for large datasets
✅ **Lean Queries** - Using Mongoose lean() for read-only operations
✅ **Connection Pooling** - MongoDB connection pooling enabled
✅ **Request Validation** - Early validation to prevent unnecessary processing

---

## 🛠️ Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check MONGO_URI in .env file
- Verify network connectivity

### JWT Token Expired
- Re-login to get a new token
- Token expires after 7 days

### Permission Denied Error
- Check user role has required permission
- Verify restaurantId matches user's restaurant

### Validation Error
- Check request body matches schema
- Ensure all required fields are provided
- Verify data types (e.g., numbers not strings)

---

## 📝 Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random string
- [ ] Update MONGO_URI to production database
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up environment variables securely
- [ ] Enable database backups
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Review and test all security features

---

## 🤝 Contributing

For contributions or bug reports, please follow the development guidelines:

1. Create a new branch for feature
2. Write clear commit messages
3. Test thoroughly before submitting
4. Follow code style guidelines

---

## 📞 Support

For issues or questions, please refer to the documentation or check server logs in `/logs` directory.

---

**Version**: 1.0.0  
**Last Updated**: May 2, 2024  
**Status**: Production Ready ✅
