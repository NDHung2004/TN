const Interaction = require('../models/interaction');

module.exports.logView = async (req, res, next) => {
    next(); // Trả về trang ngay lập tức, không để user phải đợi DB ghi xong

    try {
        const restaurantId = req.params.id;
        const userId = req.user ? req.user._id : null;

        // Lưu log tương tác (loại: view)
        const newInteraction = new Interaction({
            user: userId,
            restaurant: restaurantId,
            interactionType: 'view',
            weight: 1
        });
        await newInteraction.save();
    } catch (e) {
        // Ghi log ngầm lỗi nếu có, không làm hỏng trải nghiệm người dùng
        console.error('Lỗi khi ghi nhận log tương tác:', e);
    }
};
