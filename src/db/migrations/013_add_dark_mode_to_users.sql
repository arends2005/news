-- Add dark_mode column to users table with default value true
ALTER TABLE users ADD COLUMN dark_mode BOOLEAN DEFAULT true; 