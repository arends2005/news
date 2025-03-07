const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('../logger');
const axios = require('axios');
const cheerio = require('cheerio');
const { getMetadata } = require('../utils/metadata');
const pool = require('../db/pool');

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// Get bot user ID from database or environment variable
async function getBotUserId() {
  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['bot_user_id']);
    if (result.rows.length > 0) {
      const userId = parseInt(result.rows[0].value);
      // Verify the user exists
      const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        return userId;
      }
    }
    // Fallback to environment variable
    return parseInt(process.env.BOT_USER_ID) || 1;
  } catch (err) {
    logger.error('Error getting bot user ID:', err);
    return parseInt(process.env.BOT_USER_ID) || 1;
  }
}

let systemUserId = null;

// Function to get system user ID
async function getSystemUserId() {
  try {
    if (systemUserId === null) {
      systemUserId = await getBotUserId();
      logger.info(`System user ID set to: ${systemUserId}`);
    }
    return systemUserId;
  } catch (err) {
    logger.error('Error getting system user ID:', err);
    throw err;
  }
}

// URL regex pattern
const urlPattern = /(https?:\/\/[^\s]+)/g;

// Format timestamp for Discord message
function formatTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

// Function to fetch URL metadata
async function fetchUrlMetadata(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') || '';
    
    return {
      title: title || 'No title found',
      description: description || 'No description available'
    };
  } catch (error) {
    logger.error(`Error fetching metadata for ${url}:`, error);
    return {
      title: 'Error fetching title',
      description: 'Error fetching description'
    };
  }
}

// Handle ready event
client.once(Events.ClientReady, (c) => {
  logger.info(`Discord bot logged in as ${c.user.tag}`);
  logger.info(`Bot is in ${c.guilds.cache.size} guilds`);
  logger.info('Bot is ready to process messages');
});

// Handle message creation
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore bot messages
    if (message.author.bot) {
      logger.debug('Ignoring message from bot');
      return;
    }

    logger.info(`Received message from ${message.author.username} in #${message.channel.name}: ${message.content}`);

    // Extract URLs from message
    const urls = message.content.match(urlPattern);
    if (!urls) {
      return;
    }

    logger.info(`Found ${urls.length} URLs in message`);

    // Process each URL
    for (const url of urls) {
      try {
        // Get metadata for the URL
        const metadata = await getMetadata(url);
        
        // Get the maximum display_order for the system user
        const maxOrderResult = await pool.query(
          'SELECT COALESCE(MAX(display_order), 0) as max_order FROM articles WHERE user_id = $1',
          [systemUserId]
        );
        const newOrder = maxOrderResult.rows[0].max_order + 1;

        // Save the article
        const result = await pool.query(
          'INSERT INTO articles (url, notes, display_order, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [
            url,
            `Posted by ${message.author.username} in #${message.channel.name}\n${metadata.description || ''}`,
            newOrder,
            systemUserId
          ]
        );

        logger.info(`Saved URL: ${url} from Discord message`);

        // React to the message
        await message.react('✅');

        // Send confirmation message
        const timestamp = Math.floor(Date.now() / 1000);
        const reply = await message.reply(`URL saved to News Article Saver: ${url}\nSaved at: <t:${timestamp}:F>`);

        // Delete the original message and the reply after 5 seconds
        setTimeout(async () => {
          try {
            await message.delete();
            await reply.delete();
            logger.info('Deleted Discord messages');
          } catch (err) {
            logger.error('Error deleting Discord messages:', err);
          }
        }, 5000);

      } catch (err) {
        if (err.code === '23505') { // Unique violation
          logger.info(`URL already exists: ${url}`);
          await message.react('⚠️');
        } else {
          logger.error(`Error saving URL ${url}:`, err);
          await message.react('❌');
        }
      }
    }
  } catch (err) {
    logger.error('Error processing Discord message:', err);
  }
});

// Error handling
client.on('error', error => {
  logger.error('Discord client error:', error);
});

// Debug events
client.on('debug', info => {
  logger.debug('Discord debug:', info);
});

client.on('warn', info => {
  logger.warn('Discord warning:', info);
});

// Start the bot
async function startBot() {
  try {
    logger.info('Attempting to start Discord bot...');
    
    // Get system user ID before connecting
    await getSystemUserId();
    
    // Connect to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    logger.info('Discord bot started successfully');
  } catch (err) {
    logger.error('Failed to start Discord bot:', err);
    process.exit(1);
  }
}

module.exports = { startBot, getSystemUserId }; 