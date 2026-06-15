const express = require('express');
const router = express.Router({ mergeParams: true });
const followsController = require('../controllers/follows');
const { isLoggedIn } = require('../middleware');

router.post('/', isLoggedIn, followsController.toggleFollow);

module.exports = router;
