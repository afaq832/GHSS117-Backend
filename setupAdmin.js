// backend/setupAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');

// Teacher Schema (same as in server.js)
const teacherSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher'], required: true },
  assignedClasses: [{
    className: String,
    section: String
  }],
  createdAt: { type: Date, default: Date.now }
});

const Teacher = mongoose.model('Teacher', teacherSchema);

// Connect to MongoDB and create users
async function setupUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create Admin User
    const existingAdmin = await Teacher.findOne({ email: 'admin@ghss117.com' });

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
    } else {
      const admin = new Teacher({
        email: 'admin@school.com',
        name: 'Admin User',
        role: 'admin',
        assignedClasses: []
      });

      await admin.save();
      console.log('✅ Admin user created successfully!');
    }

    // Create Teacher User
    const existingTeacher = await Teacher.findOne({ email: 'teacher@school.com' });

    if (existingTeacher) {
      console.log('ℹ️  Teacher user already exists');
    } else {
      const teacher = new Teacher({
        email: 'teacher@ghss117.com',
        name: 'Teacher User',
        role: 'teacher',
        assignedClasses: []
      });

      await teacher.save();
      console.log('✅ Teacher user created successfully!');
    }

    console.log('\n========================================');
    console.log('✅ SETUP COMPLETE!');
    console.log('========================================');
    console.log('\n📝 Login Credentials:\n');
    console.log('ADMIN:');
    console.log('  Email: admin@school.com');
    console.log('  Password: Admin@123');
    console.log('\nTEACHER:');
    console.log('  Email: teacher@school.com');
    console.log('  Password: Teacher@123');
    console.log('\n⚠️  Note: Create these users in Firebase Authentication too!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error setting up users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit();
  }
}

// Run the setup
setupUsers();