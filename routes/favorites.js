const express = require('express');
const router = express.Router({ mergeParams: true });
const favoritesController = require('../controllers/favorites');
const { isLoggedIn } = require('../middleware');

router.post('/', isLoggedIn, favoritesController.toggleFavorite);

module.exports = router;
