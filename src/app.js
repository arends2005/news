require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const logger = require('./logger');
const routes = require('./routes');
const discordBot = require('./discord/bot');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
routes(app, pool);

// Start the server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Start the Discord bot
if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('Discord bot token is not set in environment variables');
} else {
  logger.info('Attempting to start Discord bot...');
  discordBot.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => {
      logger.info('Discord bot started successfully');
    })
    .catch(error => {
      logger.error('Failed to start Discord bot:', error);
      logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });
}

// For graceful shutdown
process.on('SIGINT', () => {
  logger.info('Closing database connection...');
  pool.end();
  process.exit(0);
});