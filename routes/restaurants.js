const express = require("express");

const restaurants = require("../controllers/restaurants");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const { isLoggedIn, isAuthor, validateRestaurant } = require("../middleware");
const { logView } = require("../middleware/interactionLogger");
const multer = require("multer");
const { storage } = require("../cloudinary/index.js");
const upload = multer({ storage });
router
  .route("/")
  .get(catchAsync(restaurants.index))
  .post(
    isLoggedIn,
    upload.array("image"),
    validateRestaurant,
    catchAsync(restaurants.createRestaurant)
  );

router.get("/new", isLoggedIn, restaurants.renderNewForm);

router
  .route("/:id")
  .get(logView, catchAsync(restaurants.showRestaurant))
  .put(
    isLoggedIn,
    isAuthor,
    upload.array("image"),
    validateRestaurant,
    catchAsync(restaurants.updateRestaurant)
  )
  .delete(isLoggedIn, isAuthor, catchAsync(restaurants.deleteRestaurant));

router.get(
  "/:id/edit",
  isLoggedIn,
  isAuthor,
  catchAsync(restaurants.renderEditForm)
);

module.exports = router;
