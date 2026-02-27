const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Tạo Schema phụ để lưu thông tin ảnh (giống bên Campground)
const ImageSchema = new Schema({
    url: String,
    filename: String
});

const GeneralSettingSchema = new Schema({
    // --- 1. CẤU HÌNH CHUNG (LOGO & BANNER) ---
    siteTitle: { type: String, default: 'Quán Ăn Việt' },
    
    // Thay đổi ở đây: Dùng ImageSchema thay vì String
    logo: ImageSchema, 
    banner: ImageSchema,
    
    // --- 2. CẤU HÌNH NAVBAR ---
    navColor: { type: String, default: 'bg-dark' },
    hotline: { type: String },

    // --- 3. CẤU HÌNH FOOTER ---
    footer: {
        content: { type: String, default: 'Nơi chia sẻ đam mê ẩm thực Việt Nam.' },
        copyright: { type: String, default: '© 2026 Quán Ăn Việt' },
        email: String,
        address: String,
        socials: {
            facebook: String,
            youtube: String,
            tiktok: String
        }
    }
});

module.exports = mongoose.model('GeneralSetting', GeneralSettingSchema);