const User = require('../models/users');
const Campground = require('../models/campground');
const Review = require('../models/reviews');
const Category = require('../models/category');
const GeneralSetting = require('../models/generalSetting');
const { cloudinary } = require("../cloudinary/index.js"); 
module.exports.renderCampgrounds = async (req, res) => {
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

    const totalCampgrounds = await Campground.countDocuments(query);
    const totalPages = Math.ceil(totalCampgrounds / limit);

    const campgrounds = await Campground.find(query)
        .populate('author')
        .sort({ isFeatured: -1, createdAt: -1 }) // Ưu tiên bài Ghim -> Bài mới nhất
        .skip(skip)
        .limit(limit);

    res.render('admin/campgrounds', { 
        campgrounds, 
        active: 'campgrounds', 
        filter,
        search,
        currentPage: page,
        totalPages
    });
};
// 2. Duyệt / Từ chối bài (Approval)
module.exports.updateCampgroundStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 

    // Cập nhật
    await Campground.findByIdAndUpdate(id, { status: status });
    
    // BẮT BUỘC: Phải redirect để trang web tải lại và hiện trạng thái mới
    req.flash('success', 'Đã cập nhật trạng thái!');
    res.redirect('/admin/campgrounds');
};
// 3. Ghim / Bỏ ghim bài nổi bật (Toggle Featured)
module.exports.toggleFeatured = async (req, res) => {
    const { id } = req.params;
    const camp = await Campground.findById(id);
    
    camp.isFeatured = !camp.isFeatured; // Đảo ngược true/false
    await camp.save();
    
    req.flash('success', camp.isFeatured ? 'Đã ghim bài lên đầu!' : 'Đã bỏ ghim bài!');
    res.redirect('/admin/campgrounds');
};
// 4. Xóa bài (Dùng lại logic delete cũ nhưng redirect về admin)
module.exports.deleteCampgroundAdmin = async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Đã xóa quán ăn thành công');
    res.redirect('/admin/campgrounds');
};
module.exports.index = async (req, res) => {
    // 1. Lấy tổng số lượng (Stats Cards)
    const userCount = await User.countDocuments({});
    const campCount = await Campground.countDocuments({});
    const reviewCount = await Review.countDocuments({});

    // 2. Xử lý biểu đồ Tăng trưởng User (Group theo tháng)
    const userGrowth = await User.aggregate([
        {
            $group: {
                _id: { $month: "$createdAt" }, // Gom nhóm theo tháng (1-12)
                count: { $sum: 1 }             // Đếm số lượng
            }
        },
        { $sort: { _id: 1 } } // Sắp xếp từ tháng 1 đến 12
    ]);

    // Chuẩn hóa dữ liệu userGrowth cho Chart.js (Mảng 12 tháng, tháng nào ko có thì = 0)
    const monthlyUsers = new Array(12).fill(0);
    userGrowth.forEach(item => {
        monthlyUsers[item._id - 1] = item.count;
    });

    // 3. Xử lý biểu đồ Sentiment (Dựa trên số sao đánh giá)
    // Quy ước: 4-5 sao (Tích cực), 3 sao (Trung tính), 1-2 sao (Tiêu cực)
    const reviews = await Review.find({});
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    reviews.forEach(r => {
        if (r.rating >= 4) positive++;
        else if (r.rating === 3) neutral++;
        else negative++;
    });

    // Render ra view và truyền dữ liệu
    res.render('admin/index', {
        userCount,
        campCount,
        reviewCount,
        monthlyUsers, // Dữ liệu biểu đồ cột
        sentimentData: [positive, neutral, negative],
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
    let query = {};
    
    if (filter === 'reported') {
        query.isReported = true;
    }

    // Lấy review và populate cả User lẫn Campground (để biết review ở bài nào)
    const reviews = await Review.find(query)
        .populate('author')
        .sort({ isReported: -1, _id: -1 }); // Ưu tiên review bị báo cáo lên đầu

    // Để lấy thông tin campground cha, ta cần truy vấn ngược (Hơi phức tạp chút)
    // Cách đơn giản: Duyệt qua từng review để tìm campground chứa nó (hoặc lưu campgroundId trong Review từ đầu)
    // Ở đây ta tạm thời dùng thủ thuật find campground chứa review ID này ở view (hoặc tối ưu sau)
    
    // Tốt nhất: Cập nhật Model Review thêm field 'campground' nếu muốn nhanh. 
    // Nhưng để giữ code bạn hiện tại, ta sẽ query campground thủ công ở bước View hoặc dùng aggregation.
    // ĐỂ ĐƠN GIẢN: Ta sẽ hiển thị nội dung thôi.
    
    res.render('admin/reviews', { 
        reviews, 
        active: 'reviews', 
        filter 
    });
};

// 2. Xóa Review (Xử lý mạnh tay)
module.exports.deleteReviewAdmin = async (req, res) => {
    const { reviewId } = req.params;
    
    // Tìm và xóa review
    await Review.findByIdAndDelete(reviewId);
    
    // Quan trọng: Phải xóa cả ID review trong mảng reviews của Campground
    await Campground.findOneAndUpdate(
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
    // Setting đã có sẵn trong res.locals nhờ middleware, nhưng lấy lại cho chắc
    const setting = await GeneralSetting.findOne(); 
    
    res.render('admin/settings', { categories, setting, active: 'settings' });
};

// 2. Cập nhật Thông tin chung (Logo, Banner...)
module.exports.updateGeneralSettings = async (req, res) => {
    // 1. Tìm bản ghi Setting (nếu chưa có thì tạo mới)
    let setting = await GeneralSetting.findOne();
    if (!setting) {
        setting = new GeneralSetting({});
    }

    // 2. Cập nhật các thông tin văn bản (Title, Footer, Hotline...)
    // (req.body.setting chứa các dữ liệu text từ form)
    Object.assign(setting, req.body.setting);

    // 3. Xử lý LOGO (Nếu có file upload lên)
    if (req.files && req.files['logoFile']) {
        // (Tùy chọn) Xóa logo cũ trên Cloudinary để tiết kiệm dung lượng
        if (setting.logo && setting.logo.filename) {
            await cloudinary.uploader.destroy(setting.logo.filename);
        }
        
        // Lưu logo mới
        const f = req.files['logoFile'][0];
        setting.logo = { url: f.path, filename: f.filename };
    }

    // 4. Xử lý BANNER (Nếu có file upload lên)
    if (req.files && req.files['bannerFile']) {
        if (setting.banner && setting.banner.filename) {
            await cloudinary.uploader.destroy(setting.banner.filename);
        }
        
        const f = req.files['bannerFile'][0];
        setting.banner = { url: f.path, filename: f.filename };
    }

    await setting.save();
    req.flash('success', 'Cập nhật cấu hình thành công!');
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
        const { name } = req.body;
        // Kiểm tra xem đã tồn tại chưa (dù Model có unique nhưng check thêm cho chắc)
        const existingCat = await Category.findOne({ name });
        if(existingCat) {
            req.flash('error', 'Danh mục này đã tồn tại!');
            return res.redirect('/admin/categories');
        }

        const category = new Category({ name });
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
    await Category.findByIdAndDelete(id);
    req.flash('success', 'Đã xóa danh mục!');
    res.redirect('/admin/categories');
};