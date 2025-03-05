const articleController = require('../controllers/articleController');
const categoryRoutes = require('./categoryRoutes');
const { isAuthenticated } = require('../middleware/auth');

module.exports = (app, pool) => {
  // Auth routes are handled separately in app.js

  // Protect all routes below with authentication
  app.use(isAuthenticated);

  // Home page - displays all articles
  app.get('/', articleController.getArticles(pool));
  
  // Add a new article
  app.post('/articles', articleController.addArticle(pool));

  // Update article order
  app.put('/articles/order', articleController.updateOrder(pool));
  
  // Toggle article favorite status
  app.post('/articles/:id/favorite', articleController.toggleFavorite(pool));
  
  // Update an article's notes
  app.put('/articles/:id', articleController.updateArticle(pool));
  
  // Delete an article
  app.delete('/articles/:id', articleController.deleteArticle(pool));

  // Export articles
  app.get('/articles/export', articleController.exportArticles(pool));

  // Category routes
  app.use('/categories', categoryRoutes(pool));
};