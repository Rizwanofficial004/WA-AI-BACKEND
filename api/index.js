const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('../app');
const connectDB = require('../config/db');

let dbConnected = false;

const ensureDB = async () => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
};

try {
  const { connectRedis } = require('../config/redis');
  connectRedis();
} catch (e) {
  // Redis is optional in serverless
}

module.exports = async (req, res) => {
  await ensureDB();
  return app(req, res);
};
