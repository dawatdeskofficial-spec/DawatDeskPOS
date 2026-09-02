# 🚀 Quick Start Guide - Restaurant Management Backend

## 5-Minute Setup

### 1. Install & Configure
```bash
cd BackEnd
npm install
```

### 2. Create .env file
```bash
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/restaurant_db
JWT_SECRET=your_jwt_secret_key_change_in_production
PORT=5000
NODE_ENV=development
EOF
```

### 3. Seed Sample Data (Optional)
```bash
npm run seed
```

This creates:
- 3 sample restaurants
- 5 test users across all roles
- 20+ sample menu items

### 4. Start Server
```bash
npm start
```

Output:
```
🚀 Server is running on http://localhost:5000
```

## 🧪 Test Immediately

### Terminal 1: Start Server
```bash
npm start
```

### Terminal 2: Test Login

**MAIN_ADMIN:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@restaurant.com",
    "password": "admin@123"
  }'
```

**WAITER:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.waiter@restaurant.com",
    "password": "waiter@123"
  }'
```

### Copy the token from response and test endpoints

**Get Current User:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/auth/me
```

**Get All Restaurants (as MAIN_ADMIN):**
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:5000/api/restaurants?page=1&limit=10"
```

**Get Menu Items:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/menu/restaurant/RESTAURANT_ID"
```

## 📋 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| MAIN_ADMIN | admin@restaurant.com | admin@123 |
| RESTAURANT_ADMIN | manager.golden@restaurant.com | manager@123 |
| WAITER | john.waiter@restaurant.com | waiter@123 |
| CHEF | chef.michael@restaurant.com | chef@123 |
| CASHIER | david.cashier@restaurant.com | cashier@123 |

## 🔍 Project Features Included

✅ JWT Authentication with 7-day expiration
✅ 5 Role Types with granular permissions
✅ Multi-Restaurant Data Isolation
✅ Complete Order Lifecycle (Pending → Complete)
✅ Payment Processing with GST Calculation
✅ Menu Management per Restaurant
✅ User Management (Create, Update, Deactivate)
✅ Sales Reports & Analytics
✅ Comprehensive Error Handling
✅ Request Validation & Security
✅ Database Indexing for Performance
✅ Pagination & Filtering
✅ Logging System
✅ 10+ API Routes Groups
✅ Seed Data with 25+ Records

## 📁 Project Structure Overview

```
BackEnd/
├── config/          → Database connection
├── models/          → 7 Mongoose schemas
├── services/        → Business logic (6 services)
├── controllers/     → Request handlers (6 controllers)
├── routes/          → API routes (6 route files)
├── middlewares/     → Auth, Authorization, Error handling
├── utils/           → Logger, Response handler, Constants
├── validators/      → Input validation rules
├── server.js        → Express app entry point
├── seed.js          → Sample data generator
├── .env             → Configuration
└── README.md        → Full documentation
```

## 🎯 Complete Order Example (Copy-Paste Ready)

### 1. Login as Waiter
```bash
WAITER_LOGIN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.waiter@restaurant.com",
    "password": "waiter@123"
  }' | jq -r '.data.token')

echo "Waiter Token: $WAITER_LOGIN"
```

### 2. Create Order
```bash
ORDER=$(curl -s -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $WAITER_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "restaurantId": "YOUR_RESTAURANT_ID",
    "createdBy": "YOUR_USER_ID",
    "notes": "Test order"
  }' | jq -r '.data._id')

echo "Order ID: $ORDER"
```

### 3. Add Item to Order
```bash
curl -s -X POST "http://localhost:5000/api/orders/$ORDER/items" \
  -H "Authorization: Bearer $WAITER_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{
    "menuItemId": "YOUR_MENU_ITEM_ID",
    "quantity": 2,
    "specialInstructions": "No onions"
  }' | jq
```

### 4. Login as Chef
```bash
CHEF_LOGIN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chef.michael@restaurant.com",
    "password": "chef@123"
  }' | jq -r '.data.token')
```

### 5. Update Order Status (PREPARING)
```bash
curl -s -X PUT "http://localhost:5000/api/orders/$ORDER/status" \
  -H "Authorization: Bearer $CHEF_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PREPARING"}' | jq
```

### 6. Update Order Status (READY)
```bash
curl -s -X PUT "http://localhost:5000/api/orders/$ORDER/status" \
  -H "Authorization: Bearer $CHEF_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{"status": "READY"}' | jq
```

### 7. Login as Cashier
```bash
CASHIER_LOGIN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "david.cashier@restaurant.com",
    "password": "cashier@123"
  }' | jq -r '.data.token')
```

### 8. Create Payment
```bash
curl -s -X POST http://localhost:5000/api/payments \
  -H "Authorization: Bearer $CASHIER_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "'$ORDER'",
    "restaurantId": "YOUR_RESTAURANT_ID",
    "subtotal": 100,
    "paymentMethod": "CASH"
  }' | jq
```

### 9. Complete Order
```bash
curl -s -X PUT "http://localhost:5000/api/orders/$ORDER/complete" \
  -H "Authorization: Bearer $CASHIER_LOGIN" | jq
```

## 🔗 Important IDs You Need

Get these from the seed output or API responses:

1. **Restaurant ID**
   ```bash
   curl -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:5000/api/restaurants | jq '.data[0]._id'
   ```

2. **User IDs**
   ```bash
   curl -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:5000/api/users | jq '.data[].id'
   ```

3. **Menu Item IDs**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5000/api/menu/restaurant/RESTAURANT_ID" | \
     jq '.data[0]._id'
   ```

## 🛠️ Useful Commands

```bash
# Start development server
npm start

# Seed database with sample data
npm run seed

# Check health
curl http://localhost:5000/health

# View logs
tail -f logs/app.log
tail -f logs/error.log

# Kill server
lsof -ti:5000 | xargs kill -9
```

## 📖 Next Steps

1. Read [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference
2. Read [README.md](./README.md) for full documentation
3. Explore models in `models/` directory
4. Review services in `services/` directory
5. Check middleware in `middlewares/` directory

## 🐛 Common Issues

### Port 5000 already in use?
```bash
lsof -ti:5000 | xargs kill -9
npm start
```

### MongoDB connection error?
```bash
# Check MongoDB is running
mongosh # or mongo

# Create database if needed
use restaurant_db
```

### Invalid Token?
```bash
# Re-login to get fresh token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@restaurant.com", "password": "admin@123"}'
```

## 📞 Support

- Check logs: `tail -f logs/error.log`
- Read docs: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Review models: `models/`
- Check middleware: `middlewares/`

---

**You're all set!** 🎉 The backend is ready to use!
