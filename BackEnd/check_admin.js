require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const admin = await User.findOne({ email: 'admin@gmail.com' });
  if (!admin) {
    console.log('Admin not found. Recreating...');
    await User.create({
      name: 'System Administrator',
      email: 'admin@gmail.com',
      password: 'admin123',
      role: 'MAIN_ADMIN',
      isActive: true
    });
    console.log('Admin recreated successfully.');
  } else {
    console.log('Admin still exists.');
  }
  process.exit(0);
}).catch(console.error);
