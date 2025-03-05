-- Add system user for Discord bot
INSERT INTO users (username, email, password, dark_mode)
VALUES ('system', 'system@news-article-saver.local', '$2a$10$YourHashedPasswordHere', false)
ON CONFLICT (username) DO NOTHING; 