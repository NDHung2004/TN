const Follow = require('../models/follow');
const User = require('../models/users');

module.exports.toggleFollow = async (req, res) => {
    try {
        const { userId } = req.params; // ID của người chuẩn bị được theo dõi
        const followerId = req.user._id; // ID của người đang đăng nhập

        if (userId === followerId.toString()) {
            return res.status(400).json({ success: false, error: 'Không thể tự theo dõi chính mình' });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ success: false, error: 'Người dùng không tồn tại' });

        const existingFollow = await Follow.findOne({ follower: followerId, following: userId });

        if (existingFollow) {
            // Bỏ theo dõi
            await Follow.findByIdAndDelete(existingFollow._id);
            return res.status(200).json({ success: true, isFollowing: false, message: 'Đã hủy theo dõi' });
        } else {
            // Theo dõi
            const newFollow = new Follow({ follower: followerId, following: userId });
            await newFollow.save();
            return res.status(200).json({ success: true, isFollowing: true, message: 'Đã theo dõi' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Đã xảy ra lỗi hệ thống' });
    }
};
