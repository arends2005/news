const articleController = require('../controllers/articleController');
const categoryRoutes = require('./categoryRoutes');

module.exports = (app, pool) => {
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

  // Category routes
  app.use('/categories', categoryRoutes(pool));
};