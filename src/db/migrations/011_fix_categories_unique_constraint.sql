-- Drop the existing unique constraint on name
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Add a new unique constraint on (user_id, name)
ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name); 