class Article {
    constructor(id, url, notes, createdAt, favorite, displayOrder) {
        this.id = id;
        this.url = url;
        this.notes = notes;
        this.createdAt = createdAt;
        this.favorite = favorite;
        this.displayOrder = displayOrder;
    }
}

/**
 * Creates the articles table if it doesn't exist
 * @param {Object} pool - Database connection pool
 * @returns {Promise} - Resolves when the table is created or already exists
 */
const createArticleTable = async (pool) => {
  try {
    // Create categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `);

    // Create article_categories junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_categories (
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (article_id, category_id)
      )
    `);

    // Create articles table with existing columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        notes TEXT,
        favorite BOOLEAN DEFAULT false,
        display_order INTEGER,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default categories if they don't exist
    const defaultCategories = [
      'AI IDE', 'AI Tools', 'Terminal', 'Ubuntu', 'Tutorials',
      'Tips', 'Tricks', 'Hacks', 'Docker', 'Coding Agent',
      'Python', 'Git', 'Crypto'
    ];

    // Get the first user (user 1) to assign default categories to
    const userResult = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      for (const category of defaultCategories) {
        await pool.query(
          'INSERT INTO categories (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
          [userId, category]
        );
      }
    }

    // Add columns if they don't exist (for existing tables)
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE articles ADD COLUMN favorite BOOLEAN DEFAULT false;
        EXCEPTION
          WHEN duplicate_column THEN 
            RAISE NOTICE 'Column favorite already exists';
        END;
        
        BEGIN
          ALTER TABLE articles ADD COLUMN display_order INTEGER;
        EXCEPTION
          WHEN duplicate_column THEN 
            RAISE NOTICE 'Column display_order already exists';
        END;
      END $$;
    `);

    // Update display_order for existing rows if null
    await pool.query(`
      UPDATE articles 
      SET display_order = id 
      WHERE display_order IS NULL;
    `);

    console.log('Database tables created or updated successfully');
  } catch (err) {
    console.error('Error creating/updating database tables:', err);
    throw err;
  }
};

module.exports = {
  Article,
  createArticleTable
};