const Restaurant = require("../models/restaurant");
const Review = require("../models/reviews");
const { analyzeReview } = require('../utils/aiAnalyzer');
module.exports.createReview = async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  const userReviewCount = await Review.countDocuments({
    author: req.user._id,
    _id: { $in: restaurant.reviews }
  });
  if (userReviewCount >= 10) {
    req.flash('error', 'Bạn chỉ có thể đăng tối đa 10 bình luận cho mỗi quán!');
    return res.redirect(`/restaurants/${restaurant._id}`);
  }

  const review = new Review(req.body.review);
  review.author = req.user._id;
  // Gửi nội dung bình luận cho AI và đợi kết quả (mất khoảng 1-2 giây)
  const aiResult = await analyzeReview(review.body);
  review.sentiment = aiResult.sentiment;
  review.isToxic = aiResult.isToxic;
  restaurant.reviews.push(review);
  await review.save();
  await restaurant.save();
  if (review.isToxic) {
        req.flash('error', 'Cảnh báo: Bình luận của bạn vi phạm tiêu chuẩn cộng đồng và đã bị ẩn!');
    } else {
        req.flash('success', 'Đã thêm đánh giá thành công!');
    }
  // Duplicate flash msg removed
  res.redirect(`/restaurants/${restaurant._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Restaurant.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId },
  });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Đã xóa đánh giá thành công!");
  res.redirect(`/restaurants/${id}`);
};
