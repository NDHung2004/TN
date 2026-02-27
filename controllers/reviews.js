const Campground = require("../models/campground");
const Review = require("../models/reviews");
const { analyzeReview } = require('../utils/aiAnalyzer');
module.exports.createReview = async (req, res) => {
  const campground = await Campground.findById(req.params.id);
  const review = new Review(req.body.review);
  review.author = req.user._id;
  // Gửi nội dung bình luận cho AI và đợi kết quả (mất khoảng 1-2 giây)
  const aiResult = await analyzeReview(review.body);
  review.sentiment = aiResult.sentiment;
  review.isToxic = aiResult.isToxic;
  campground.reviews.push(review);
  await review.save();
  await campground.save();
  if (review.isToxic) {
        req.flash('error', 'Cảnh báo: Bình luận của bạn vi phạm tiêu chuẩn cộng đồng và đã bị ẩn!');
    } else {
        req.flash('success', 'Đã thêm đánh giá thành công!');
    }
  req.flash("success", "Created new review!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Campground.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId },
  });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Successfully deleted review!");
  res.redirect(`/campgrounds/${id}`);
};
