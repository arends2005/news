const logger = require('../logger');

const addCategory = (pool) => async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      logger.warn('Category name is required');
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    // First check if category exists for this user
    const existingCategory = await pool.query(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER($1) AND user_id = $2',
      [name.trim(), req.user.id]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(200).json({ 
        success: true, 
        category: existingCategory.rows[0],
        message: 'Category already exists'
      });
    }

    const result = await pool.query(
      'INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING *',
      [name.trim(), req.user.id]
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
    const result = await pool.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
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