const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passwordLocalMongoose = require("passport-local-mongoose");
const Campground = require('../models/campground');
const UserSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  role: {
        type: String,
        enum: ['user', 'moderator', 'admin'], // 3 vai trò
        default: 'user'
    },
    isBanned: {
        type: Boolean,
        default: false // Mặc định không bị khóa
    },
  favorites: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Campground'
        }
    ]
}, { timestamps: true });
UserSchema.plugin(passwordLocalMongoose);
module.exports.renderFavorites = async (req, res) => {
    
    const user = await User.findById(req.user._id).populate('favorites');
    
    res.render('users/favorites', { favorites: user.favorites });
}
module.exports = mongoose.model("User", UserSchema);
