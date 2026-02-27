const express = require("express");
const router = express.Router({ mergeParams: true });
const catchAsync = require("../utils/catchAsync");
const { validateReview, isLoggedIn, isReviewAuthor } = require("../middleware");
const reviews = require("../controllers/reviews");
const Review = require('../models/reviews');
const Campground = require('../models/campground');
router.post(
  "/",
  isLoggedIn,
  validateReview,

  catchAsync(reviews.createReview)
);

router.delete(
  "/:reviewId",
  isLoggedIn,
  isReviewAuthor,
  catchAsync(reviews.deleteReview)
);
// Route: Người dùng báo cáo bình luận
router.patch('/:reviewId/report', isLoggedIn, catchAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    await Review.findByIdAndUpdate(reviewId, { isReported: true });
    req.flash('success', 'Đã báo cáo bình luận vi phạm. Admin sẽ xem xét!');
    res.redirect(`/campgrounds/${id}`);
}));
module.exports = router;
