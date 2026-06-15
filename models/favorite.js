const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const favoriteSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    collectionName: {
        type: String,
        default: 'Yêu thích chung' // Tên bộ sưu tập (mặc định)
    }
}, { timestamps: true });

// Đảm bảo 1 user không lưu 1 quán nhiều lần trong cùng 1 bộ sưu tập
favoriteSchema.index({ user: 1, restaurant: 1, collectionName: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
