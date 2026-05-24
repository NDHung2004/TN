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
    // Tìm quán ăn và lấy danh sách review
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: { path: 'author' }
    }).populate('author');

    if (!campground) {
        req.flash('error', 'Không tìm thấy quán ăn!');
        return res.redirect('/campgrounds');
    }

    // --- TÍNH TOÁN THỐNG KÊ AI ---
    let totalReviews = campground.reviews.length;
    let positiveCount = 0;
    let negativeCount = 0;

    for (let r of campground.reviews) {
        if (r.sentiment === 'positive') positiveCount++;
        else if (r.sentiment === 'negative') negativeCount++;
    }

    // Đóng gói thành biến stats để truyền sang giao diện
    const aiStats = {
        total: totalReviews,
        positivePct: totalReviews ? Math.round((positiveCount / totalReviews) * 100) : 0,
        negativePct: totalReviews ? Math.round((negativeCount / totalReviews) * 100) : 0
    };
    // ----------------------------

    // Truyền thêm aiStats vào view
    res.render('campgrounds/show', { campground, aiStats });
}

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
       
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { favorites: id }
        });
        req.flash('success', 'Đã xóa khỏi danh sách yêu thích!');
    } else {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { favorites: id }
        });
        req.flash('success', 'Đã thêm vào danh sách yêu thích!');
    }
    res.redirect(req.get('Referrer') || '/campgrounds');
};

module.exports.seedNearby = async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) {
        req.flash('error', 'Không tìm thấy tọa độ của bạn!');
        return res.redirect('/campgrounds');
    }

    let user = await User.findOne({ role: 'admin' });
    if (!user) user = await User.findOne();
    
    if (!user) {
        req.flash('error', 'Không tìm thấy user để gán quyền tác giả!');
        return res.redirect('/campgrounds');
    }

    const Review = require('../models/reviews');

    const sampleImages = [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=80"
    ];
    const adjectives = ["Ngon", "Tuyệt Đỉnh", "Bình Dân", "Sang Trọng"];
    const nouns = ["Phở", "Bún", "Lẩu", "Nướng BBQ", "Cà Phê"];
    const sample = array => array[Math.floor(Math.random() * array.length)];
    
    const baseLat = parseFloat(lat);
    const baseLng = parseFloat(lng);

    for (let i = 0; i < 20; i++) {
        // Tạo tọa độ ngẫu nhiên xung quanh điểm gốc (khoảng 10-30km)
        const latOffset = (Math.random() - 0.5) * 0.4;
        const lngOffset = (Math.random() - 0.5) * 0.4;
        
        const camp = new Campground({
            author: user._id,
            title: `[GẦN ĐÂY] ${sample(nouns)} ${sample(adjectives)} ${i+1}`,
            location: "Gần Vị Trí Của Bạn",
            description: "Một quán ăn ngon được tạo tự động gần vị trí của bạn.",
            price: Math.floor(Math.random() * 200000) + 30000,
            category: sample(["Phở", "Bún", "Lẩu", "Nướng"]),
            geometry: {
                type: "Point",
                coordinates: [baseLng + lngOffset, baseLat + latOffset]
            },
            images: [
                { url: sample(sampleImages), filename: `Nearby_1_${i}` },
                { url: sample(sampleImages), filename: `Nearby_2_${i}` }
            ],
            status: 'approved'
        });

        for (let j = 0; j < 3; j++) {
            const review = new Review({
                rating: Math.floor(Math.random() * 3) + 3,
                body: "Rất ngon và đáng thử!",
                sentiment: "positive",
                author: user._id,
                isToxic: false
            });
            await review.save();
            camp.reviews.push(review);
        }

        await camp.save();
    }

    req.flash('success', 'Đã thêm 20 quán ăn gần vị trí của bạn!');
    res.redirect(`/campgrounds?lat=${baseLat}&lng=${baseLng}&distance=50`);
};
