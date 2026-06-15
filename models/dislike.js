const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const dislikeSchema = new Schema({
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

// Đảm bảo 1 user chỉ có thể dislike 1 review 1 lần
dislikeSchema.index({ user: 1, review: 1 }, { unique: true });

module.exports = mongoose.model('Dislike', dislikeSchema);
