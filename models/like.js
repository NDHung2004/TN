const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const likeSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    review: {
        type: Schema.Types.ObjectId,
        ref: 'Review',
        required: true
    }
}, { timestamps: true });

// Đảm bảo 1 user chỉ có thể like 1 review 1 lần
likeSchema.index({ user: 1, review: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
