const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const routes = require('./routes');
const expressLayouts = require('express-ejs-layouts');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// Routes
routes(app, pool);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// For graceful shutdown
process.on('SIGINT', () => {
  logger.info('Closing database connection...');
  pool.end();
  process.exit(0);
});