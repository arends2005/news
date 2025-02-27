const express = require('express');
const { addCategory, getCategories } = require('../controllers/categoryController');

const router = express.Router();

module.exports = (pool) => {
  // Get all categories
  router.get('/', getCategories(pool));

  // Add a new category
  router.post('/', addCategory(pool));

  return router;
}; 