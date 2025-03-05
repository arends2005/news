-- Add user_id column to categories table
ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Create index on user_id for faster lookups
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Update existing categories to belong to a default user (if any exist)
UPDATE categories 
SET user_id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
WHERE user_id IS NULL; 