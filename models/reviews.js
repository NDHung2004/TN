const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const imageSchema = new Schema({
  url: String,
  filename: String,
});
imageSchema.virtual("thumbnail").get(function () {
  return this.url.replace("/upload", "/upload/w_200");
});

const reviewSchema = new Schema({
  body: String,
  rating: Number,
  images: [imageSchema], // Đính kèm ảnh cho bài review
  hashtags: [{ type: String }], // Ví dụ: #ngon #re
  likeCount: { type: Number, default: 0 }, // Cache tổng lượt thích
  dislikeCount: { type: Number, default: 0 }, // Cache tổng lượt dislike
  comments: [{ 
    body: String,
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  isReported: {
    type: Boolean,
    default: false
  },
  sentimentScore: { 
    overall: { type: Number, min: -1, max: 1 },
    food: { type: Number, min: -1, max: 1 },
    service: { type: Number, min: -1, max: 1 },
    ambience: { type: Number, min: -1, max: 1 }
  },
  isToxic: {
    type: Boolean,
    default: false
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  }
}, { timestamps: true });
module.exports = mongoose.model("Review", reviewSchema);
