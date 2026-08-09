require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    let admin = await User.findOne({ email: 'admin@servia.com' });
    if (!admin) {
      await User.create({
        name: 'Main Admin',
        email: 'admin@servia.com',
        password: 'admin123',
        role: 'MAIN_ADMIN'
      });
      console.log('Main Admin created successfully!');
    } else {
      console.log('Main Admin already exists!');
    }
    
    console.log('\nMAIN ADMIN CREDENTIALS:');
    console.log('  Email: admin@servia.com');
    console.log('  Password: admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdmin();
