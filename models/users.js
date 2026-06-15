const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passwordLocalMongoose = require("passport-local-mongoose");
const Restaurant = require('../models/restaurant');
const UserSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'moderator', 'admin'],
        default: 'user'
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    favorites: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Restaurant'
        }
    ],
    avatar: {
        url: {
            type: String,
            default: 'https://res.cloudinary.com/dv6o0qnvj/image/upload/v1699999999/default-avatar.jpg' // Default avatar
        },
        filename: String
    },
    bio: {
        type: String,
        default: ''
    },
    isPublic: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
UserSchema.plugin(passwordLocalMongoose);
module.exports.renderFavorites = async (req, res) => {

    const user = await User.findById(req.user._id).populate('favorites');

    res.render('users/favorites', { favorites: user.favorites });
}
module.exports = mongoose.model("User", UserSchema);
