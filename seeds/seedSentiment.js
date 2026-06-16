const mongoose = require('mongoose');
const Review = require('../models/reviews');

mongoose.connect('mongodb://localhost:27017/yelp-camp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const seedSentiment = async () => {
    try {
        console.log("Đang lấy danh sách các bình luận chưa được đánh giá cảm xúc...");
        
        // Bạn có thể chỉ lấy các bình luận có sentiment: 'neutral' để không phải chạy lại những bình luận đã đánh giá
        // Tuy nhiên, để đảm bảo tất cả đều được cập nhật, ta lấy tất cả bình luận có nội dung
        const reviews = await Review.find({});
        
        console.log(`Tìm thấy ${reviews.length} bình luận. Bắt đầu gọi AI server...`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < reviews.length; i++) {
            const review = reviews[i];
            
            if (!review.body || review.body.trim() === '') {
                continue;
            }

            try {
                // Gọi tới AI Server đang chạy ở cổng 8000
                const response = await fetch('http://localhost:8000/api/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: review.body })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    review.sentiment = data.sentiment;
                    review.isToxic = data.isToxic;
                    
                    await review.save();
                    successCount++;
                    console.log(`[${i+1}/${reviews.length}] Đã dán nhãn: ${data.sentiment} - Toxic: ${data.isToxic} cho bình luận: "${review.body.substring(0, 30)}..."`);
                } else {
                    failCount++;
                    console.log(`[${i+1}/${reviews.length}] Lỗi khi gọi AI cho bình luận ID: ${review._id}`);
                }
            } catch (err) {
                failCount++;
                console.log(`[${i+1}/${reviews.length}] Ngoại lệ khi gọi AI cho bình luận ID: ${review._id} - ${err.message}`);
            }
        }

        console.log("====================================");
        console.log(`Hoàn thành dán nhãn cảm xúc!`);
        console.log(`Thành công: ${successCount}`);
        console.log(`Thất bại: ${failCount}`);
        console.log("====================================");

    } catch (e) {
        console.error("Lỗi trong quá trình chạy:", e);
    } finally {
        mongoose.connection.close();
    }
}

seedSentiment();
