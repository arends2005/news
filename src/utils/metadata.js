const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../logger');

async function getMetadata(url) {
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

module.exports = { getMetadata }; 