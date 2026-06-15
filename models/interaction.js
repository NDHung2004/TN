const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const interactionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User' // Có thể null nếu user chưa đăng nhập
    },
    restaurant: {
        type: Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    interactionType: {
        type: String,
        enum: ['view', 'like_review', 'save', 'search_click'],
        required: true
    },
    weight: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

// Index để tìm kiếm nhanh khi chạy thuật toán gợi ý
interactionSchema.index({ user: 1, restaurant: 1 });

module.exports = mongoose.model('Interaction', interactionSchema);
