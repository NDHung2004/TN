const express = require("express");
const router = express.Router();
const passport = require("passport");
const catchAsync = require("../utils/catchAsync");
const users = require("../controllers/users");
const { isLoggedIn } = require('../middleware');
const multer = require('multer');
const { storage } = require('../cloudinary');
const upload = multer({ storage });
router.route('/register')
  .get(users.renderRegister)
  .post(catchAsync(users.register));

router
  .route("/login")
  .get(users.renderLogin)
  .post(
    passport.authenticate("local", {
      failureFlash: true,
      failureRedirect: "/login",
    }),
    users.login
  );
router.get('/my-restaurants', isLoggedIn, users.renderMyRestaurants);
router.get("/logout", users.logout);
router.get('/favorites', isLoggedIn, users.renderFavorites);

// Profile routes
router.get('/api/search', catchAsync(users.searchUsers));
router.get('/api/profile/:id/:type', catchAsync(users.getProfileData));
router.get('/profile/:id', users.renderProfile);
router.post('/profile/:id', isLoggedIn, upload.single('avatar'), catchAsync(users.updateProfile));

module.exports = router;
