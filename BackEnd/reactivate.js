require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOneAndUpdate({ email: 'admin@restaurant.com' }, { isActive: true }, { new: true });
  console.log('Reactivated user:', user.email, 'isActive:', user.isActive);
  process.exit(0);
}).catch(console.error);
