const express = require('express');
const router = express.Router({ mergeParams: true });
const likesController = require('../controllers/likes');
const { isLoggedIn } = require('../middleware');

router.post('/', isLoggedIn, likesController.toggleLike);

module.exports = router;
