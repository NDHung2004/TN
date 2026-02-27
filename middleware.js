const { campgroundSchema, reviewSchema } = require("./schemas.js");
const Campground = require("./models/campground");
const Review = require("./models/reviews");
const ExpressError = require("./utils/ExpressError");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash("error", "You must be signed in first!");
    return res.redirect("/login");
  }
  next();
};

module.exports.storeReturnTo = (req, res, next) => {
  if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo;
  }
  next();
};
module.exports.isAdmin = (req, res, next) => {
    if((req.isAuthenticated() && req.user.role === 'admin')) {
        return next();
    }
    req.flash('error', 'Bạn không có quyền Admin!');
    res.redirect('/campgrounds');
}
module.exports.isModOrAdmin = (req, res, next) => {
    // Cho phép nếu là Admin HOẶC Moderator
    if(req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        return next();
    }
    req.flash('error', 'Bạn không có quyền truy cập!');
    res.redirect('/login');
}
module.exports.validateCampground = (req, res, next) => {
  const { error } = campgroundSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
  const campground = new Campground(req.body.campground);
};

module.exports.isAuthor = async (req, res, next) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    
    // SỬA: Nếu không phải tác giả VÀ role không phải admin thì chặn
    if (!campground.author.equals(req.user._id) && req.user.role !== 'admin') {
        req.flash('error', 'Bạn không có quyền làm việc này!');
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    
    // SỬA: Tương tự như trên
    if (!review.author.equals(req.user._id) && req.user.role !== 'admin') {
        req.flash('error', 'Bạn không có quyền xóa review này!');
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};
