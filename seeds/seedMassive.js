const mongoose = require('mongoose');
const Restaurant = require('../models/restaurant');
const Review = require('../models/reviews');
const User = require('../models/users');

mongoose.connect('mongodb://localhost:27017/yelp-camp');

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const sampleTitles = [
    "Phở Bát Đàn", "Bún Chả Hương Liên", "Cơm Tấm Ba Ghi", "Bánh Mì Huỳnh Hoa",
    "Bún Bò Huế Oanh", "Hủ Tiếu Nam Vang", "Bánh Xèo Mười Xiềm", "Mì Quảng Bà Mua",
    "Nem Nướng Đặng Văn Quyên", "Gỏi Cuốn Tôm Thịt", "Chả Cá Lã Vọng", "Lẩu Dê Trương Định",
    "Cơm Gà Hải Nam", "Bún Đậu Mắm Tôm", "Bánh Canh Cua", "Súp Cua Hạnh",
    "Ốc Đào", "Bánh Khọt Gốc Vú Sữa", "Phở Lệ", "Cơm Thố Chợ Lớn"
];

const sampleDescriptions = [
    "Một quán ăn ngon, sạch sẽ với công thức gia truyền nổi tiếng suốt 20 năm.",
    "Không gian thoáng mát, đồ ăn đậm đà hương vị miền Tây dân dã.",
    "Món ăn đặc sản địa phương, phục vụ nhanh nhẹn và chu đáo.",
    "Hương vị nguyên bản, giá cả bình dân phù hợp cho mọi đối tượng.",
    "Điểm đến lý tưởng cho các buổi hẹn hò cuối tuần với menu đa dạng.",
    "Thịt tươi ngon, rau sống sạch sẽ, nước chấm pha chế theo tỷ lệ vàng.",
    "Được các review ẩm thực đánh giá 5 sao liên tục trong nhiều năm.",
    "Quán ăn yêu thích của dân văn phòng, vừa ngon vừa rẻ."
];

const sampleReviews = [
    { body: "Món ăn quá tuyệt vời, chắc chắn sẽ quay lại!", rating: 5 },
    { body: "Phục vụ hơi chậm nhưng đồ ăn ngon nên thông cảm được.", rating: 4 },
    { body: "Giá cả hợp lý, không gian sạch sẽ thoáng mát.", rating: 5 },
    { body: "Nước dùng hơi mặn so với khẩu vị của mình.", rating: 3 },
    { body: "Thịt hơi dai, hy vọng quán cải thiện thêm.", rating: 2 },
    { body: "Tuyệt đỉnh ẩm thực! Mọi thứ đều hoàn hảo.", rating: 5 },
    { body: "Bình thường, không có gì quá đặc sắc.", rating: 3 },
    { body: "Quá tệ, thái độ nhân viên không tốt.", rating: 1 },
    { body: "Sẽ giới thiệu cho bạn bè và người thân đến thử.", rating: 5 },
    { body: "Đồ ăn ra nhanh, nóng hổi, rất ngon miệng.", rating: 4 }
];

const random = (array) => array[Math.floor(Math.random() * array.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Tọa độ Việt Nam (Kinh độ: 102 - 109, Vĩ độ: 8 - 23)
const randomCoordinates = () => [
    102 + Math.random() * 7,
    8 + Math.random() * 15
];

const seedDB = async () => {
    console.log("Cleaning up old collections...");
    try { await db.collection('campgrounds').drop(); } catch (e) {}
    try { await Restaurant.deleteMany({}); } catch (e) {}
    try { await Review.deleteMany({}); } catch (e) {}

    // Lấy một user bất kỳ làm tác giả (Nếu không có thì tự tạo 1 admin)
    let author = await User.findOne({});
    if (!author) {
        author = new User({ email: 'admin@gmail.com', username: 'admin' });
        await User.register(author, 'admin123');
    }

    console.log("Seeding 300 restaurants...");
    for (let i = 0; i < 300; i++) {
        const title = `${random(sampleTitles)} - CN ${i + 1}`;
        
        const restaurant = new Restaurant({
            author: author._id,
            title: title,
            location: "Việt Nam",
            description: random(sampleDescriptions),
            price: randomInt(30000, 200000),
            status: "approved",
            views: randomInt(10, 1000),
            geometry: {
                type: "Point",
                coordinates: randomCoordinates()
            },
            images: [
                {
                    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
                    filename: "FoodReview/sample1",
                },
                {
                    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
                    filename: "FoodReview/sample2",
                }
            ],
            category: random(["Phở", "Bún", "Cơm", "Lẩu", "Nướng", "Hải Sản", "Ăn Vặt"])
        });

        // Tạo 5 reviews cho mỗi quán
        for(let j = 0; j < 5; j++) {
            const reviewData = random(sampleReviews);
            const review = new Review({
                body: reviewData.body,
                rating: reviewData.rating,
                author: author._id,
                status: "approved"
            });
            restaurant.reviews.push(review);
            await review.save();
        }

        await restaurant.save();
        if ((i + 1) % 50 === 0) console.log(`Created ${i + 1} restaurants...`);
    }
    console.log("Seeding complete!");
};

seedDB().then(() => mongoose.connection.close());
