-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create an index on is_admin for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin); 