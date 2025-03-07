const { createArticleTable } = require('../models/article');
const logger = require('../logger');

const getArticles = (pool) => async (req, res) => {
  try {
    // Ensure table exists
    await createArticleTable(pool);
    
    // Build the query based on filter
    let query = `
      SELECT a.*, 
        ARRAY_AGG(ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL) as categories
      FROM articles a
      LEFT JOIN article_categories ac ON a.id = ac.article_id
    `;
    const params = [];
    let paramCount = 1;

    // Add user_id filter
    query += ' WHERE a.user_id = $' + paramCount;
    params.push(req.user.id);
    paramCount++;

    // Add category filter if specified
    const categories = req.query.categories ? req.query.categories.split(',') : [];
    if (categories.length > 0) {
      query += ' AND a.id IN (SELECT article_id FROM article_categories WHERE category_id = ANY($' + paramCount + '))';
      params.push(categories);
      paramCount++;
    }

    // Add favorite filter if specified
    if (req.query.filter === 'favorites') {
      query += ' AND a.favorite = true';
    }

    // Add grouping and ordering
    query += ' GROUP BY a.id ORDER BY a.created_at DESC';
    
    // Fetch both articles and categories
    const [articlesResult, categoriesResult] = await Promise.all([
      pool.query(query, params),
      pool.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [req.user.id])
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
        currentFilter: req.query.filter || 'all',
        query: req.query
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
    const { url, notes, categories } = req.body;
    
    if (!url) {
      logger.warn('URL is required');
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    logger.info(`Adding article with URL: ${url}`);

    // Get the maximum display_order for this user
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM articles WHERE user_id = $1',
      [req.user.id]
    );
    const newOrder = maxOrderResult.rows[0].max_order + 1;
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Insert the article
    const result = await pool.query(
      'INSERT INTO articles (url, notes, display_order, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [url, notes || '', newOrder, req.user.id]
    );
    
    const article = result.rows[0];
    
    // Add categories if provided
    if (categories && categories.length > 0) {
      const values = categories.map((categoryId, index) => 
        `($1, $${index + 2})`
      ).join(',');
      
      await pool.query(
        `INSERT INTO article_categories (article_id, category_id) VALUES ${values}`,
        [article.id, ...categories]
      );
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    // Fetch the complete article with categories
    const completeResult = await pool.query(`
      SELECT a.*, 
        ARRAY_AGG(ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL) as categories
      FROM articles a
      LEFT JOIN article_categories ac ON a.id = ac.article_id
      WHERE a.id = $1 AND a.user_id = $2
      GROUP BY a.id
    `, [article.id, req.user.id]);
    
    logger.info(`Article added successfully: ${JSON.stringify(completeResult.rows[0])}`);
    
    res.status(200).json({ success: true, article: completeResult.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
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
      'UPDATE articles SET notes = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [notes, id, req.user.id]
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
      WHERE a.id = $1 AND a.user_id = $2
      GROUP BY a.id
    `, [id, req.user.id]);
    
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
    
    // Get system user ID
    const systemUserResult = await pool.query('SELECT id FROM users WHERE username = $1', ['system']);
    const systemUserId = systemUserResult.rows[0]?.id;
    
    // First check if the article exists and belongs to either the user or the system user
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND (user_id = $2 OR user_id = $3)',
      [id, req.user.id, systemUserId]
    );
    
    if (checkResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      logger.info(`Article with ID ${id} not found or not owned by user or system`);
      return res.status(404).json({ success: false, error: 'Article not found or already deleted' });
    }
    
    // Delete article categories first
    await pool.query(
      'DELETE FROM article_categories WHERE article_id = $1',
      [id]
    );
    
    // Then delete the article
    const result = await pool.query(
      'DELETE FROM articles WHERE id = $1 AND (user_id = $2 OR user_id = $3) RETURNING *',
      [id, req.user.id, systemUserId]
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
      'UPDATE articles SET favorite = NOT favorite WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    
    res.json({ success: true, article: result.rows[0] });
  } catch (err) {
    logger.error('Error toggling favorite:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
  }
};

const updateOrder = (pool) => async (req, res) => {
  try {
    const { articles } = req.body;
    
    if (!Array.isArray(articles)) {
      return res.status(400).json({ success: false, error: 'Articles array is required' });
    }
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Update each article's order
    for (const article of articles) {
      await pool.query(
        'UPDATE articles SET display_order = $1 WHERE id = $2 AND user_id = $3',
        [article.order, article.id, req.user.id]
      );
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    logger.error('Error updating article order:', err);
    res.status(500).json({ success: false, error: 'Failed to update article order' });
  }
};

const exportArticles = (pool) => async (req, res) => {
  try {
    const { format } = req.query;
    
    // Fetch articles with categories
    const query = `
      SELECT a.*, 
        ARRAY_AGG(ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL) as categories
      FROM articles a
      LEFT JOIN article_categories ac ON a.id = ac.article_id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `;
    
    const articlesResult = await pool.query(query, [req.user.id]);
    const articles = articlesResult.rows;
    
    // Fetch categories for reference
    const categoriesResult = await pool.query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC',
      [req.user.id]
    );
    const categories = categoriesResult.rows;
    
    if (format === 'json') {
      // Export as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=articles.json');
      res.json({
        articles: articles.map(article => ({
          ...article,
          categories: article.categories.map(catId => {
            const category = categories.find(c => c.id === catId);
            return category ? category.name : null;
          }).filter(Boolean)
        })),
        categories: categories
      });
    } else if (format === 'markdown') {
      // Export as Markdown
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename=articles.md');
      
      let markdown = '# Saved Articles\n\n';
      
      articles.forEach((article, index) => {
        markdown += `## ${index + 1}. ${article.url}\n\n`;
        
        if (article.categories && article.categories.length > 0) {
          markdown += '**Categories:** ';
          markdown += article.categories
            .map(catId => {
              const category = categories.find(c => c.id === catId);
              return category ? `\`${category.name}\`` : null;
            })
            .filter(Boolean)
            .join(' ');
          markdown += '\n\n';
        }
        
        if (article.notes) {
          markdown += '**Notes:**\n';
          markdown += article.notes + '\n\n';
        }
        
        markdown += `*Added on: ${new Date(article.created_at).toLocaleDateString()}*\n\n`;
        markdown += '---\n\n';
      });
      
      res.send(markdown);
    } else {
      res.status(400).json({ success: false, error: 'Invalid export format' });
    }
  } catch (err) {
    logger.error('Error exporting articles:', err);
    res.status(500).json({ success: false, error: 'Failed to export articles' });
  }
};

module.exports = {
  getArticles,
  addArticle,
  updateArticle,
  deleteArticle,
  toggleFavorite,
  updateOrder,
  exportArticles
};
