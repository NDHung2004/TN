const express = require('express');
const router = express.Router({ mergeParams: true });
const dislikesController = require('../controllers/dislikes');
const { isLoggedIn } = require('../middleware');

router.post('/', isLoggedIn, dislikesController.toggleDislike);

module.exports = router;
