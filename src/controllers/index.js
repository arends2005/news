const { createArticleTable } = require('../models/article');
const logger = require('../logger');

const getArticles = (pool) => async (req, res) => {
  try {
    // Ensure table exists
    await createArticleTable(pool);
    
    const result = await pool.query(
      'SELECT * FROM articles ORDER BY created_at DESC'
    );
    
    res.render('index', { articles: result.rows });
  } catch (err) {
    logger.error('Error fetching articles: %o', err);
    res.status(500).render('index', { 
      articles: [],
      error: 'Failed to load articles' 
    });
  }
};

const addArticle = (pool) => async (req, res) => {
  try {
    const { url, notes } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO articles (url, notes) VALUES ($1, $2) RETURNING *',
      [url, notes || '']
    );
    
    res.redirect('/');
  } catch (err) {
    logger.error('Error adding article: %o', err);
    res.status(500).json({ error: 'Failed to add article' });
  }
};

const updateArticle = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    const result = await pool.query(
      'UPDATE articles SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating article: %o', err);
    res.status(500).json({ error: 'Failed to update article' });
  }
};

const deleteArticle = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    const result = await pool.query(
      'DELETE FROM articles WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    logger.error('Error deleting article: %o', err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};

module.exports = {
  getArticles,
  addArticle,
  updateArticle,
  deleteArticle
};