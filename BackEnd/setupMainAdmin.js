require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const logger = require('./utils/logger');

const setupMainAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if main admin already exists
    let admin = await User.findOne({ email: 'admin@servia.com' });
    
    if (!admin) {
      console.log('Creating Main Admin account...');
      await User.create({
        name: 'Servia Administrator',
        email: 'admin@servia.com',
        password: 'admin123',
        role: 'MAIN_ADMIN' // Must match the enum exactly
      });
      console.log('Main Admin successfully created and saved to database!');
    } else {
      console.log('Main Admin account already exists in database. Updating details...');
      // If it exists, let's update password just to be sure it's correct
      admin.name = 'Servia Administrator';
      admin.password = 'admin123';
      await admin.save();
      console.log('Main Admin successfully updated and saved to database!');
    }
    
    console.log('\n--- MAIN ADMIN CREDENTIALS ---');
    console.log('Email: admin@servia.com');
    console.log('Password: admin123');
    console.log('------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up Main Admin:', error);
    process.exit(1);
  }
};

setupMainAdmin();
