const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  body: String,
  rating: Number,
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  isReported: {
        type: Boolean,
        default: false
    },
  sentiment: { 
        type: String, 
        enum: ['positive', 'negative', 'neutral'], // Tích cực, Tiêu cực, Bình thường
        default: 'neutral' 
  },
  isToxic: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });
module.exports = mongoose.model("Review", reviewSchema);
