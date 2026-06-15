const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const followSchema = new Schema({
    follower: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true // Người đi follow
    },
    following: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true // Người được follow
    }
}, { timestamps: true });

// Đảm bảo không follow trùng lặp
followSchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema);
