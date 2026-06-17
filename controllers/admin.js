const User = require('../models/users');
const Restaurant = require('../models/restaurant');
const Review = require('../models/reviews');
const Category = require('../models/category');
const { cloudinary } = require("../cloudinary/index.js"); 
const ExcelJS = require('exceljs'); 
module.exports.renderRestaurants = async (req, res) => {
    const { filter, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Số bài mỗi trang
    const skip = (page - 1) * limit;

    let query = {};

    // Logic 1: Lọc theo trạng thái (nếu có chọn tab)
    if (filter === 'pending') query.status = 'pending';
    else if (filter === 'approved') query.status = 'approved';

    // Logic 2: Tìm kiếm (nếu có nhập từ khóa)
    if (search) {
        // Tìm trong Tên quán HOẶC Địa điểm
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }

    const totalRestaurants = await Restaurant.countDocuments(query);
    const totalPages = Math.ceil(totalRestaurants / limit);

    const restaurants = await Restaurant.find(query)
        .populate('author')
        .sort({ createdAt: -1 }) // Bài mới nhất lên đầu (cho tất cả và đã duyệt)
        .skip(skip)
        .limit(limit);

    res.render('admin/restaurants', { 
        restaurants, 
        active: 'restaurants', 
        filter,
        search,
        currentPage: page,
        totalPages
    });
};
// 2. Duyệt / Từ chối bài (Approval)
module.exports.updateRestaurantStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 

    // Cập nhật
    await Restaurant.findByIdAndUpdate(id, { status: status });
    
    // BẮT BUỘC: Phải redirect để trang web tải lại và hiện trạng thái mới
    req.flash('success', 'Đã cập nhật trạng thái!');
    res.redirect('/admin/restaurants');
};
// 3. Ghim / Bỏ ghim bài nổi bật (Toggle Featured)
module.exports.toggleFeatured = async (req, res) => {
    const { id } = req.params;
    const camp = await Restaurant.findById(id);
    
    camp.isFeatured = !camp.isFeatured; // Đảo ngược true/false
    await camp.save();
    
    req.flash('success', camp.isFeatured ? 'Đã ghim bài lên đầu!' : 'Đã bỏ ghim bài!');
    res.redirect('/admin/restaurants');
};
// 4. Xóa bài (Dùng lại logic delete cũ nhưng redirect về admin)
module.exports.deleteRestaurantAdmin = async (req, res) => {
    const { id } = req.params;
    await Restaurant.findByIdAndDelete(id);
    req.flash('success', 'Đã xóa quán ăn thành công');
    res.redirect('/admin/restaurants');
};

// 5. Bulk actions (Duyệt nhiều, từ chối nhiều, xóa nhiều)
module.exports.bulkRestaurantsAction = async (req, res) => {
    let { restaurantIds, action } = req.body;
    
    // Nếu chỉ chọn 1 checkbox, restaurantIds là string. Nếu chọn nhiều, nó là array.
    if (!restaurantIds) {
        req.flash('error', 'Vui lòng chọn ít nhất 1 quán ăn để thực hiện!');
        return res.redirect(req.get('Referrer') || '/admin/restaurants');
    }
    
    if (!Array.isArray(restaurantIds)) {
        restaurantIds = [restaurantIds];
    }
    
    if (action === 'approve') {
        await Restaurant.updateMany({ _id: { $in: restaurantIds } }, { status: 'approved' });
        req.flash('success', `Đã duyệt ${restaurantIds.length} quán ăn!`);
    } else if (action === 'reject') {
        await Restaurant.updateMany({ _id: { $in: restaurantIds } }, { status: 'rejected' });
        req.flash('success', `Đã từ chối ${restaurantIds.length} quán ăn!`);
    } else if (action === 'delete') {
        // Find and delete to trigger mongoose middleware if needed, but for bulk updateMany is faster.
        // Actually, Restaurant uses findOneAndDelete middleware to delete reviews/images. 
        // We should loop through them to trigger middlewares.
        for (let id of restaurantIds) {
            await Restaurant.findByIdAndDelete(id);
        }
        req.flash('success', `Đã xóa ${restaurantIds.length} quán ăn!`);
    }
    
    res.redirect(req.get('Referrer') || '/admin/restaurants');
};
module.exports.index = async (req, res) => {
    // 0. Time Filter Setup
    const period = req.query.period || '30d';
    let dateFilter = {};
    const now = new Date();
    if (period === '30d') {
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 30)) } };
    } else if (period === '3m') {
        dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 3)) } };
    } else if (period === '6m') {
        dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 6)) } };
    } else if (period === '1y') {
        dateFilter = { createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
    }

    // 1. Lấy tổng số lượng (Stats Cards) - All Time
    const userCount = await User.countDocuments({});
    const campCount = await Restaurant.countDocuments({});
    const reviewCount = await Review.countDocuments({});

    // Thống kê mở rộng
    const today = new Date();
    today.setHours(0,0,0,0);
    const reviewsToday = await Review.countDocuments({ createdAt: { $gte: today } });
    
    // Avg Rating
    const avgRatingAgg = await Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }]);
    const avgRating = avgRatingAgg.length > 0 ? avgRatingAgg[0].avg.toFixed(1) : "0";

    // Toxic Reviews (All time or filtered?) Let's do All time for consistency with Total Reviews
    const toxicReviewsCount = await Review.countDocuments({ isToxic: true });

    // 2. Biểu đồ Tăng trưởng (Lọc theo dateFilter)
    // Tăng trưởng User
    const userGrowth = await User.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Tăng trưởng Review
    const reviewGrowth = await Review.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Tăng trưởng Restaurants
    const campGrowth = await Restaurant.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Đồng bộ các mốc thời gian (X axis) cho Line Chart
    let allMonths = new Set([...userGrowth.map(u => u._id), ...reviewGrowth.map(r => r._id), ...campGrowth.map(c => c._id)]);
    let sortedMonths = Array.from(allMonths).sort();

    let chartGrowthData = {
        labels: sortedMonths,
        users: sortedMonths.map(m => { const found = userGrowth.find(u => u._id === m); return found ? found.count : 0; }),
        reviews: sortedMonths.map(m => { const found = reviewGrowth.find(r => r._id === m); return found ? found.count : 0; }),
        camps: sortedMonths.map(m => { const found = campGrowth.find(c => c._id === m); return found ? found.count : 0; })
    };

    // 3. Phân bố sao (Rating)
    const ratingDist = await Review.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: -1 } } // 5, 4, 3, 2, 1
    ]);
    const ratingLabels = [5, 4, 3, 2, 1];
    const ratingData = ratingLabels.map(r => { const found = ratingDist.find(d => d._id === r); return found ? found.count : 0; });

    // 4. Phân tích Cảm xúc & Toxic (AI Moderation)
    const sentimentDist = await Review.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]);
    const sMap = { 'positive': 0, 'neutral': 1, 'negative': 2 };
    let aiSentimentData = [0, 0, 0];
    sentimentDist.forEach(s => { if(sMap[s._id] !== undefined) aiSentimentData[sMap[s._id]] = s.count; });

    const toxicDist = await Review.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$isToxic", count: { $sum: 1 } } }
    ]);
    let toxicData = [0, 0]; // [Sạch, Độc hại]
    toxicDist.forEach(t => { if(t._id === true) toxicData[1] = t.count; else toxicData[0] = t.count; });

    // 5. Top Restaurants (Nhiều reviews nhất)
    const topRestaurants = await Restaurant.find({})
        .sort({ "reviews.length": -1, views: -1 })
        .limit(5)
        .select('title reviews views');

    // Phân bổ danh mục
    const allCategories = await Category.find({});
    const categoryMap = {};
    for (let cat of allCategories) {
        categoryMap[cat._id.toString()] = { name: cat.name, count: 0 };
    }
    const KHAC_KEY = 'Khác';
    categoryMap[KHAC_KEY] = { name: 'Khác', count: 0 };

    const categoryDistribution = await Restaurant.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 }
            }
        }
    ]);
    
    categoryDistribution.forEach(c => {
        const catId = c._id ? c._id.toString() : null;
        if (catId && categoryMap[catId]) {
            categoryMap[catId].count += c.count;
        } else {
            categoryMap[KHAC_KEY].count += c.count;
        }
    });

    const catLabels = Object.values(categoryMap).map(c => c.name);
    const catData = Object.values(categoryMap).map(c => c.count);

    // Render ra view và truyền dữ liệu
    res.render('admin/index', {
        userCount, campCount, reviewCount,
        reviewsToday, avgRating, toxicReviewsCount,
        chartGrowthData: JSON.stringify(chartGrowthData),
        ratingData: JSON.stringify(ratingData),
        aiSentimentData: JSON.stringify(aiSentimentData),
        toxicData: JSON.stringify(toxicData),
        topRestaurants,
        catLabels: JSON.stringify(catLabels),
        catData: JSON.stringify(catData),
        period,
        active: 'dashboard'
    });
};
module.exports.renderUsers = async (req, res) => {
    const { search } = req.query;
    const page = parseInt(req.query.page) || 1; // Trang hiện tại (mặc định 1)
    const limit = 10; // Số lượng user mỗi trang
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
        query = {
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        };
    }

    // Đếm tổng số user thỏa mãn điều kiện (để tính số trang)
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Lấy danh sách user của trang hiện tại
    const users = await User.find(query)
        .sort({ createdAt: -1 }) // Mới nhất lên đầu
        .skip(skip)
        .limit(limit);

    res.render('admin/users', { 
        users, 
        active: 'users', 
        search,
        currentPage: page,
        totalPages
    });
};

// 2. Khóa / Mở khóa tài khoản (Toggle Ban)
module.exports.toggleBan = async (req, res) => {
    const { id } = req.params;
    
    // Lấy tham số trang và tìm kiếm hiện tại
    const { page, search } = req.query; 

    const user = await User.findById(id);
    
    if (user._id.equals(req.user._id)) {
        req.flash('error', 'Bạn không thể tự khóa tài khoản của mình!');
        return res.redirect('/admin/users');
    }

    user.isBanned = !user.isBanned;
    await user.save();
    
    // Xây dựng URL quay về
    let redirectUrl = `/admin/users?page=${page || 1}`;
    if (search) redirectUrl += `&search=${search}`;
    redirectUrl += `#user-row-${id}`; // Thêm Neo (Anchor) để cuộn xuống đúng dòng

    const msg = user.isBanned ? 'Đã khóa tài khoản!' : 'Đã mở khóa tài khoản!';
    req.flash('success', msg);
    res.redirect(redirectUrl);
};

// 2.5 Cấp / Thu hồi tích xanh (Toggle Verified)
module.exports.toggleVerify = async (req, res) => {
    const { id } = req.params;
    const { page, search } = req.query; 

    const user = await User.findById(id);
    
    user.isVerified = !user.isVerified;
    await user.save();
    
    let redirectUrl = `/admin/users?page=${page || 1}`;
    if (search) redirectUrl += `&search=${search}`;
    redirectUrl += `#user-row-${id}`;

    const msg = user.isVerified ? 'Đã cấp tích xanh cho người dùng!' : 'Đã thu hồi tích xanh!';
    req.flash('success', msg);
    res.redirect(redirectUrl);
};

// 3. Thay đổi vai trò (Role Assignment)
module.exports.updateRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    // Lấy tham số trang và tìm kiếm hiện tại
    const { page, search } = req.query;

    const user = await User.findById(id);

    if (user._id.equals(req.user._id)) {
        req.flash('error', 'Bạn không thể tự hạ cấp quyền của mình!');
        return res.redirect('/admin/users');
    }

    user.role = role;
    await user.save();

    // Xây dựng URL quay về
    let redirectUrl = `/admin/users?page=${page || 1}`;
    if (search) redirectUrl += `&search=${search}`;
    redirectUrl += `#user-row-${id}`; // Thêm Neo (Anchor) để cuộn xuống đúng dòng

    req.flash('success', `Đã cập nhật vai trò thành ${role}`);
    res.redirect(redirectUrl);
};
module.exports.renderEditUser = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
        req.flash('error', 'Không tìm thấy người dùng!');
        return res.redirect('/admin/users');
    }
    res.render('admin/editUser', { user, active: 'users' });
};

// 2. Cập nhật User
module.exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, role, isBanned } = req.body;

    // Tìm và cập nhật
    const user = await User.findByIdAndUpdate(id, { 
        username, 
        email, 
        role, 
        isBanned: isBanned === 'on' // Checkbox trả về 'on' nếu được tích
    }, { runValidators: true, new: true });

    req.flash('success', 'Cập nhật thông tin thành công!');
    res.redirect('/admin/users');
};
// 1. Hiển thị danh sách Review
module.exports.renderReviews = async (req, res) => {
    const { filter } = req.query; // filter=reported
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (filter === 'reported') {
        query.isReported = true;
    }

    const totalReviews = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalReviews / limit);

    // Lấy review và populate cả User lẫn Restaurant (để biết review ở bài nào)
    const reviews = await Review.find(query)
        .populate('author')
        .sort({ isReported: -1, _id: -1 }) // Ưu tiên review bị báo cáo lên đầu
        .skip(skip)
        .limit(limit);

    res.render('admin/reviews', { 
        reviews, 
        active: 'reviews', 
        filter,
        currentPage: page,
        totalPages
    });
};

// 2. Xóa Review (Xử lý mạnh tay)
module.exports.deleteReviewAdmin = async (req, res) => {
    const { reviewId } = req.params;
    
    // Tìm và xóa review
    await Review.findByIdAndDelete(reviewId);
    
    // Quan trọng: Phải xóa cả ID review trong mảng reviews của Restaurant
    await Restaurant.findOneAndUpdate(
        { reviews: reviewId },
        { $pull: { reviews: reviewId } }
    );

    req.flash('success', 'Đã xóa bình luận vi phạm!');
    res.redirect('/admin/reviews?filter=reported');
};

// 3. Bỏ qua báo cáo (Giữ lại review)
module.exports.dismissReport = async (req, res) => {
    const { reviewId } = req.params;
    await Review.findByIdAndUpdate(reviewId, { isReported: false });
    
    req.flash('success', 'Đã gỡ báo cáo cho bình luận này!');
    res.redirect('/admin/reviews?filter=reported');
};
// 1. Hiển thị trang Cấu hình
module.exports.renderSettings = async (req, res) => {
    const categories = await Category.find({});
    const setting = {}; // Trống vì đã xóa tính năng này
    res.render('admin/settings', { categories, setting, active: 'settings' });
};

// 2. Cập nhật Thông tin chung (Logo, Banner...)
module.exports.updateGeneralSettings = async (req, res) => {
    req.flash('error', 'Tính năng cấu hình đã bị vô hiệu hóa!');
    res.redirect('/admin/settings');
};
// --- QUẢN LÝ DANH MỤC ---

// 1. Hiển thị trang Quản lý Danh mục
module.exports.renderCategories = async (req, res) => {
    // Lấy tất cả danh mục và sắp xếp theo tên (A->Z)
    const categories = await Category.find({}).sort({ name: 1 });
    
    res.render('admin/categories', { 
        categories, 
        active: 'categories' // Để tô màu menu bên trái
    });
};

// 2. Thêm Danh mục mới
module.exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        // Kiểm tra xem đã tồn tại chưa
        const existingCat = await Category.findOne({ name });
        if(existingCat) {
            req.flash('error', 'Danh mục này đã tồn tại!');
            return res.redirect('/admin/categories');
        }

        const category = new Category({ name, description });
        await category.save();
        req.flash('success', 'Đã thêm danh mục mới thành công!');
        res.redirect('/admin/categories');
    } catch (e) {
        req.flash('error', 'Có lỗi xảy ra: ' + e.message);
        res.redirect('/admin/categories');
    }
};

// 3. Xóa Danh mục
module.exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (category) {
        // Cập nhật tất cả các quán ăn đang dùng danh mục này thành null (tương đương Khác)
        await Restaurant.updateMany({ category: category._id }, { $unset: { category: "" } });
        await Category.findByIdAndDelete(id);
    }
    req.flash('success', 'Đã xóa danh mục và cập nhật các quán ăn liên quan!');
    res.redirect('/admin/categories');
};

// --- XUẤT EXCEL ---
module.exports.exportUsers = async (req, res) => {
    const { role, status, pageFrom, pageTo } = req.query;
    let query = {};
    if (role && role !== 'all') query.role = role;
    if (status === 'banned') query.isBanned = true;
    else if (status === 'active') query.isBanned = false;

    let dbQuery = User.find(query).sort({ createdAt: -1 });
    
    const itemsPerPage = 10;
    const pFrom = parseInt(pageFrom) || 1;
    const pTo = parseInt(pageTo);

    if (pFrom > 1) {
        dbQuery = dbQuery.skip((pFrom - 1) * itemsPerPage);
    }
    if (pTo && pTo >= pFrom) {
        dbQuery = dbQuery.limit((pTo - pFrom + 1) * itemsPerPage);
    }

    const users = await dbQuery;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Người dùng');
    
    worksheet.columns = [
        { header: 'ID', key: '_id', width: 25 },
        { header: 'Tên người dùng', key: 'username', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Vai trò', key: 'role', width: 15 },
        { header: 'Trạng thái', key: 'status', width: 15 },
        { header: 'Ngày tạo', key: 'createdAt', width: 20 },
    ];
    
    users.forEach(user => {
        worksheet.addRow({
            _id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role === 'admin' ? 'Quản trị viên' : (user.role === 'moderator' ? 'Kiểm duyệt viên' : 'Người dùng'),
            status: user.isBanned ? 'Bị khóa' : 'Hoạt động',
            createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : ''
        });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=DanhSachNguoiDung.xlsx');
    await workbook.xlsx.write(res);
    res.end();
};

module.exports.exportRestaurants = async (req, res) => {
    const { status, pageFrom, pageTo } = req.query;
    let query = {};
    if (status && status !== 'all') query.status = status;

    let dbQuery = Restaurant.find(query).populate('author').sort({ createdAt: -1 });
    
    const itemsPerPage = 10;
    const pFrom = parseInt(pageFrom) || 1;
    const pTo = parseInt(pageTo);

    if (pFrom > 1) {
        dbQuery = dbQuery.skip((pFrom - 1) * itemsPerPage);
    }
    if (pTo && pTo >= pFrom) {
        dbQuery = dbQuery.limit((pTo - pFrom + 1) * itemsPerPage);
    }

    const restaurants = await dbQuery;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quán ăn');
    
    worksheet.columns = [
        { header: 'ID', key: '_id', width: 25 },
        { header: 'Tên quán', key: 'title', width: 35 },
        { header: 'Danh mục', key: 'category', width: 20 },
        { header: 'Địa điểm', key: 'location', width: 35 },
        { header: 'Giá', key: 'price', width: 15 },
        { header: 'Lượt xem', key: 'views', width: 15 },
        { header: 'Người đăng', key: 'author', width: 25 },
        { header: 'Trạng thái', key: 'status', width: 15 },
        { header: 'Ngày đăng', key: 'createdAt', width: 20 },
    ];
    
    restaurants.forEach(camp => {
        let statusText = 'Chờ duyệt';
        if (camp.status === 'approved') statusText = 'Đã duyệt';
        else if (camp.status === 'rejected') statusText = 'Từ chối';

        worksheet.addRow({
            _id: camp._id.toString(),
            title: camp.title,
            category: camp.category || 'Khác',
            location: camp.location,
            price: camp.price,
            views: camp.views || 0,
            author: camp.author ? camp.author.username : 'Unknown',
            status: statusText,
            createdAt: camp.createdAt ? new Date(camp.createdAt).toLocaleDateString('vi-VN') : ''
        });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=DanhSachQuanAn.xlsx');
    await workbook.xlsx.write(res);
    res.end();
};

module.exports.exportReviews = async (req, res) => {
    const { reported, sentiment, pageFrom, pageTo } = req.query;
    let query = {};
    if (reported === 'reported') query.isReported = true;
    else if (reported === 'normal') query.isReported = false;
    
    if (sentiment && sentiment !== 'all') query.sentiment = sentiment;

    let dbQuery = Review.find(query).populate('author').sort({ createdAt: -1 });
    
    const itemsPerPage = 10;
    const pFrom = parseInt(pageFrom) || 1;
    const pTo = parseInt(pageTo);

    if (pFrom > 1) {
        dbQuery = dbQuery.skip((pFrom - 1) * itemsPerPage);
    }
    if (pTo && pTo >= pFrom) {
        dbQuery = dbQuery.limit((pTo - pFrom + 1) * itemsPerPage);
    }

    const reviews = await dbQuery;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bình luận');
    
    worksheet.columns = [
        { header: 'ID', key: '_id', width: 25 },
        { header: 'Người đánh giá', key: 'author', width: 25 },
        { header: 'Số sao', key: 'rating', width: 10 },
        { header: 'Nội dung', key: 'body', width: 50 },
        { header: 'Cảm xúc', key: 'sentiment', width: 15 },
        { header: 'Vi phạm', key: 'isReported', width: 15 },
    ];
    
    reviews.forEach(review => {
        worksheet.addRow({
            _id: review._id.toString(),
            author: review.author ? review.author.username : 'Unknown',
            rating: review.rating,
            body: review.body,
            sentiment: review.sentiment === 'positive' ? 'Tích cực' : (review.sentiment === 'negative' ? 'Tiêu cực' : 'Trung lập'),
            isReported: review.isReported ? 'Bị báo cáo' : 'Bình thường'
        });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=DanhSachBinhLuan.xlsx');
    await workbook.xlsx.write(res);
    res.end();
};