const Campground = require("../models/campground");
const User = require('../models/users');
const mbxGeocode = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocode({ accessToken: mapboxToken });
const Category = require('../models/category');
const { cloudinary } = require("../cloudinary");


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports.index = async (req, res) => {
    
    // 1. Cấu hình phân trang
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const skip = (page - 1) * limit;

    // 2. Xử lý Tìm kiếm & Bộ lọc
    const { search } = req.query;
    
    // --- SỬA Ở ĐÂY: Mặc định chỉ lấy bài 'approved' ---
    let dbQuery = { status: 'approved' }; 

    if (search) {
        const regex = new RegExp(escapeRegex(search), 'gi');
        // Kết hợp điều kiện: Phải là 'approved' VÀ (khớp tên HOẶC khớp mô tả...)
        dbQuery = {
            status: 'approved', 
            $or: [
                { title: regex },     
                { location: regex },    
                { description: regex }, 
            ]
        };
    }

    // 3. Truy vấn Database
    const campgrounds = await Campground.find(dbQuery)
        // --- SỬA Ở ĐÂY: Ưu tiên isFeatured (true) lên đầu, sau đó đến bài mới nhất ---
        .sort({ isFeatured: -1, _id: -1 }) 
        .skip(skip)
        .limit(limit);

    // 4. Đếm tổng số bài (để làm phân trang)
    const totalDocs = await Campground.countDocuments(dbQuery);
    const totalPages = Math.ceil(totalDocs / limit);

    // 5. Lấy dữ liệu cho bản đồ (Cũng phải tuân thủ dbQuery để không lộ bài chưa duyệt)
    const allCampgroundsForMap = await Campground.find(dbQuery, 'geometry title location description')
                                                 .sort({ isFeatured: -1, _id: -1 });

    // 6. Trả về giao diện
    res.render('campgrounds/index', { 
        campgrounds, 
        currentPage: page, 
        totalPages, 
        allCampgroundsForMap,
        search 
    });
};

module.exports.renderNewForm = async (req, res) => {
    const categories = await Category.find({});
    res.render('campgrounds/new', { categories });
}

module.exports.createCampground = async (req, res, next) => {
  const geoData = await geocoder
    .forwardGeocode({ query: req.body.campground.location, limit: 1 })
    .send();
  const campground = new Campground(req.body.campground);
  campground.geometry = geoData.body.features[0].geometry;
  console.log(req.files);
  campground.images = req.files.map((f) => ({
    url: f.secure_url,
    filename: f.public_id,
  }));

  campground.author = req.user._id;
  await campground.save();

  req.flash("success", "Successfully made a new campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.showCampground = async (req, res) => {
  const campground = await Campground.findById(req.params.id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("author");
  if (!campground) {
    req.flash("error", "Campground not found!");
    return res.redirect("/campgrounds");
  }
  res.render("campgrounds/show", { campground });
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const campground = await Campground.findById(id);
  if (!campground) {
    req.flash("error", "Campground not found!");
    return res.redirect("/campgrounds");
  }
  res.render("campgrounds/edit", { campground });
};

module.exports.updateCampground = async (req, res) => {
  const { id } = req.params;
  const campground = await Campground.findByIdAndUpdate(id, {
    ...req.body.campground,
  });
  const imgs = req.files.map((f) => ({
    url: f.secure_url,
    filename: f.public_id,
  }));
  campground.images.push(...imgs);
  await campground.save();

  if (req.body.deleteImages) {
    for (let filename of req.body.deleteImages) {
      await cloudinary.uploader.destroy(filename);
    }
    await campground.updateOne({
      $pull: { images: { filename: { $in: req.body.deleteImages } } },
    });
  }
  req.flash("success", "Successfully updated campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};
module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;
    
    // SỬA THÀNH: Tìm theo ID và xóa luôn (bất kể ai là tác giả)
    await Campground.findByIdAndDelete(id);
    
    req.flash('success', 'Successfully deleted campground');
    res.redirect('/campgrounds');
}

module.exports.toggleFavorite = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    
    if (user.favorites.includes(id)) {
       
        await User.findByIdAndUpdate(req.user._id, { $pull: { favorites: id } });
        req.flash('success', 'Đã xóa khỏi danh sách yêu thích!');
    } else {
       
        await User.findByIdAndUpdate(req.user._id, { $addToSet: { favorites: id } });
        req.flash('success', 'Đã thêm vào danh sách yêu thích!');
    }
    
    res.redirect('back'); 
};
