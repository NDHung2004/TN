const express = require("express");
const router = express.Router();
const passport = require("passport");
const catchAsync = require("../utils/catchAsync");
const users = require("../controllers/users");
const { isLoggedIn } = require('../middleware');
router.route('/register')
    .get(users.renderRegister) // <-- BỎ catchAsync Ở DÒNG NÀY (nếu có)
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
router.get('/my-restaurants', isLoggedIn, users.renderMyCampgrounds);
router.get("/logout", users.logout);
router.get('/favorites', isLoggedIn, users.renderFavorites);
module.exports = router;
