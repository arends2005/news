-- Copy categories from user 1 to all other users
INSERT INTO categories (user_id, name)
SELECT u.id, c.name
FROM users u
CROSS JOIN categories c
WHERE c.user_id = 1
AND u.id != 1
AND NOT EXISTS (
    SELECT 1 
    FROM categories c2 
    WHERE c2.user_id = u.id 
    AND c2.name = c.name
); 