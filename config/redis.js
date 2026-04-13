// Redis Configuration
const Redis = require('ioredis');

let redis;

const connectRedis = () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      connectTimeout: 10000
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });

    redis.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    return redis;
  } catch (error) {
    console.error('❌ Redis setup error:', error);
    throw error;
  }
};

const getRedis = () => {
  return redis || null;
};

// Graceful shutdown
const closeRedis = async () => {
  if (redis) {
    await redis.quit();
    console.log('Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedis,
  closeRedis
};
