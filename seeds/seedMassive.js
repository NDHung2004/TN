const mongoose = require("mongoose");
const Campground = require("../models/campground");
const Review = require("../models/reviews");
const User = require("../models/users");
const cities = require("./citiesVN");

mongoose.connect("mongodb://localhost:27017/yelp-camp");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected for Massive Seeding");
});

// Từ vựng để ghép Tên quán
const adjectives = [
    "Ngon", "Tuyệt Đỉnh", "Bình Dân", "Sang Trọng", "Cổ Truyền", "Gia Truyền", 
    "Chính Hiệu", "Đặc Sản", "Vỉa Hè", "Chill", "Xưa", "Nay", "Hiện Đại", 
    "Hương Quê", "Độc Lạ", "Siêu Cấp", "Đỉnh Cao", "Quán Quen", "Hoàng Gia", "Cây Đa"
];

const nouns = [
    "Phở", "Bún Chả", "Bún Bò Huế", "Cơm Tấm", "Cơm Niêu", "Bánh Mì", "Gỏi Cuốn", 
    "Bánh Xèo", "Lẩu Gà", "Lẩu Bò", "Nướng BBQ", "Bún Đậu Mắm Tôm", "Bánh Cuốn", 
    "Bún Cua", "Nem Nướng", "Gà Rán", "Cháo Lòng", "Cà Phê", "Trà Sữa", "Ăn Vặt"
];

// Mô tả mẫu
const descriptions = [
    "Không gian thoáng mát, đồ ăn cực kỳ ngon miệng và giá cả hợp lý. Rất đáng để ghé qua cùng bạn bè và gia đình vào dịp cuối tuần.",
    "Quán nằm ở vị trí dễ tìm, phục vụ nhanh nhẹn nhiệt tình. Món ăn đậm đà hương vị truyền thống, ăn một lần là nhớ mãi.",
    "Một địa điểm lý tưởng cho những buổi hẹn hò hoặc gặp gỡ đối tác. Thiết kế quán tinh tế, sang trọng, thực đơn phong phú đa dạng.",
    "Bình dân nhưng chất lượng không hề tầm thường. Nguyên liệu tươi ngon được chọn lọc kỹ càng mỗi ngày.",
    "Góc quán nhỏ mộc mạc mang đầy hoài niệm. Hương vị các món ăn như mẹ nấu ở nhà, ấm cúng và đầy tình cảm."
];

// Bình luận mẫu
const reviewTexts = [
    { text: "Món ăn quá tuyệt vời, phục vụ nhiệt tình!", rating: 5, sentiment: "positive" },
    { text: "Đồ ăn bình thường, giá hơi cao so với mặt bằng chung.", rating: 3, sentiment: "neutral" },
    { text: "Không gian ồn ào, phục vụ quá chậm chạp, rất thất vọng.", rating: 1, sentiment: "negative" },
    { text: "Mọi thứ đều hoàn hảo, chắc chắn sẽ quay lại nhiều lần nữa.", rating: 5, sentiment: "positive" },
    { text: "Quán sạch sẽ, đồ ăn lên nhanh, ngon miệng. Cho 4 sao vì thiếu chỗ để xe.", rating: 4, sentiment: "positive" },
    { text: "Chủ quán rất thân thiện, đồ ăn vừa miệng.", rating: 4, sentiment: "positive" },
    { text: "Món nướng bị khét, lẩu thì nhạt nhẽo. Không ngon.", rating: 2, sentiment: "negative" },
    { text: "Rất ngon, đáng đồng tiền bát gạo!", rating: 5, sentiment: "positive" },
    { text: "Ăn cũng được, nhưng không có gì đặc sắc để quay lại.", rating: 3, sentiment: "neutral" },
    { text: "Quá tệ! Vệ sinh an toàn thực phẩm kém.", rating: 1, sentiment: "negative" }
];

const sampleImages = [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1498837167922-41cfa6dbb19c?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1000&q=80"
];

const categories = ["Phở", "Cơm", "Lẩu", "Nướng", "Bún", "Ăn vặt", "Đồ uống", "Khác"];

const sample = array => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
    console.log("Clearing existing data...");
    await Campground.deleteMany({});
    await Review.deleteMany({});
    
    // Tìm hoặc tạo User mặc định để gán author
    let user = await User.findOne();
    if (!user) {
        console.log("No user found. Creating a default user...");
        const newUser = new User({ email: "admin@admin.com", username: "admin", role: "admin" });
        user = await User.register(newUser, "admin123");
    }

    console.log(`Using user ID: ${user._id}`);
    console.log("Generating 300 restaurants...");
    
    const createdCampgrounds = [];

    // TẠO 300 QUÁN ĂN
    for (let i = 0; i < 300; i++) {
        const randomCity = sample(cities);
        const price = Math.floor(Math.random() * 200000) + 30000;
        
        const img1 = sample(sampleImages);
        let img2 = sample(sampleImages);
        while(img2 === img1) img2 = sample(sampleImages);

        const camp = new Campground({
            author: user._id,
            title: `${sample(nouns)} ${sample(adjectives)} ${i+1}`,
            location: `${randomCity.city}, ${randomCity.state}`,
            description: sample(descriptions),
            price: price,
            category: sample(categories),
            geometry: {
                type: "Point",
                coordinates: [
                    randomCity.longitude,
                    randomCity.latitude,
                ]
            },
            images: [
                { url: img1, filename: `Seeded_Image_1_${i}` },
                { url: img2, filename: `Seeded_Image_2_${i}` }
            ]
        });

        await camp.save();
        createdCampgrounds.push(camp);
    }
    console.log("300 restaurants created!");

    console.log("Generating 3000 reviews (10 per restaurant)...");
    // TẠO 10 BÌNH LUẬN CHO MỖI QUÁN
    for (let camp of createdCampgrounds) {
        for (let i = 0; i < 10; i++) {
            const revData = sample(reviewTexts);

            const review = new Review({
                rating: revData.rating,
                body: revData.text,
                sentiment: revData.sentiment,
                author: user._id,
                isToxic: false
            });

            await review.save();
            camp.reviews.push(review);
        }
        await camp.save();
    }
    console.log("3000 reviews created!");
};

seedDB().then(() => {
    console.log("Massive seeding finished!");
    mongoose.connection.close();
});
