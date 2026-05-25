require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const setupSocket = require('./socket');

// Connect to database initially
connectDB();

const app = express();

// Ensure DB is connected before handling any request (crucial for Vercel Serverless)
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "https://cafe-frontend-sepia-ten.vercel.app"
];

// Apply CORS options globally
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

const io = new Server(server, {
  cors: { 
    origin: allowedOrigins, 
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
    credentials: true 
  }
});

// Make io accessible to routes
app.set('io', io);

// Other Middleware
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api', require('./routes/extras'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Cafe Management API', status: 'running', timestamp: new Date().toISOString() });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Socket.io
setupSocket(io);

// Only listen when NOT on Vercel (Vercel uses serverless)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🔗 API: http://localhost:${PORT}/api\n`);
  });
}

// Export for Vercel serverless
module.exports = app;
