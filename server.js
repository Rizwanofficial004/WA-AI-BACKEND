const path = require('path');

// Always load the repo-root .env so local dev + docker behave consistently.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis, closeRedis } = require('./config/redis');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Connect to Redis (optional - fallback to in-memory if unavailable)
let redisConnected = false;
try {
  connectRedis();
  redisConnected = true;
} catch (error) {
  console.warn('⚠️ Redis not available, using in-memory state management');
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Redis: ${redisConnected ? '✅ Connected' : '⚠️ Not available'}`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Graceful shutdown initiated...');
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    if (redisConnected) {
      await closeRedis();
    }
    
    console.log('Process terminated');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  gracefulShutdown();
});

// Handle SIGTERM
process.on('SIGTERM', gracefulShutdown);

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', gracefulShutdown);
