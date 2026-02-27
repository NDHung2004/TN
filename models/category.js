const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true // Đảm bảo không bị trùng tên (VD: không tạo 2 cái "Buffet")
    }
});

module.exports = mongoose.model('Category', CategorySchema);