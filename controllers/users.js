const User = require("../models/users");
const Restaurant = require('../models/restaurant');
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
    const user = await User.findById(req.user._id).populate('favorites');
    res.render('users/favorites', { favorites: user.favorites });
};