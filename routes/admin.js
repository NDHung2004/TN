const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { isLoggedIn, isAdmin, isModOrAdmin } = require('../middleware');
const multer = require('multer');
const { storage } = require('../cloudinary/index.js'); // Trỏ đúng file cloudinary/index.js
const upload = multer({ storage });
router.get('/', isLoggedIn, isAdmin, adminController.index);
// --- CÁC ROUTE MỚI CHO USER ---
// 1. Xem danh sách
router.get('/users', isLoggedIn, isAdmin, adminController.renderUsers);

// 2. Khóa tài khoản
router.patch('/users/:id/ban', isLoggedIn, isAdmin, adminController.toggleBan);

// 3. Đổi quyền (Role)
router.patch('/users/:id/role', isLoggedIn, isAdmin, adminController.updateRole);

// Hiện form sửa
router.get('/users/:id/edit', isLoggedIn, isAdmin, adminController.renderEditUser);

// Xử lý cập nhật thông tin
router.put('/users/:id', isLoggedIn, isAdmin, adminController.updateUser);

// --- QUẢN LÝ QUÁN ĂN ---
// 1. Xem danh sách
router.get('/campgrounds', isLoggedIn, isModOrAdmin, adminController.renderCampgrounds);

// 2. Cập nhật trạng thái (Duyệt/Từ chối)
router.patch('/campgrounds/:id/status', isLoggedIn, isModOrAdmin, adminController.updateCampgroundStatus);

// 3. Ghim bài nổi bật
router.patch('/campgrounds/:id/featured', isLoggedIn, isModOrAdmin, adminController.toggleFeatured);

// 4. Xóa bài (Route riêng cho admin để redirect đúng chỗ)
router.delete('/campgrounds/:id', isLoggedIn, isModOrAdmin, adminController.deleteCampgroundAdmin);


// --- QUẢN LÝ ĐÁNH GIÁ ---
// 1. Xem danh sách
router.get('/reviews', isLoggedIn, isModOrAdmin, adminController.renderReviews);

// 2. Xóa review
router.delete('/reviews/:reviewId', isLoggedIn, isModOrAdmin, adminController.deleteReviewAdmin);

// 3. Gỡ báo cáo (Tha cho review)
router.patch('/reviews/:reviewId/dismiss', isLoggedIn, isModOrAdmin, adminController.dismissReport);
// --- CẤU HÌNH HỆ THỐNG ---
// 1. Trang cài đặt
router.get('/settings', isLoggedIn, isAdmin, adminController.renderSettings);

router.put('/settings/general', 
    isLoggedIn, 
    isAdmin,
    // Cho phép upload 1 file Logo và 1 file Banner
    upload.fields([
        { name: 'logoFile', maxCount: 1 }, 
        { name: 'bannerFile', maxCount: 1 }
    ]), 
    adminController.updateGeneralSettings
);

// --- QUẢN LÝ DANH MỤC (CATEGORIES) ---
// 1. Xem danh sách
router.get('/categories', isLoggedIn, isAdmin, adminController.renderCategories);

// 2. Thêm mới
router.post('/categories', isLoggedIn, isAdmin, adminController.createCategory);

// 3. Xóa
router.delete('/categories/:id', isLoggedIn, isAdmin, adminController.deleteCategory);
module.exports = router;