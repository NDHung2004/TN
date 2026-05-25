const Restaurant = require("../models/restaurant");
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
    let { search, lat, lng, distance, sort } = req.query;
    if (lat) lat = lat.replace('_', '.');
    if (lng) lng = lng.replace('_', '.');
    
    // --- Mặc định chỉ lấy bài 'approved' ---
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

    let parsedLat = parseFloat(lat);
    let parsedLng = parseFloat(lng);
    let isValidLocation = !isNaN(parsedLat) && !isNaN(parsedLng) && 
                          parsedLat >= -90 && parsedLat <= 90 && 
                          parsedLng >= -180 && parsedLng <= 180;

    if (isValidLocation && distance) {
        if (!sort || sort === 'nearest') {
            dbQuery.geometry = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parsedLng, parsedLat]
                    },
                    $maxDistance: parseInt(distance) * 1000 // meters
                }
            };
        } else {
            // Dùng $geoWithin để cho phép custom sort (bởi vì $near bắt buộc sort theo khoảng cách)
            dbQuery.geometry = {
                $geoWithin: {
                    $centerSphere: [ [parsedLng, parsedLat], parseInt(distance) / 6378.1 ] // distance in km / earth radius in km
                }
            };
        }
    }

    let sortObj = { isFeatured: -1, createdAt: -1 };
    if (isValidLocation && distance) {
        if (!sort || sort === 'nearest') {
            sortObj = {}; // $near automatically sorts by distance
        } else if (sort === 'hot') {
            sortObj = { views: -1 };
        } else if (sort === 'best') {
            // "properties.avgRating" requires proper mapping, fallback to no sort on DB then JS sort
            sortObj = {}; 
        }
    }

    let restaurants = await Restaurant.find(dbQuery)
        .populate('reviews')
        .sort(sortObj) 
        .skip(skip)
        .limit(limit);

    // Tính toán rating và các trường khác
    let processedRestaurants = [];
    for (let camp of restaurants) {
        let obj = camp.toObject({ virtuals: true });
        if (camp.reviews && camp.reviews.length > 0) {
            let totalRating = 0;
            let positiveCount = 0;
            for (let r of camp.reviews) {
                if (r.rating) totalRating += r.rating;
                if (r.sentiment === 'positive') positiveCount++;
            }
            obj.avgRating = totalRating / camp.reviews.length;
            obj.reviewCount = camp.reviews.length;
            obj.positiveRatio = Math.round((positiveCount / camp.reviews.length) * 100);
        } else {
            obj.avgRating = 0;
            obj.reviewCount = 0;
        }
        
        // Tính khoảng cách nếu có lat/lng hợp lệ
        if (isValidLocation) {
            // Simplified straight line distance calculation for UI (Haversine formula is better but let's use a rough approx if needed, or rely on $near)
            // Just returning the calculated dist wasn't directly possible with standard .find() so we skip exact dist display or use a simple calc
            // But we will pass it anyway
            const campLat = obj.geometry.coordinates[1];
            const campLng = obj.geometry.coordinates[0];
            const R = 6371e3; // metres
            const φ1 = parsedLat * Math.PI/180;
            const φ2 = campLat * Math.PI/180;
            const Δφ = (campLat-parsedLat) * Math.PI/180;
            const Δλ = (campLng-parsedLng) * Math.PI/180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            const d = R * c; // in metres
            obj.dist = { calculated: d };
        }
        
        processedRestaurants.push(obj);
    }
    
    // Sắp xếp lại sau khi tính toán nếu cần (ví dụ: best)
    if (isValidLocation && distance && sort === 'best') {
        processedRestaurants.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    }

    // 4. Đếm tổng số bài (để làm phân trang)
    // $near không dùng được với countDocuments, nên ta chuyển qua $geoWithin để đếm
    let countQuery = { ...dbQuery };
    if (isValidLocation && distance) {
        countQuery.geometry = {
            $geoWithin: {
                $centerSphere: [ [parsedLng, parsedLat], parseInt(distance) / 6378.1 ]
            }
        };
    }
    const totalDocs = await Restaurant.countDocuments(countQuery);
    const totalPages = Math.ceil(totalDocs / limit);

    // 5. Lấy dữ liệu cho bản đồ
    let mapQuery = { ...countQuery }; // map cũng không nên dùng $near nếu không thực sự cần limit/sort
    const allRestaurantsForMap = await Restaurant.find(mapQuery, 'geometry title location description')
                                                 .sort(sortObj);

    // 6. Trả về giao diện
    res.render('restaurants/index', { 
        restaurants: processedRestaurants, 
        currentPage: page, 
        totalPages, 
        allRestaurantsForMap,
        search,
        lat,
        lng,
        sortMode: sort || 'nearest'
    });
};

module.exports.renderNewForm = async (req, res) => {
    const categories = await Category.find({});
    res.render('restaurants/new', { categories });
}

module.exports.createRestaurant = async (req, res, next) => {
  const geoData = await geocoder
    .forwardGeocode({ query: req.body.restaurant.location, limit: 1 })
    .send();
  const restaurant = new Restaurant(req.body.restaurant);
  restaurant.geometry = geoData.body.features[0].geometry;
  console.log(req.files);
  restaurant.images = req.files.map((f) => ({
    url: f.secure_url,
    filename: f.public_id,
  }));

  restaurant.author = req.user._id;
  await restaurant.save();

  req.flash("success", "Đã tạo quán ăn mới thành công!");
  res.redirect(`/restaurants/${restaurant._id}`);
};

module.exports.showRestaurant = async (req, res) => {
    // Tìm quán ăn và lấy danh sách review
    const restaurant = await Restaurant.findById(req.params.id).populate({
        path: 'reviews',
        populate: { path: 'author' }
    }).populate('author');

    if (!restaurant) {
        req.flash('error', 'Không tìm thấy quán ăn!');
        return res.redirect('/restaurants');
    }

    // Tăng lượt xem
    await Restaurant.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
    restaurant.views += 1;

    // --- TÍNH TOÁN THỐNG KÊ AI ---
    let totalReviews = restaurant.reviews.length;
    let positiveCount = 0;
    let negativeCount = 0;

    for (let r of restaurant.reviews) {
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
    res.render('restaurants/show', { restaurant, aiStats });
}

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) {
    req.flash("error", "Không tìm thấy quán ăn!");
    return res.redirect("/restaurants");
  }
  res.render("restaurants/edit", { restaurant });
};

module.exports.updateRestaurant = async (req, res) => {
  const { id } = req.params;
  const restaurant = await Restaurant.findByIdAndUpdate(id, {
    ...req.body.restaurant,
  });
  const imgs = req.files.map((f) => ({
    url: f.secure_url,
    filename: f.public_id,
  }));
  restaurant.images.push(...imgs);
  await restaurant.save();

  if (req.body.deleteImages) {
    for (let filename of req.body.deleteImages) {
      await cloudinary.uploader.destroy(filename);
    }
    await restaurant.updateOne({
      $pull: { images: { filename: { $in: req.body.deleteImages } } },
    });
  }
  req.flash("success", "Đã cập nhật thông tin quán ăn thành công!");
  res.redirect(`/restaurants/${restaurant._id}`);
};
module.exports.deleteRestaurant = async (req, res) => {
    const { id } = req.params;
    
    // SỬA THÀNH: Tìm theo ID và xóa luôn (bất kể ai là tác giả)
    await Restaurant.findByIdAndDelete(id);
    
    req.flash('success', 'Đã xóa quán ăn thành công!');
    res.redirect('/restaurants');
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
    res.redirect(req.get('Referrer') || '/restaurants');
};


