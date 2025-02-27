const logger = require('../logger');

const addCategory = (pool) => async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      logger.warn('Category name is required');
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    // First check if category exists
    const existingCategory = await pool.query(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(200).json({ 
        success: true, 
        category: existingCategory.rows[0],
        message: 'Category already exists'
      });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    logger.info(`Category added successfully: ${JSON.stringify(result.rows[0])}`);
    res.status(200).json({ 
      success: true, 
      category: result.rows[0],
      message: 'Category added successfully'
    });
  } catch (err) {
    logger.error(`Error adding category: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to add category' });
  }
};

const getCategories = (pool) => async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    logger.error(`Error fetching categories: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

module.exports = {
  addCategory,
  getCategories
}; 