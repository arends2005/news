const { Pool } = require('pg');
const logger = require('../logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection error:', err);
  } else {
    logger.info('Database connected successfully');
  }
});

module.exports = pool; 