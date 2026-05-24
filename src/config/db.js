const mongoose = require('mongoose');

// ─── Inline seeder (no child_process) ──────────────────────────────────────
const seedInline = async () => {
  const bcrypt = require('bcryptjs');
  const User = require('../models/User');
  const Table = require('../models/Table');
  const Category = require('../models/Category');
  const MenuItem = require('../models/MenuItem');

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log('✅ Database already seeded, skipping...');
    return;
  }

  console.log('🌱 Seeding database with initial data...');

  // Users
  const users = await User.create([
    { name: 'Admin', email: 'admin@cafe.com', password: 'admin123', role: 'admin', phone: '+201000000000' },
    { name: 'Ahmed (Waiter)', email: 'ahmed@cafe.com', password: 'waiter123', role: 'waiter', phone: '+201111111111' },
    { name: 'Kitchen Staff', email: 'kitchen@cafe.com', password: 'kitchen123', role: 'kitchen', phone: '+201333333333' },
  ]);

  // Tables (1–12)
  const tableDocs = [];
  for (let i = 1; i <= 12; i++) {
    tableDocs.push({
      number: i,
      capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      location: i <= 4 ? 'indoor' : i <= 8 ? 'outdoor' : 'vip',
      assignedWaiter: users[1]._id,
    });
  }
  await Table.create(tableDocs);

  console.log('✅ Database seeded successfully (Users and Tables only)!');
  console.log('   Admin:   admin@cafe.com / admin123');
  console.log('   Waiter:  ahmed@cafe.com / waiter123');
  console.log('   Kitchen: kitchen@cafe.com / kitchen123');
};

// ─── Connect ────────────────────────────────────────────────────────────────
const connectDB = async () => {
  // 1. Try real MongoDB first
  const realUri = process.env.MONGODB_URI;
  if (realUri && !realUri.includes('localhost') && !realUri.includes('127.0.0.1')) {
    try {
      await mongoose.connect(realUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
      await seedInline();
      return;
    } catch (err) {
      console.error(`❌ Remote MongoDB failed: ${err.message}`);
    }
  }

  // 2. Try local MongoDB
  try {
    const localUri = realUri || 'mongodb://127.0.0.1:27017/cafe_management';
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`✅ MongoDB (local) connected: ${mongoose.connection.host}`);
    await seedInline();
    return;
  } catch (_) {
    console.log('⚠️  Local MongoDB not found → starting In-Memory MongoDB...');
  }

  // 3. Fallback: In-Memory MongoDB (dev only)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    let mongoServer;
    try {
      mongoServer = await MongoMemoryServer.create();
    } catch (createErr) {
      console.log('⚠️ MongoMemoryServer start failed, retrying with explicit dbPath...');
      const fs = require('fs');
      const path = require('path');
      const tmpPath = path.join(process.cwd(), '.local_mongo_data');
      if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true });
      mongoServer = await MongoMemoryServer.create({ instance: { dbPath: tmpPath } });
    }

    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log(`✅ In-Memory MongoDB started at: ${uri}`);
    console.log('   ⚠️  Data will be lost on restart. Install MongoDB for persistence.');
    await seedInline();

    // Keep the server alive
    process.on('SIGINT', async () => { await mongoServer.stop(); process.exit(0); });
  } catch (err) {
    console.error(`❌ All DB options failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;