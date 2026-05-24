const mongoose = require('mongoose');
const Campground = require('./models/campground');

mongoose.connect('mongodb://localhost:27017/yelp-camp').then(async () => {
    const res = await Campground.aggregate([
        { $limit: 1 },
        { $lookup: { from: 'reviews', localField: 'reviews', foreignField: '_id', as: 'reviewDocs' } },
        {
            $addFields: {
                reviewCount: { $size: "$reviewDocs" },
                avgRating: { 
                    $cond: { 
                        if: { $eq: [{ $size: "$reviewDocs" }, 0] }, 
                        then: 0, 
                        else: { $avg: "$reviewDocs.rating" } 
                    } 
                },
                positiveCount: {
                    $size: {
                        $filter: {
                            input: "$reviewDocs",
                            as: "rev",
                            cond: { $eq: ["$$rev.sentiment", "positive"] }
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                positiveRatio: {
                    $cond: {
                        if: { $eq: ["$reviewCount", 0] },
                        then: 0,
                        else: { $multiply: [{ $divide: ["$positiveCount", "$reviewCount"] }, 100] }
                    }
                }
            }
        }
    ]);
    console.log(JSON.stringify(res, null, 2));
    mongoose.connection.close();
});
