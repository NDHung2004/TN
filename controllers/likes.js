const Like = require('../models/like');
const Dislike = require('../models/dislike');
const Review = require('../models/reviews');

module.exports.toggleLike = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user._id;

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ success: false, error: 'Không tìm thấy đánh giá' });

        const existingLike = await Like.findOne({ user: userId, review: reviewId });

        if (existingLike) {
            // Unlike
            await Like.findByIdAndDelete(existingLike._id);
            review.likeCount = Math.max(0, review.likeCount - 1);
            await review.save();
            return res.status(200).json({ success: true, isLiked: false, likeCount: review.likeCount });
        } else {
            // Like
            const newLike = new Like({ user: userId, review: reviewId });
            await newLike.save();
            review.likeCount += 1;
            
            // Remove dislike if exists
            const existingDislike = await Dislike.findOne({ user: userId, review: reviewId });
            if (existingDislike) {
                await Dislike.findByIdAndDelete(existingDislike._id);
                review.dislikeCount = Math.max(0, review.dislikeCount - 1);
            }
            
            await review.save();
            return res.status(200).json({ success: true, isLiked: true, likeCount: review.likeCount, isDislikedRemoved: !!existingDislike, dislikeCount: review.dislikeCount });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Đã xảy ra lỗi hệ thống' });
    }
};
