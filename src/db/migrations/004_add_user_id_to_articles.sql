-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'articles' AND column_name = 'user_id') THEN
        ALTER TABLE articles ADD COLUMN user_id INTEGER REFERENCES users(id);
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);

-- Update existing articles to use system user
UPDATE articles SET user_id = 1 WHERE user_id IS NULL; 