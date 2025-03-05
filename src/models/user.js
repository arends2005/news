const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const logger = require('../logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Default categories for new users
const defaultCategories = [
  'AI IDE', 'AI Tools', 'Terminal', 'Ubuntu', 'Tutorials',
  'Tips', 'Tricks', 'Hacks', 'Docker', 'Coding Agent',
  'Python', 'Git', 'Crypto'
];

class User {
  static async create({ username, email, password, isAdmin = false }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Start a transaction
    await pool.query('BEGIN');
    
    try {
      // Create the user
      const query = `
        INSERT INTO users (username, email, password, dark_mode, is_admin)
        VALUES ($1, $2, $3, true, $4)
        RETURNING id, username, email, dark_mode, is_admin
      `;
      const values = [username, email, hashedPassword, isAdmin];
      const result = await pool.query(query, values);
      const user = result.rows[0];
      
      // Add default categories for the new user
      for (const category of defaultCategories) {
        await pool.query(
          'INSERT INTO categories (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
          [user.id, category]
        );
      }
      
      // Commit the transaction
      await pool.query('COMMIT');
      
      return user;
    } catch (error) {
      // Rollback the transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT id, username, email, password, dark_mode, is_admin FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT id, username, email, dark_mode, is_admin FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async updateDarkMode(userId, darkMode) {
    console.log('Updating dark mode for user:', userId, 'to:', darkMode);
    const query = `
      UPDATE users 
      SET dark_mode = $1 
      WHERE id = $2 
      RETURNING id, username, email, dark_mode, is_admin
    `;
    const result = await pool.query(query, [darkMode, userId]);
    console.log('Update result:', result.rows[0]);
    return result.rows[0];
  }

  static async getDarkMode(userId) {
    const query = 'SELECT dark_mode FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    console.log('Current dark mode setting:', result.rows[0]?.dark_mode ?? true);
    return result.rows[0]?.dark_mode ?? true;
  }

  static async getUserCount() {
    const query = 'SELECT COUNT(*) FROM users';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Admin methods
  static async getAllUsers() {
    const query = `
      SELECT id, username, email, dark_mode, is_admin, created_at, 
             (SELECT COUNT(*) FROM articles WHERE user_id = users.id) as article_count
      FROM users
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async deleteUser(userId) {
    // Start a transaction
    await pool.query('BEGIN');
    
    try {
      // Delete user's articles
      await pool.query('DELETE FROM articles WHERE user_id = $1', [userId]);
      
      // Delete user's categories
      await pool.query('DELETE FROM categories WHERE user_id = $1', [userId]);
      
      // Delete the user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      
      // Commit the transaction
      await pool.query('COMMIT');
      return true;
    } catch (error) {
      // Rollback the transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  static async resetPassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = 'UPDATE users SET password = $1 WHERE id = $2';
    await pool.query(query, [hashedPassword, userId]);
  }

  static async updatePassword(userId, currentPassword, newPassword) {
    // Get user's current password
    const query = 'SELECT password FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    const user = result.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  }

  static async toggleAdmin(userId) {
    const query = `
      UPDATE users 
      SET is_admin = NOT is_admin 
      WHERE id = $1 
      RETURNING id, username, email, is_admin
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = User; 