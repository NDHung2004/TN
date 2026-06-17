const User = require("../models/users");
const Restaurant = require('../models/restaurant');
const Favorite = require('../models/favorite');
const Follow = require('../models/follow');
const Review = require('../models/reviews');
const { cloudinary } = require('../cloudinary');
module.exports.renderRegister = (req, res) => {
    res.render('users/register');
}

module.exports.renderLogin = (req, res) => {
  res.render("users/login");
};

module.exports.login = (req, res) => {
  req.flash("success", "Chào mừng bạn quay lại!");
  const redirectUrl = req.session.returnTo || "/restaurants";
  delete req.session.returnTo;
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.flash("success", "Tạm biệt!");
    res.redirect("/restaurants");
  });
};

module.exports.register = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        
        // Gán cứng role là 'user' để an toàn
        user.role = 'user'; 

        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'Chào mừng bạn đến với Quán ăn!');
            res.redirect('/restaurants');
        })
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('register');
    }
}
module.exports.renderMyRestaurants = async (req, res) => {
  
    const myRestaurants = await Restaurant.find({ author: req.user._id });
    
  
    res.render('users/my-restaurants', { myRestaurants });
};
module.exports.renderFavorites = async (req, res) => {
    const favs = await Favorite.find({ user: req.user._id }).populate('restaurant');
    // Mảng favs chứa các document Favorite, ta trích xuất lấy các document restaurant bên trong
    const favorites = favs.map(f => f.restaurant);
    res.render('users/favorites', { favorites });
};

module.exports.renderProfile = async (req, res) => {
    const { id } = req.params;
    const targetUser = await User.findById(id);

    if (!targetUser) {
        req.flash('error', 'Không tìm thấy người dùng!');
        return res.redirect('/restaurants');
    }

    const isOwner = req.user && req.user._id.equals(targetUser._id);

    // Lấy quán ăn đã tạo nếu là chủ sở hữu HOẶC tài khoản công khai
    let myRestaurants = [];
    if (isOwner || targetUser.isPublic) {
        myRestaurants = await Restaurant.find({ author: targetUser._id }).limit(5);
    }

    // Đếm Follow
    const followersCount = await Follow.countDocuments({ following: targetUser._id });
    const followingCount = await Follow.countDocuments({ follower: targetUser._id });

    // Lấy bài viết (Reviews) - Tìm nhà hàng tương ứng
    let rawReviews = await Review.find({ author: targetUser._id });
    const reviews = await Promise.all(rawReviews.map(async (rev) => {
        const revObj = rev.toObject();
        revObj.restaurant = await Restaurant.findOne({ reviews: rev._id }, '_id title');
        return revObj;
    }));

    // Lấy Favorite (giới hạn 5)
    const favs = await Favorite.find({ user: targetUser._id }).populate('restaurant').limit(5);
    const favorites = favs.map(f => f.restaurant);

    // Kiểm tra follow
    let isFollowing = false;
    if (req.user && !isOwner) {
        const f = await Follow.findOne({ follower: req.user._id, following: targetUser._id });
        if (f) isFollowing = true;
    }

    res.render('users/profile', { 
        profileUser: targetUser, 
        isOwner, 
        followersCount, 
        followingCount, 
        reviews, 
        favorites,
        myRestaurants,
        isFollowing
    });
};

module.exports.updateProfile = async (req, res) => {
    const { id } = req.params;
    if (!req.user || !req.user._id.equals(id)) {
        req.flash('error', 'Bạn không có quyền làm điều này!');
        return res.redirect('/restaurants');
    }

    const { bio, isPublic } = req.body;
    const updateData = {
        bio: bio,
        isPublic: isPublic === 'on' // checkbox 'on' or undefined
    };

    if (req.file) {
        const user = await User.findById(id);
        if (user.avatar && user.avatar.filename) {
            await cloudinary.v2.uploader.destroy(user.avatar.filename);
        }
        updateData.avatar = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    await User.findByIdAndUpdate(id, updateData);

    req.flash('success', 'Đã cập nhật trang cá nhân!');
    res.redirect(`/profile/${id}`);
};

module.exports.searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        
        const users = await User.find({ 
            username: { $regex: q, $options: 'i' } 
        }).select('username avatar isVerified').limit(5).lean();
        
        const Follow = require('../models/follow');
        for (let u of users) {
            u.followersCount = await Follow.countDocuments({ following: u._id });
        }
        
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: 'Lỗi tìm kiếm người dùng' });
    }
};

module.exports.getProfileData = async (req, res) => {
    try {
        const { id, type } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        
        let data = [];
        
        if (type === 'restaurants') {
            const isOwner = req.user && req.user._id.equals(targetUser._id);
            if (isOwner || targetUser.isPublic) {
                data = await Restaurant.find({ author: targetUser._id })
                    .skip(skip)
                    .limit(limit)
                    .lean(); 
            }
        } else if (type === 'favorites') {
            const favs = await Favorite.find({ user: targetUser._id })
                .populate('restaurant')
                .skip(skip)
                .limit(limit);
            
            data = favs.map(f => f.restaurant).filter(r => r != null);
        } else {
            return res.status(400).json({ error: 'Loại dữ liệu không hợp lệ' });
        }
        
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};