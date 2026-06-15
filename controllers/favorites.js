const Favorite = require('../models/favorite');
const Restaurant = require('../models/restaurant');

module.exports.toggleFavorite = async (req, res) => {
    try {
        const { id } = req.params; // Restaurant ID
        const userId = req.user._id;

        // Kiểm tra xem đã lưu chưa
        const existingFavorite = await Favorite.findOne({ user: userId, restaurant: id });

        const isAjax = req.xhr || (req.get('Content-Type') && req.get('Content-Type').includes('application/json'));

        if (existingFavorite) {
            // Đã lưu -> Xóa đi (Unsave)
            await Favorite.findByIdAndDelete(existingFavorite._id);
            if(isAjax) return res.status(200).json({ success: true, isFavorited: false, message: 'Đã bỏ lưu quán' });
            req.flash('success', 'Đã bỏ lưu quán!');
            return res.redirect('back');
        } else {
            // Chưa lưu -> Thêm vào (Save)
            const newFavorite = new Favorite({ user: userId, restaurant: id });
            await newFavorite.save();
            if(isAjax) return res.status(200).json({ success: true, isFavorited: true, message: 'Đã lưu quán vào bộ sưu tập' });
            req.flash('success', 'Đã lưu quán thành công!');
            return res.redirect('back');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Đã xảy ra lỗi hệ thống' });
    }
};
