const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const { Pool } = require('pg');
const logger = require('../logger');
const axios = require('axios');
const cheerio = require('cheerio');

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

// Initialize database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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
    // Log message received
    logger.info(`Received message from ${message.author.username} in #${message.channel.name}: ${message.content}`);
    
    // Ignore messages from bots
    if (message.author.bot) {
      logger.debug('Ignoring message from bot');
      return;
    }

    // Extract URLs from the message
    const urls = message.content.match(urlPattern);
    if (!urls) {
      logger.debug('No URLs found in message');
      return;
    }

    logger.info(`Found ${urls.length} URLs in message`);

    // Save each URL to the database
    for (const url of urls) {
      try {
        const timestamp = new Date();
        const metadata = await fetchUrlMetadata(url);
        const notes = `Submitted by ${message.author.username} in #${message.channel.name} at ${timestamp.toISOString()}\n\nTitle: ${metadata.title}\nDescription: ${metadata.description}`;
        
        const result = await pool.query(
          'INSERT INTO articles (url, notes) VALUES ($1, $2) RETURNING *',
          [url, notes]
        );

        logger.info(`Saved URL: ${url} from Discord message`);
        
        // React to the message to indicate success
        await message.react('✅');
        
        // Send a confirmation message with timestamp
        const confirmationMsg = await message.reply(`URL saved to News Article Saver: ${url}\nSaved at: ${formatTimestamp(timestamp)}`);
        
        // Delete the original message after a short delay
        try {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
          await message.delete();
          logger.info('Original message deleted successfully');
          
          // Delete the confirmation message after another delay
          await new Promise(resolve => setTimeout(resolve, 3000));
          await confirmationMsg.delete();
          logger.info('Confirmation message deleted successfully');
        } catch (deleteError) {
          logger.error('Error deleting messages:', deleteError);
          // Don't throw the error - we still want to continue processing other URLs
        }
      } catch (err) {
        if (err.code === '23505') { // Unique violation error code
          logger.warn(`URL already exists: ${url}`);
          await message.react('ℹ️');
          const duplicateMsg = await message.reply(`This URL has already been saved.\nChecked at: ${formatTimestamp(new Date())}`);
          
          // Delete the duplicate message after a delay
          try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await duplicateMsg.delete();
          } catch (deleteError) {
            logger.error('Error deleting duplicate message:', deleteError);
          }
        } else {
          logger.error('Database error:', err);
          throw err;
        }
      }
    }
  } catch (error) {
    logger.error('Error processing Discord message:', error);
    try {
      await message.react('❌');
      const errorMsg = await message.reply(`Sorry, there was an error saving the URL.\nError occurred at: ${formatTimestamp(new Date())}`);
      
      // Delete the error message after a delay
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await errorMsg.delete();
      } catch (deleteError) {
        logger.error('Error deleting error message:', deleteError);
      }
    } catch (reactionError) {
      logger.error('Error sending error reaction:', reactionError);
    }
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

// Export the client to be used in the main application
module.exports = client; 