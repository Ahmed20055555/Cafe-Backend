require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Table = require('./src/models/Table');
const Session = require('./src/models/Session');

const cleanupTables = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Cleaning up tables...');
    
    // Reset all tables to 'available' and clear currentSession
    const result = await Table.updateMany(
      {},
      { 
        $set: { 
          status: 'available', 
          currentSession: null,
          isBlocked: false
        } 
      }
    );
    
    console.log(`✅ Successfully reset ${result.modifiedCount} tables to available state.`);
    
    // Also optionally close all active sessions to avoid dangling sessions
    const sessionResult = await Session.updateMany(
      { status: { $in: ['active', 'billing', 'payment_sent'] } },
      { $set: { status: 'completed', endTime: new Date() } }
    );
    
    console.log(`✅ Successfully marked ${sessionResult.modifiedCount} active/billing sessions as completed.`);

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up tables:', error);
    process.exit(1);
  }
};

cleanupTables();
