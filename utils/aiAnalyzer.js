// File: utils/aiAnalyzer.js
const axios = require('axios');

module.exports.analyzeReview = async (text) => {
    try {
        // Gọi thẳng vào Server Python nội bộ của bạn (đang chạy ở cổng 8000)
        const response = await axios.post('http://127.0.0.1:8000/api/analyze', {
            text: text
        });

        // Trả kết quả về cho controller
        return response.data; // { sentiment: '...', isToxic: ... }

    } catch (error) {
        console.error("🚨 Lỗi mất kết nối với Server Python AI:", error.message);
        // Nếu Python sập, trả về trung lập để web không lỗi
        return { sentiment: 'neutral', isToxic: false }; 
    }
};