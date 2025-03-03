const { createArticleTable } = require('../models/article');
const logger = require('../logger');

const getArticles = (pool) => async (req, res) => {
  try {
    await createArticleTable(pool);
    
    const { filter = 'all', categories } = req.query;
    let query = '';
    let params = [];
    
    // Base query with category join
    const baseQuery = `
      SELECT a.*, 
        ARRAY_AGG(ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL) as categories
      FROM articles a
      LEFT JOIN article_categories ac ON a.id = ac.article_id
    `;

    // Build WHERE clause
    let whereClause = [];
    let groupByClause = 'GROUP BY a.id';
    let orderByClause = '';

    // Add category filter if specified
    if (categories) {
      params.push(categories.split(',').map(Number));
      whereClause.push(`ac.category_id = ANY($${params.length}::int[])`);
    }

    // Add other filters
    switch (filter) {
      case 'favorites':
        whereClause.push('a.favorite = true');
        orderByClause = 'ORDER BY a.display_order ASC';
        break;
      case 'newest':
        orderByClause = 'ORDER BY a.created_at DESC';
        break;
      case 'oldest':
        orderByClause = 'ORDER BY a.created_at ASC';
        break;
      default:
        orderByClause = 'ORDER BY a.display_order ASC';
    }

    // Construct final query
    query = baseQuery;
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
    }
    query += ' ' + groupByClause + ' ' + orderByClause;
    
    // Fetch both articles and categories
    const [articlesResult, categoriesResult] = await Promise.all([
      pool.query(query, params),
      pool.query('SELECT * FROM categories ORDER BY name ASC')
    ]);
    
    if (req.xhr || req.headers.accept.includes('application/json')) {
      res.json({ 
        success: true, 
        articles: articlesResult.rows,
        categories: categoriesResult.rows 
      });
    } else {
      res.render('index', { 
        articles: articlesResult.rows,
        categories: categoriesResult.rows,
        currentFilter: filter 
      });
    }
  } catch (err) {
    logger.error('Error fetching articles: %o', err);
    if (req.xhr || req.headers.accept.includes('application/json')) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to load articles' 
      });
    } else {
      res.status(500).render('index', { 
        articles: [],
        categories: [],
        error: 'Failed to load articles' 
      });
    }
  }
};

const addArticle = (pool) => async (req, res) => {
  try {
    const { url, notes } = req.body;
    
    if (!url) {
      logger.warn('URL is required');
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    logger.info(`Adding article with URL: ${url}`);

    // Get the maximum display_order
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM articles'
    );
    const newOrder = maxOrderResult.rows[0].max_order + 1;
    
    const result = await pool.query(
      'INSERT INTO articles (url, notes, display_order) VALUES ($1, $2, $3) RETURNING *',
      [url, notes || '', newOrder]
    );
    
    logger.info(`Article added successfully: ${JSON.stringify(result.rows[0])}`);
    
    res.status(200).json({ success: true, article: result.rows[0] });
  } catch (err) {
    logger.error(`Error adding article: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to add article' });
  }
};

const updateArticle = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, categories } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID is required' });
    }
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Update article notes
    const articleResult = await pool.query(
      'UPDATE articles SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [notes, id]
    );
    
    if (articleResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    
    // Update article categories if provided
    if (categories) {
      // First, remove all existing categories for this article
      await pool.query(
        'DELETE FROM article_categories WHERE article_id = $1',
        [id]
      );
      
      // Then add the new categories
      if (categories.length > 0) {
        const values = categories.map((categoryId, index) => 
          `($1, $${index + 2})`
        ).join(',');
        
        await pool.query(
          `INSERT INTO article_categories (article_id, category_id) VALUES ${values}`,
          [id, ...categories]
        );
      }
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    // Fetch the updated article with its categories
    const result = await pool.query(`
      SELECT a.*, 
        ARRAY_AGG(ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL) as categories
      FROM articles a
      LEFT JOIN article_categories ac ON a.id = ac.article_id
      WHERE a.id = $1
      GROUP BY a.id
    `, [id]);
    
    res.json({ success: true, article: result.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    logger.error('Error updating article:', err);
    res.status(500).json({ success: false, error: 'Failed to update article' });
  }
};

const deleteArticle = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      logger.warn('ID is required');
      return res.status(400).json({ success: false, error: 'ID is required' });
    }
    
    logger.info(`Deleting article with ID: ${id}`);
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // First check if the article exists
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      logger.info(`Article with ID ${id} not found (already deleted)`);
      return res.status(404).json({ success: false, error: 'Article not found or already deleted' });
    }
    
    // Delete article categories first
    await pool.query(
      'DELETE FROM article_categories WHERE article_id = $1',
      [id]
    );
    
    // Then delete the article
    const result = await pool.query(
      'DELETE FROM articles WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    logger.info(`Article with ID ${id} deleted successfully`);
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    logger.error(`Error deleting article: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to delete article' });
  }
};

const toggleFavorite = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID is required' });
    }
    
    const result = await pool.query(
      'UPDATE articles SET favorite = NOT favorite WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    
    res.json({ success: true, article: result.rows[0] });
  } catch (err) {
    logger.error(`Error toggling favorite: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
  }
};

const updateOrder = (pool) => async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'Orders array is required' });
    }
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Update each article's order
    for (const { id, order } of orders) {
      // Convert id and order to integers
      const articleId = parseInt(id);
      const displayOrder = parseInt(order);
      
      if (isNaN(articleId) || isNaN(displayOrder)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid ID or order value' 
        });
      }
      
      await pool.query(
        'UPDATE articles SET display_order = $1 WHERE id = $2',
        [displayOrder, articleId]
      );
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json({ success: true });
  } catch (err) {
    // Rollback on error
    await pool.query('ROLLBACK');
    logger.error(`Error updating order: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
};

module.exports = {
  getArticles,
  addArticle,
  updateArticle,
  deleteArticle,
  toggleFavorite,
  updateOrder
};
