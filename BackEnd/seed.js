require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const Payment = require('./models/Payment');
const SystemSettings = require('./models/SystemSettings');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});
    await OrderItem.deleteMany({});
    await Payment.deleteMany({});
    await SystemSettings.deleteMany({});

    console.log('Cleared existing data');

    // Create restaurants
    const restaurants = await Restaurant.insertMany([
      {
        name: 'Hariom Restaurant',
        location: 'MG Road',
        description: 'Authentic South Indian Cuisine',
        phone: '+91-98765-43210',
        email: 'hariom@gmail.com',
        status: 'ACTIVE',
        maxTables: 20,
        address: {
          street: '123 MG Road',
          city: 'Bengaluru',
          state: 'KA',
          zipCode: '560001',
          country: 'India',
        },
      },
      {
        name: 'Mysore Dosa Corner',
        location: 'Market Street',
        description: 'Crispy Mysore-style dosas and tiffin',
        phone: '+1-555-0102',
        email: 'mysore.dosa@gmail.com',
        status: 'ACTIVE',
        maxTables: 20,
        address: {
          street: '456 Market Street',
          city: 'Mysuru',
          state: 'KA',
          zipCode: '570001',
          country: 'India',
        },
      },
      {
        name: 'Sagar Dosa Cafe',
        location: 'Station Road',
        description: 'Quick-service dosa, idli, vada, and filter coffee',
        phone: '+1-555-0103',
        email: 'sagar.dosa@gmail.com',
        status: 'ACTIVE',
        maxTables: 18,
        address: {
          street: '789 Station Road',
          city: 'Chennai',
          state: 'TN',
          zipCode: '600001',
          country: 'India',
        },
      },
    ]);

    console.log('Created restaurants');

    // Create users
    const mainAdmin = await User.create({
      name: 'System Administrator',
      email: 'admin@gmail.com',
      password: 'admin123',
      role: 'MAIN_ADMIN',
    });

    const restaurantAdmins = await User.create([
      {
        name: 'Hariom Manager',
        email: 'manager.hariom@gmail.com',
        password: 'admin123',
        role: 'RESTAURANT_ADMIN',
        restaurantId: restaurants[0]._id,
      },
      {
        name: 'Mysore Dosa Manager',
        email: 'manager.spice@gmail.com',
        password: 'admin123',
        role: 'RESTAURANT_ADMIN',
        restaurantId: restaurants[1]._id,
      },
      {
        name: 'Sagar Dosa Manager',
        email: 'manager.pasta@gmail.com',
        password: 'admin123',
        role: 'RESTAURANT_ADMIN',
        restaurantId: restaurants[2]._id,
      },
    ]);

    // Create staff for first restaurant
    const staff1 = await User.create([
      {
        name: 'John Waiter',
        email: 'john.waiter@gmail.com',
        password: 'waiter123',
        role: 'WAITER',
        restaurantId: restaurants[0]._id,
      },
      {
        name: 'Jane Waiter',
        email: 'jane.waiter@gmail.com',
        password: 'waiter123',
        role: 'WAITER',
        restaurantId: restaurants[0]._id,
      },
      {
        name: 'Chef Michael',
        email: 'chef.michael@gmail.com',
        password: 'chef123',
        role: 'CHEF',
        restaurantId: restaurants[0]._id,
      },
      {
        name: 'Hari Cashier',
        email: 'hari.cashier@gmail.com',
        password: 'cashier123',
        role: 'CASHIER',
        restaurantId: restaurants[0]._id,
      },
    ]);

    // Create staff for second restaurant
    const staff2 = await User.create([
      {
        name: 'Raj Waiter',
        email: 'raj.waiter@gmail.com',
        password: 'waiter@123',
        role: 'WAITER',
        restaurantId: restaurants[1]._id,
      },
      {
        name: 'Priya Chef',
        email: 'priya.chef@gmail.com',
        password: 'chef@123',
        role: 'CHEF',
        restaurantId: restaurants[1]._id,
      },
      {
        name: 'Amit Cashier',
        email: 'amit.cashier@gmail.com',
        password: 'cashier@123',
        role: 'CASHIER',
        restaurantId: restaurants[1]._id,
      },
    ]);

    // Create staff for third restaurant
    const staff3 = await User.create([
      {
        name: 'Luca Waiter',
        email: 'luca.waiter@gmail.com',
        password: 'waiter@123',
        role: 'WAITER',
        restaurantId: restaurants[2]._id,
      },
      {
        name: 'Maria Chef',
        email: 'maria.chef@gmail.com',
        password: 'chef@123',
        role: 'CHEF',
        restaurantId: restaurants[2]._id,
      },
      {
        name: 'Giovanni Cashier',
        email: 'giovanni.cashier@gmail.com',
        password: 'cashier@123',
        role: 'CASHIER',
        restaurantId: restaurants[2]._id,
      },
    ]);

    console.log('Created users');

    // Create menu items for first restaurant
    const menuItems = await MenuItem.insertMany([
      // Starters
      {
        name: 'Idli (2 pcs)',
        description: 'Steamed rice cakes served with sambar and coconut chutney',
        price: 40,
        category: 'APPETIZER',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 5,
      },
      {
        name: 'Medu Vada (2 pcs)',
        description: 'Crispy fried black lentil donuts with chutneys',
        price: 50,
        category: 'APPETIZER',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 8,
      },
      {
        name: 'Idli Vada Combo',
        description: 'One steamed idli and one crispy medu vada with sambar',
        price: 60,
        category: 'APPETIZER',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 6,
      },
      {
        name: 'Rasam Vada (2 pcs)',
        description: 'Medu vadas soaked in piping hot spicy rasam soup',
        price: 55,
        category: 'APPETIZER',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 7,
      },
      {
        name: 'Onion Bhaji',
        description: 'Crispy deep-fried onion fritters with mint chutney',
        price: 65,
        category: 'APPETIZER',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 10,
      },
      // Mains
      {
        name: 'Plain Dosa',
        description: 'Crispy golden crepe made of fermented rice and lentil batter',
        price: 80,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 10,
      },
      {
        name: 'Masala Dosa',
        description: 'Crispy dosa filled with spiced potato masala',
        price: 120,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 12,
      },
      {
        name: 'Mysore Masala Dosa',
        description: 'Dosa spread with red garlic chutney and potato masala',
        price: 150,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 14,
      },
      {
        name: 'Cheese Masala Dosa',
        description: 'Golden dosa loaded with cheddar cheese and potato masala',
        price: 160,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 13,
      },
      {
        name: 'Rava Masala Dosa',
        description: 'Crispy, lacy semolina crepe with potato filling',
        price: 140,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 15,
      },
      {
        name: 'Onion Uttapam',
        description: 'Thick savoury pancake topped with chopped onions and coriander',
        price: 130,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 12,
      },
      {
        name: 'Lemon Rice',
        description: 'Tangy rice tempered with lemon juice, mustard seeds, and peanuts',
        price: 110,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 10,
      },
      {
        name: 'Tamarind Rice',
        description: 'Traditional sour rice cooked with spiced tamarind pulp',
        price: 115,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 10,
      },
      {
        name: 'Sambar Rice',
        description: 'Rice cooked together with lentils and mixed vegetables',
        price: 125,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 11,
      },
      // Sides
      {
        name: 'Extra Sambar',
        description: 'Hot lentil sambar served on the side',
        price: 30,
        category: 'SIDES',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      {
        name: 'Coconut Chutney Bowl',
        description: 'Fresh coconut chutney for sharing',
        price: 25,
        category: 'SIDES',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      {
        name: 'Tomato Chutney',
        description: 'Spicy tomato chutney served on the side',
        price: 25,
        category: 'SIDES',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      {
        name: 'Gunpowder Podi',
        description: 'Spicy lentil powder served with hot melted ghee',
        price: 35,
        category: 'SIDES',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      // Desserts
      {
        name: 'Rava Kesari',
        description: 'Classic semolina sweet with ghee and cashews',
        price: 70,
        category: 'DESSERT',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 5,
      },
      {
        name: 'Payasam',
        description: 'Traditional rice and milk kheer cooked with nuts and raisins',
        price: 80,
        category: 'DESSERT',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 6,
      },
      // Beverages
      {
        name: 'Filter Coffee',
        description: 'Traditional South Indian filter coffee',
        price: 50,
        category: 'BEVERAGE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 4,
      },
      {
        name: 'Masala Chai',
        description: 'Spiced milk tea',
        price: 45,
        category: 'BEVERAGE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 4,
      },
      {
        name: 'Butter Milk',
        description: 'Chilled spiced buttermilk with cilantro and ginger',
        price: 40,
        category: 'BEVERAGE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 3,
      },
      {
        name: 'Tender Coconut',
        description: 'Chilled organic coconut water',
        price: 60,
        category: 'BEVERAGE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      {
        name: 'Small Cold Drink Can',
        description: 'Single-serve chilled soft drink can maintained by waiter',
        price: 35,
        category: 'BEVERAGE',
        restaurantId: restaurants[0]._id,
        isAvailable: true,
        preparationTime: 0,
        fulfillmentOwner: 'WAITER',
      },
    ]);

    // Create menu items for second restaurant
    await MenuItem.insertMany([
      {
        name: 'Ghee Roast Dosa',
        description: 'Paper-thin dosa roasted with ghee',
        price: 140,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[1]._id,
        isAvailable: true,
        preparationTime: 12,
      },
      {
        name: 'Medu Vada',
        description: 'Crispy lentil doughnuts with sambar and chutney',
        price: 80,
        category: 'APPETIZER',
        restaurantId: restaurants[1]._id,
        isAvailable: true,
        preparationTime: 8,
      },
      {
        name: 'Tomato Chutney',
        description: 'Tangy tomato chutney side portion',
        price: 25,
        category: 'SIDES',
        restaurantId: restaurants[1]._id,
        isAvailable: true,
        preparationTime: 2,
      },
      {
        name: 'Buttermilk',
        description: 'Chilled spiced buttermilk',
        price: 45,
        category: 'BEVERAGE',
        restaurantId: restaurants[1]._id,
        isAvailable: true,
        preparationTime: 3,
      },
      {
        name: 'Small Cold Drink Can',
        description: 'Single-serve chilled soft drink can maintained by waiter',
        price: 35,
        category: 'BEVERAGE',
        restaurantId: restaurants[1]._id,
        isAvailable: true,
        preparationTime: 0,
        fulfillmentOwner: 'WAITER',
      },
    ]);

    // Create menu items for third restaurant
    await MenuItem.insertMany([
      {
        name: 'Onion Uttapam',
        description: 'Thick dosa topped with onion, chilli, and coriander',
        price: 130,
        category: 'MAIN_COURSE',
        restaurantId: restaurants[2]._id,
        isAvailable: true,
        preparationTime: 12,
      },
      {
        name: 'Podi Idli',
        description: 'Mini idlis tossed with ghee and gunpowder podi',
        price: 95,
        category: 'APPETIZER',
        restaurantId: restaurants[2]._id,
        isAvailable: true,
        preparationTime: 7,
      },
      {
        name: 'Sweet Pongal',
        description: 'Rice and jaggery sweet with ghee and cashews',
        price: 85,
        category: 'DESSERT',
        restaurantId: restaurants[2]._id,
        isAvailable: true,
        preparationTime: 5,
      },
      {
        name: 'Small Cold Drink Can',
        description: 'Single-serve chilled soft drink can maintained by waiter',
        price: 35,
        category: 'BEVERAGE',
        restaurantId: restaurants[2]._id,
        isAvailable: true,
        preparationTime: 0,
        fulfillmentOwner: 'WAITER',
      },
    ]);

    console.log('Created menu items');

    // Get all menu items
    const allMenuItems = await MenuItem.find({});

    // Create orders
    const orders = await Order.insertMany([
      {
        tableNumber: 1,
        restaurantId: restaurants[0]._id,
        status: 'COMPLETED',
        createdBy: staff1[0]._id,
        notes: 'Sample order 1',
        totalAmount: 220.5,
        gst: 10.5,
        discount: 0,
        paymentStatus: 'COMPLETED',
        servedAt: new Date(),
        completedAt: new Date(),
      },
      {
        tableNumber: 2,
        restaurantId: restaurants[1]._id,
        status: 'COMPLETED',
        createdBy: staff2[0]._id,
        notes: 'Sample order 2',
        totalAmount: 147,
        gst: 7,
        discount: 0,
        paymentStatus: 'COMPLETED',
        servedAt: new Date(),
        completedAt: new Date(),
      },
      {
        tableNumber: 3,
        restaurantId: restaurants[2]._id,
        status: 'COMPLETED',
        createdBy: staff3[0]._id,
        notes: 'Sample order 3',
        totalAmount: 236.25,
        gst: 11.25,
        discount: 0,
        paymentStatus: 'COMPLETED',
        servedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    console.log('Created orders');

    // Create order items
    await OrderItem.insertMany([
      {
        orderId: orders[0]._id,
        menuItemId: allMenuItems[0]._id,
        quantity: 1,
        price: 120,
        specialInstructions: '',
        status: 'DELIVERED',
      },
      {
        orderId: orders[0]._id,
        menuItemId: allMenuItems[1]._id,
        quantity: 1,
        price: 90,
        specialInstructions: 'Extra coconut chutney',
        status: 'DELIVERED',
      },
      {
        orderId: orders[1]._id,
        menuItemId: allMenuItems[8]._id,
        quantity: 1,
        price: 140,
        specialInstructions: '',
        status: 'DELIVERED',
      },
      {
        orderId: orders[2]._id,
        menuItemId: allMenuItems[12]._id,
        quantity: 1,
        price: 130,
        specialInstructions: '',
        status: 'DELIVERED',
      },
      {
        orderId: orders[2]._id,
        menuItemId: allMenuItems[13]._id,
        quantity: 1,
        price: 95,
        specialInstructions: '',
        status: 'DELIVERED',
      },
    ]);

    console.log('Created order items');

    // Create payments
    await Payment.insertMany([
      {
        orderId: orders[0]._id,
        restaurantId: restaurants[0]._id,
        subtotal: 210,
        gstPercentage: 5,
        gstAmount: 10.5,
        discount: 0,
        totalAmount: 220.5,
        paymentMethod: 'CARD',
        status: 'COMPLETED',
        transactionId: 'TXN001',
        createdBy: staff1[3]._id, // Hari Cashier
      },
      {
        orderId: orders[1]._id,
        restaurantId: restaurants[1]._id,
        subtotal: 140,
        gstPercentage: 5,
        gstAmount: 7,
        discount: 0,
        totalAmount: 147,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        transactionId: 'TXN002',
        createdBy: staff2[2]._id, // Amit Cashier
      },
      {
        orderId: orders[2]._id,
        restaurantId: restaurants[2]._id,
        subtotal: 225,
        gstPercentage: 5,
        gstAmount: 11.25,
        discount: 0,
        totalAmount: 236.25,
        paymentMethod: 'DIGITAL_WALLET',
        status: 'COMPLETED',
        transactionId: 'TXN003',
        createdBy: staff3[2]._id, // Giovanni Cashier
      },
    ]);

    console.log('Created payments');

    // Create system settings
    await SystemSettings.create({
      gstPercentage: 5,
      serviceChargePercentage: 0,
      currency: 'INR',
      notificationsEnabled: true,
      emailNotifications: true,
      smsNotifications: false,
      maintenanceMode: false,
      maxOrdersPerTable: 5,
      defaultPreparationTime: 15,
    });

    console.log('Created system settings');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('\nMAIN ADMIN:');
    console.log('  Email: admin@gmail.com');
    console.log('  Password: admin123');
    console.log('\nRESTAURANT ADMIN (Hariom Restaurant):');
    console.log('  Email: manager.hariom@gmail.com');
    console.log('  Password: manager@123');
    console.log('\nWAITER (Hariom Restaurant):');
    console.log('  Email: john.waiter@gmail.com');
    console.log('  Password: waiter@123');
    console.log('\nCASHIER (Hariom Restaurant):');
    console.log('  Email: hari.cashier@gmail.com');
    console.log('  Password: cashier@123');
    console.log('\nCHEF (Hariom Restaurant):');
    console.log('  Email: chef.michael@gmail.com');
    console.log('  Password: chef@123');
    console.log('\nWAITER (Mysore Dosa Corner):');
    console.log('  Email: raj.waiter@gmail.com');
    console.log('  Password: waiter@123');
    console.log('\nCHEF (Mysore Dosa Corner):');
    console.log('  Email: priya.chef@gmail.com');
    console.log('  Password: chef@123');
    console.log('\nCASHIER (Mysore Dosa Corner):');
    console.log('  Email: amit.cashier@gmail.com');
    console.log('  Password: cashier@123');
    console.log('\nWAITER (Sagar Dosa Cafe):');
    console.log('  Email: luca.waiter@gmail.com');
    console.log('  Password: waiter@123');
    console.log('\nCHEF (Sagar Dosa Cafe):');
    console.log('  Email: maria.chef@gmail.com');
    console.log('  Password: chef@123');
    console.log('\nCASHIER (Sagar Dosa Cafe):');
    console.log('  Email: giovanni.cashier@gmail.com');
    console.log('  Password: cashier@123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();
