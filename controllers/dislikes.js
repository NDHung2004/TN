const Like = require('../models/like');
const Dislike = require('../models/dislike');
const Review = require('../models/reviews');

module.exports.toggleDislike = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user._id;

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ success: false, error: 'Không tìm thấy đánh giá' });

        const existingDislike = await Dislike.findOne({ user: userId, review: reviewId });

        if (existingDislike) {
            // Remove Dislike
            await Dislike.findByIdAndDelete(existingDislike._id);
            review.dislikeCount = Math.max(0, review.dislikeCount - 1);
            await review.save();
            return res.status(200).json({ success: true, isDisliked: false, dislikeCount: review.dislikeCount });
        } else {
            // Add Dislike
            const newDislike = new Dislike({ user: userId, review: reviewId });
            await newDislike.save();
            review.dislikeCount += 1;
            
            // Remove like if exists
            const existingLike = await Like.findOne({ user: userId, review: reviewId });
            if (existingLike) {
                await Like.findByIdAndDelete(existingLike._id);
                review.likeCount = Math.max(0, review.likeCount - 1);
            }
            
            await review.save();
            return res.status(200).json({ success: true, isDisliked: true, dislikeCount: review.dislikeCount, isLikedRemoved: !!existingLike, likeCount: review.likeCount });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Đã xảy ra lỗi hệ thống' });
    }
};
