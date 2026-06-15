const Restaurant = require("../models/restaurant");
const User = require('../models/users');
const Favorite = require('../models/favorite');
const Like = require('../models/like');
const Dislike = require('../models/dislike');
const Follow = require('../models/follow');
const Interaction = require('../models/interaction');
const mbxGeocode = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocode({ accessToken: mapboxToken });
const Category = require('../models/category');
const { cloudinary } = require("../cloudinary");


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function getOptimizedLocationQuery(location) {
    let query = location.trim();
    const lowerQuery = query.toLowerCase();
    if (!lowerQuery.includes('việt nam') && !lowerQuery.includes('vietnam')) {
        query += ", Việt Nam";
    }
    return query;
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

    // --- BẮT ĐẦU: LOGIC GỢI Ý (RECOMMENDATION) ---
    let recommendedRestaurants = [];
    if (req.user && page === 1 && !search && (!lat || !lng)) {
        try {
            // Lấy tương tác của user
            const interactions = await Interaction.find({ user: req.user._id }).populate('restaurant');
            
            // Tính điểm danh mục (Category Score)
            let categoryScores = {};
            for (let inter of interactions) {
                if (inter.restaurant && inter.restaurant.category) {
                    const cat = inter.restaurant.category;
                    if (!categoryScores[cat]) categoryScores[cat] = 0;
                    categoryScores[cat] += inter.weight || 1;
                }
            }
            
            // Sắp xếp lấy Top 2 Danh mục
            let sortedCategories = Object.keys(categoryScores).sort((a, b) => categoryScores[b] - categoryScores[a]);
            let topCategories = sortedCategories.slice(0, 2);
            
            if (topCategories.length > 0) {
                // Lấy các quán user đã tương tác để loại trừ
                let interactedRestIds = interactions.map(i => i.restaurant ? i.restaurant._id : null).filter(id => id != null);

                let recQuery = {
                    status: 'approved',
                    category: { $in: topCategories },
                    _id: { $nin: interactedRestIds }
                };

                // Lấy 8 quán gợi ý tiềm năng
                let rawRecommended = await Restaurant.find(recQuery)
                    .populate('reviews')
                    .limit(8);

                // Chấm điểm từng quán gợi ý (Scoring Algorithm)
                let scoredRecommended = [];
                for (let camp of rawRecommended) {
                    let obj = camp.toObject({ virtuals: true });
                    let positiveRatio = 0;
                    let avgRating = 0;
                    
                    if (camp.reviews && camp.reviews.length > 0) {
                        let totalRating = 0;
                        let positiveCount = 0;
                        for (let r of camp.reviews) {
                            if (r.rating) totalRating += r.rating;
                            if (r.sentiment === 'positive') positiveCount++;
                        }
                        avgRating = totalRating / camp.reviews.length;
                        positiveRatio = (positiveCount / camp.reviews.length);
                    }
                    
                    obj.avgRating = avgRating;
                    obj.reviewCount = camp.reviews ? camp.reviews.length : 0;
                    obj.positiveRatio = Math.round(positiveRatio * 100);
                    
                    // Công thức điểm gợi ý: dựa trên Rating (max 5) và Tỉ lệ Tích cực (max 1.0)
                    obj.recommendationScore = (avgRating * 5) + (positiveRatio * 25); 
                    
                    scoredRecommended.push(obj);
                }

                // Sắp xếp giảm dần theo recommendationScore và cắt lấy 4 quán tốt nhất
                scoredRecommended.sort((a, b) => b.recommendationScore - a.recommendationScore);
                recommendedRestaurants = scoredRecommended.slice(0, 4);
            }
        } catch (e) {
            console.error("Lỗi thuật toán gợi ý: ", e);
        }
    }
    // --- KẾT THÚC: LOGIC GỢI Ý ---

    // 6. Trả về giao diện
    res.render('restaurants/index', { 
        restaurants: processedRestaurants, 
        recommendedRestaurants, 
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
  const optimizedQuery = getOptimizedLocationQuery(req.body.restaurant.location);
  const geoData = await geocoder
    .forwardGeocode({ query: optimizedQuery, limit: 1, countries: ['vn'], language: ['vi'] })
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
        options: { sort: { likeCount: -1, createdAt: -1 } },
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

    let isFavorited = false;
    let isFollowing = false;
    let userLikes = []; // Mảng chứa ID các review mà user này đã like
    let userDislikes = []; // Mảng chứa ID các review mà user này đã dislike
    
    if (req.user) {
        // Kiểm tra xem đã lưu chưa
        const fav = await Favorite.findOne({ user: req.user._id, restaurant: restaurant._id });
        if (fav) isFavorited = true;
        
        // Kiểm tra xem đã theo dõi tác giả chưa
        const fol = await Follow.findOne({ follower: req.user._id, following: restaurant.author._id });
        if (fol) isFollowing = true;
        
        // Kiểm tra các review đã like / dislike
        const reviewIds = restaurant.reviews.map(r => r._id);
        const likes = await Like.find({ user: req.user._id, review: { $in: reviewIds } });
        userLikes = likes.map(l => l.review.toString());

        const dislikes = await Dislike.find({ user: req.user._id, review: { $in: reviewIds } });
        userDislikes = dislikes.map(d => d.review.toString());
    }

    // --- TÌM CÁC QUÁN ĂN TƯƠNG TỰ CÙNG DANH MỤC ---
    const rawSimilarRestaurants = await Restaurant.find({ 
        category: restaurant.category, 
        _id: { $ne: restaurant._id },
        status: 'approved'
    }).populate('reviews').limit(4);

    let similarRestaurants = [];
    for (let camp of rawSimilarRestaurants) {
        let obj = camp.toObject({ virtuals: true });
        if (camp.reviews && camp.reviews.length > 0) {
            let totalRating = 0;
            for (let r of camp.reviews) {
                if (r.rating) totalRating += r.rating;
            }
            obj.avgRating = totalRating / camp.reviews.length;
            obj.reviewCount = camp.reviews.length;
        } else {
            obj.avgRating = 0;
            obj.reviewCount = 0;
        }
        similarRestaurants.push(obj);
    }
    // ----------------------------------------------

    // Truyền thêm aiStats, isFavorited, isFollowing, userLikes, userDislikes, similarRestaurants vào view
    res.render('restaurants/show', { restaurant, aiStats, isFavorited, isFollowing, userLikes, userDislikes, similarRestaurants });
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
  const restaurant = await Restaurant.findById(id);
  if (req.body.restaurant.location !== restaurant.location) {
      const optimizedQuery = getOptimizedLocationQuery(req.body.restaurant.location);
      const geoData = await geocoder
        .forwardGeocode({ query: optimizedQuery, limit: 1, countries: ['vn'], language: ['vi'] })
        .send();
      restaurant.geometry = geoData.body.features[0].geometry;
  }
  Object.assign(restaurant, req.body.restaurant);
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

// toggleFavorite đã được chuyển sang controllers/favorites.js


