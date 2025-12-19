// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection with better handling for serverless
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Connect before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Schemas
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  class: { type: String, required: true },
  section: { type: String, required: true },
  dob: Date,
  address: String,
  parentContact: String,
  createdAt: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  studentName: String,
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'leave'], required: true },
  markedBy: String,
  timestamp: { type: Date, default: Date.now }
});

const classSchema = new mongoose.Schema({
  className: { type: String, required: true },
  sections: [String],
  createdAt: { type: Date, default: Date.now }
});

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

// Models
const Student = mongoose.model('Student', studentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Class = mongoose.model('Class', classSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'GHSS117 Attendance API is running!' });
});

// ============ STUDENTS ============

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const { class: className, section } = req.query;
    const filter = {};
    if (className) filter.class = className;
    if (section) filter.section = section;
    
    const students = await Student.find(filter).sort({ rollNumber: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student by ID
app.get('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new student
app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ATTENDANCE ============

// Mark attendance
app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, studentName, date, status, markedBy } = req.body;
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Check if attendance already exists
    let attendance = await Attendance.findOne({
      studentId,
      date: { $gte: startDate, $lte: endDate }
    });

    if (attendance) {
      attendance.status = status;
      attendance.markedBy = markedBy;
      attendance.timestamp = new Date();
      await attendance.save();
    } else {
      attendance = new Attendance({
        studentId,
        studentName,
        date: startDate,
        status,
        markedBy
      });
      await attendance.save();
    }

    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get attendance by date
app.get('/api/attendance', async (req, res) => {
  try {
    const { date, class: className, section } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    });

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get attendance for a student
app.get('/api/attendance/student/:studentId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { studentId: req.params.studentId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await Attendance.find(query).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CLASSES ============

// Get all classes
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await Class.find().sort({ className: 1 });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new class
app.post('/api/classes', async (req, res) => {
  try {
    const classData = new Class(req.body);
    await classData.save();
    res.status(201).json(classData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update class
app.put('/api/classes/:id', async (req, res) => {
  try {
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    res.json(classData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete class
app.delete('/api/classes/:id', async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SETUP ENDPOINT (One-time use) ============

app.post('/api/setup', async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await Teacher.findOne({ email: 'admin@school.com' });
    
    if (existingAdmin) {
      return res.json({ message: 'Users already exist', users: await Teacher.find() });
    }

    // Create admin
    const admin = new Teacher({
      email: 'admin@school.com',
      name: 'Admin User',
      role: 'admin',
      assignedClasses: []
    });
    await admin.save();

    // Create teacher
    const teacher = new Teacher({
      email: 'teacher@school.com',
      name: 'Teacher User',
      role: 'teacher',
      assignedClasses: []
    });
    await teacher.save();

    res.json({ 
      message: 'Setup completed successfully!',
      users: [admin, teacher]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ TEACHERS ============

// Get all teachers
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get teacher by email
app.get('/api/teachers/email/:email', async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ email: req.params.email });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new teacher
app.post('/api/teachers', async (req, res) => {
  try {
    const teacher = new Teacher(req.body);
    await teacher.save();
    res.status(201).json(teacher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update teacher
app.put('/api/teachers/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server - Listen on all network interfaces
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Local: http://localhost:${PORT}`);
  console.log(`📱 Network: http://192.168.10.13:${PORT}`);
  console.log(`📱 API Endpoint: http://192.168.10.13:${PORT}/api`);
  
  const address = server.address();
  console.log('\nServer listening on:', address);
});