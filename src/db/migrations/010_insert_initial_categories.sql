-- Insert initial categories if they don't exist
INSERT INTO categories (name, description) VALUES
    ('AI Tools', 'Articles about artificial intelligence tools and applications'),
    ('Crypto', 'Articles about cryptocurrency, blockchain, and digital assets'),
    ('Docker', 'Articles about Docker containers, containerization, and related technologies'),
    ('Terminal', 'Articles about terminal usage, command line tools, and shell scripting'),
    ('YouTube', 'Articles about YouTube, video content creation, and platform features')
ON CONFLICT (name) DO NOTHING; 