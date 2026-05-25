const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { isLoggedIn, isAdmin, isModOrAdmin } = require('../middleware');
const multer = require('multer');
const { storage } = require('../cloudinary/index.js'); // Trỏ đúng file cloudinary/index.js
const upload = multer({ storage });
router.get('/', isLoggedIn, isAdmin, adminController.index);
// --- CÁC ROUTE MỚI CHO USER ---
router.get('/users/export', isLoggedIn, isAdmin, adminController.exportUsers);
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
router.get('/restaurants/export', isLoggedIn, isModOrAdmin, adminController.exportRestaurants);
// 1. Xem danh sách
router.get('/restaurants', isLoggedIn, isModOrAdmin, adminController.renderRestaurants);

// 2. Chuyển trạng thái (Duyệt/Từ chối)
router.patch('/restaurants/:id/status', isLoggedIn, isModOrAdmin, adminController.updateRestaurantStatus);
// 3. Ghim bài
router.patch('/restaurants/:id/featured', isLoggedIn, isAdmin, adminController.toggleFeatured);
// 4. Xóa bài
router.delete('/restaurants/:id', isLoggedIn, isModOrAdmin, adminController.deleteRestaurantAdmin);
// 5. Bulk actions (Duyệt nhiều, từ chối nhiều, xóa nhiều)
router.patch('/restaurants/bulk', isLoggedIn, isModOrAdmin, adminController.bulkRestaurantsAction);


// --- QUẢN LÝ ĐÁNH GIÁ ---
router.get('/reviews/export', isLoggedIn, isModOrAdmin, adminController.exportReviews);
// 1. Xem danh sách
router.get('/reviews', isLoggedIn, isModOrAdmin, adminController.renderReviews);

// 2. Xóa review
router.delete('/reviews/:reviewId', isLoggedIn, isModOrAdmin, adminController.deleteReviewAdmin);

// 3. Gỡ báo cáo (Tha cho review)
router.patch('/reviews/:reviewId/dismiss', isLoggedIn, isModOrAdmin, adminController.dismissReport);
// --- CẤU HÌNH HỆ THỐNG ---
// (Đã loại bỏ chức năng cấu hình hệ thống theo yêu cầu)
// router.get('/settings', isLoggedIn, isAdmin, adminController.renderSettings);
// router.put('/settings/general', ...);

// --- QUẢN LÝ DANH MỤC (CATEGORIES) ---
// 1. Xem danh sách
router.get('/categories', isLoggedIn, isAdmin, adminController.renderCategories);

// 2. Thêm mới
router.post('/categories', isLoggedIn, isAdmin, adminController.createCategory);

// 3. Xóa
router.delete('/categories/:id', isLoggedIn, isAdmin, adminController.deleteCategory);
module.exports = router;