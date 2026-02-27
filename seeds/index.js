const mongoose = require("mongoose");
const Campground = require("../models/campground");
const restaurants = require("./restaurantData");

mongoose.connect("mongodb://localhost:27017/yelp-camp");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const seedDB = async () => {
  await Campground.deleteMany({});

  for (let r of restaurants) {
    const camp = new Campground({
      author: "697f5efd477a4ddebe10d25e",

      title: r.title,
      location: r.location,
      description: r.description,
      price: r.price,

      geometry: {
        type: "Point",
        coordinates: r.coordinates,
      },

      images: [
        {
          url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
          filename: "FoodReview/sample1",
        },
        {
          url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
          filename: "FoodReview/sample2",
        },
      ],
    });

    await camp.save();
  }
};

seedDB().then(() => mongoose.connection.close());
