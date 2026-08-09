# 🍽️ Restaurant Management System - Backend

A production-ready Restaurant Management System backend built with **Node.js, Express.js, MongoDB, and JWT authentication**. This system supports multi-restaurant operations with comprehensive order management, billing, and role-based access control.

## ✨ Key Features

- 🔐 **JWT Authentication** with bcrypt password hashing
- 👥 **Role-Based Access Control** with 5 distinct roles
- 🏪 **Multi-Restaurant Support** with data isolation
- 📝 **Complete Order Lifecycle** management
- 💳 **Payment Processing** with GST calculation
- 🔍 **Advanced Filtering & Pagination**
- 📊 **Sales Reports** and Analytics
- 🛡️ **Secure API** with comprehensive error handling
- 📝 **Detailed Logging** system
- ✅ **Input Validation** using express-validator

## 🛠️ Technology Stack

| Technology | Purpose |
|-----------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB** | NoSQL database |
| **Mongoose** | ODM |
| **JWT** | Authentication |
| **bcryptjs** | Password hashing |
| **express-validator** | Input validation |
| **morgan** | HTTP logging |
| **cors** | Cross-origin requests |

## 📋 System Architecture

### User Roles

```
┌─────────────────────────────────────────────┐
│             MAIN_ADMIN                      │
│  (Manages all restaurants & system)         │
└────┬────────────────────────────────────────┘
     │
     ├─→ RESTAURANT_ADMIN
     │   (Manages single restaurant)
     │
     ├─→ WAITER
     │   (Creates orders & adds items)
     │
     ├─→ CHEF
     │   (Prepares orders)
     │
     └─→ CASHIER
         (Processes payments)
```

### Data Model

```
Restaurant (1) ──→ (Many) User
    │                  │
    ├─→ (Many) MenuItem
    ├─→ (Many) Order ──→ (Many) OrderItem
    └─→ (Many) Payment
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14+)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone/Navigate to project**
```bash
cd BackEnd
```

2. **Install dependencies**
```bash
npm install
```

3. **Create .env file**
```bash
cp .env.example .env
```

4. **Configure environment variables**
```env
MONGO_URI=mongodb://localhost:27017/restaurant_db
JWT_SECRET=your_secure_key_here
PORT=5000
NODE_ENV=development
```

5. **Seed database (optional)**
```bash
npm run seed
```

6. **Start server**
```bash
npm start
```

Server will be running on `http://localhost:5000`

## 📡 API Overview

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/me` - Get current user

### Restaurants
- `GET /api/restaurants` - List all restaurants
- `POST /api/restaurants` - Create restaurant
- `GET /api/restaurants/:id` - Get restaurant details
- `PUT /api/restaurants/:id` - Update restaurant
- `DELETE /api/restaurants/:id` - Delete restaurant

### Menu
- `GET /api/menu/restaurant/:restaurantId` - Get menu items
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item

### Orders
- `GET /api/orders/restaurant/:restaurantId` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/items` - Add item to order
- `PUT /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id/items/:itemId` - Remove item

### Payments
- `GET /api/payments/restaurant/:restaurantId` - List payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id/status` - Update payment status
- `POST /api/payments/:id/refund` - Refund payment
- `GET /api/payments/restaurant/:id/daily-report` - Sales report

### Users
- `GET /api/users` - List all users
- `GET /api/users/restaurant/:restaurantId` - List restaurant users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🧪 Testing with Sample Data

### Login with test credentials

```bash
# MAIN_ADMIN
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@restaurant.com",
    "password": "admin@123"
  }'

# WAITER
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.waiter@restaurant.com",
    "password": "waiter@123"
  }'

# CHEF
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chef.michael@restaurant.com",
    "password": "chef@123"
  }'

# CASHIER
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "david.cashier@restaurant.com",
    "password": "cashier@123"
  }'
```

## 📁 Project Structure

```
BackEnd/
├── config/
│   └── database.js                 # MongoDB connection config
├── models/                         # Mongoose schemas
│   ├── User.js
│   ├── Restaurant.js
│   ├── MenuItem.js
│   ├── Order.js
│   ├── OrderItem.js
│   ├── Payment.js
│   └── SystemSettings.js
├── services/                       # Business logic
│   ├── authService.js
│   ├── restaurantService.js
│   ├── menuService.js
│   ├── orderService.js
│   ├── paymentService.js
│   └── userService.js
├── controllers/                    # Request handlers
│   ├── authController.js
│   ├── restaurantController.js
│   ├── menuController.js
│   ├── orderController.js
│   ├── paymentController.js
│   └── userController.js
├── routes/                         # API routes
│   ├── authRoutes.js
│   ├── restaurantRoutes.js
│   ├── menuRoutes.js
│   ├── orderRoutes.js
│   ├── paymentRoutes.js
│   └── userRoutes.js
├── middlewares/                    # Custom middleware
│   ├── authenticate.js             # JWT verification
│   ├── authorize.js                # Role-based access
│   ├── errorHandler.js             # Error handling
│   └── validateRestaurantOwnership.js
├── utils/
│   ├── logger.js                   # Logging
│   ├── responseHandler.js          # Response formatting
│   └── constants.js                # Constants
├── validators/
│   └── index.js                    # Input validation rules
├── .env                            # Environment variables
├── server.js                       # Entry point
├── seed.js                         # Database seeding
├── package.json
└── API_DOCUMENTATION.md            # Detailed API docs
```

## 🔐 Security Features

- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Bcrypt Hashing** - Industry-standard password hashing (10 salt rounds)
- ✅ **Role-Based Access Control** - Granular permission system
- ✅ **Data Isolation** - Multi-tenant security with restaurantId validation
- ✅ **Input Validation** - All inputs validated before processing
- ✅ **Error Handling** - Sensitive data never exposed in errors
- ✅ **CORS Protection** - Configured for secure cross-origin requests
- ✅ **Audit Logging** - All activities logged with timestamp

## 🔄 Order Workflow

```
1. WAITER creates order (PENDING)
   ↓
2. CHEF updates status:
   PENDING → PREPARING → READY
   ↓
3. WAITER marks as SERVED
   ↓
4. CASHIER processes payment
   ↓
5. CASHIER marks order COMPLETED
```

## 📊 Database Collections

### Users
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String,
  restaurantId: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Orders
```javascript
{
  tableNumber: Number,
  restaurantId: ObjectId,
  status: String,
  createdBy: ObjectId,
  totalAmount: Number,
  gst: Number,
  discount: Number,
  paymentStatus: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Payments
```javascript
{
  orderId: ObjectId,
  restaurantId: ObjectId,
  subtotal: Number,
  gstAmount: Number,
  totalAmount: Number,
  paymentMethod: String,
  status: String,
  paidAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🚨 Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

## 📈 Performance Optimization

- ✅ **Database Indexing** - Indexes on `restaurantId`, `status`, `createdAt`
- ✅ **Pagination** - Built-in pagination with configurable limits
- ✅ **Lean Queries** - Using Mongoose lean() for read operations
- ✅ **Connection Pooling** - MongoDB connection pooling enabled
- ✅ **Early Validation** - Input validation before processing

## 📝 Logging

Logs are stored in `/logs` directory:
- `app.log` - General application logs
- `error.log` - Error logs
- Console output for development

## 🔧 Configuration

### Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017/restaurant_db

# JWT
JWT_SECRET=your_secret_key

# Server
PORT=5000
NODE_ENV=development
```

## 🧪 Sample API Requests

### Create Order Flow

1. **Login as Waiter**
```bash
POST /api/auth/login
{
  "email": "john.waiter@restaurant.com",
  "password": "waiter@123"
}
```

2. **Create Order**
```bash
POST /api/orders
Authorization: Bearer <TOKEN>
{
  "tableNumber": 5,
  "restaurantId": "507f1f77bcf86cd799439011",
  "createdBy": "507f1f77bcf86cd799439012"
}
```

3. **Add Items**
```bash
POST /api/orders/ORDER_ID/items
Authorization: Bearer <TOKEN>
{
  "menuItemId": "507f1f77bcf86cd799439013",
  "quantity": 2
}
```

4. **Process as Chef**
```bash
PUT /api/orders/ORDER_ID/status
Authorization: Bearer CHEF_TOKEN
{
  "status": "PREPARING"
}
```

5. **Process Payment as Cashier**
```bash
POST /api/payments
Authorization: Bearer CASHIER_TOKEN
{
  "orderId": "ORDER_ID",
  "restaurantId": "507f1f77bcf86cd799439011",
  "subtotal": 100,
  "paymentMethod": "CASH"
}
```

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Check:
- MongoDB is running
- MONGO_URI is correct
- Network connectivity
```

### Token Expired
```
Solution:
- Re-login to get new token
- Tokens expire after 7 days
```

### Permission Denied
```
Check:
- User has required role
- User belongs to correct restaurant
- Request headers include Authorization
```

## 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Detailed API reference
- **[Database Schema](./models/)** - Mongoose models
- **[Sample Requests](./API_DOCUMENTATION.md#-sample-test-credentials)** - Test data and examples

## 🚀 Deployment

### Pre-deployment Checklist
- [ ] Change JWT_SECRET
- [ ] Update MONGO_URI to production DB
- [ ] Set NODE_ENV=production
- [ ] Configure HTTPS
- [ ] Set up environment variables securely
- [ ] Enable database backups
- [ ] Configure rate limiting
- [ ] Set up monitoring

### Docker (Optional)
```bash
docker build -t restaurant-backend .
docker run -p 5000:5000 restaurant-backend
```

## 📞 Support & Issues

For issues, check:
1. Server logs in `/logs` directory
2. .env configuration
3. MongoDB connection
4. User permissions

## 📄 License

This project is licensed under ISC License.

## 👨‍💼 Author

Built with ❤️ for Restaurant Management

---

**Status**: ✅ Production Ready
**Last Updated**: May 2, 2024
**Version**: 1.0.0
