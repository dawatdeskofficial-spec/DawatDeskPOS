require('dotenv').config({ path: 'BackEnd/.env' });
const mongoose = require('mongoose');
const User = require('./BackEnd/models/User');
const authService = require('./BackEnd/services/authService');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ role: 'RESTAURANT_ADMIN' });
    if (!admin) {
      console.log('No RESTAURANT_ADMIN found');
      process.exit(0);
    }
    console.log('Found RESTAURANT_ADMIN:', admin.email);
    // Let's try to simulate what authService.loginUser does
    // but without the password match since we don't know it, we'll just check the logic
    console.log('Testing getUserById...');
    const result = await authService.getUserById(admin._id);
    console.log('Success:', result);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
