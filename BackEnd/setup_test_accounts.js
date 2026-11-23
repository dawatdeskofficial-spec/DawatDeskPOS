require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/database');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');

async function setupTestUsers() {
  await connectDB();
  const hariom = await Restaurant.findOne({ name: /Hariom/i });
  if (!hariom) {
    console.error('Hariom restaurant not found!');
    process.exit(1);
  }
  console.log('Found Hariom Restaurant ID:', hariom._id.toString());

  // Plain password - Mongoose userSchema pre('save') hook will hash it automatically!
  const plainPassword = 'test@gmail.com';

  const testUsers = [
    {
      email: 'admin@gmail.com',
      name: 'System Admin',
      role: 'MAIN_ADMIN',
      restaurantId: null,
      phone: '9876543210',
    },
    {
      email: 'manager@gmail.com',
      name: 'Hariom Manager',
      role: 'RESTAURANT_ADMIN',
      restaurantId: hariom._id,
      phone: '9876543211',
    },
    {
      email: 'waiter@gmail.com',
      name: 'Hariom Waiter',
      role: 'WAITER',
      restaurantId: hariom._id,
      phone: '9876543212',
    },
    {
      email: 'chef@gmail.com',
      name: 'Hariom Chef',
      role: 'CHEF',
      restaurantId: hariom._id,
      phone: '9876543213',
    },
    {
      email: 'cashier@gmail.com',
      name: 'Hariom Cashier',
      role: 'CASHIER',
      restaurantId: hariom._id,
      phone: '9876543214',
    },
  ];

  for (const u of testUsers) {
    let existing = await User.findOne({ email: u.email });
    if (existing) {
      existing.password = plainPassword;
      existing.role = u.role;
      existing.restaurantId = u.restaurantId;
      existing.isActive = true;
      existing.isEmailVerified = true;
      await existing.save();
      console.log('Updated user:', u.email, 'Role:', u.role, 'Password set to test@gmail.com');
    } else {
      const newUser = new User({
        name: u.name,
        email: u.email,
        password: plainPassword,
        role: u.role,
        restaurantId: u.restaurantId,
        phone: u.phone,
        isActive: true,
        isEmailVerified: true,
      });
      await newUser.save();
      console.log('Created user:', u.email, 'Role:', u.role, 'Password set to test@gmail.com');
    }
  }

  // Also update existing Hariom users passwords to test@gmail.com
  const existingHariomUsers = await User.find({
    email: {
      $in: [
        'manager.hariom@gmail.com',
        'john.waiter@gmail.com',
        'jane.waiter@gmail.com',
        'chef.michael@gmail.com',
        'hari.cashier@gmail.com',
      ],
    },
  });
  for (const u of existingHariomUsers) {
    u.password = plainPassword;
    u.isActive = true;
    u.isEmailVerified = true;
    await u.save();
    console.log('Also updated existing user password to test@gmail.com:', u.email);
  }

  console.log('ALL TEST USERS SUCCESSFULLY CONFIGURED WITH PASSWORD: test@gmail.com');
  process.exit(0);
}

setupTestUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
