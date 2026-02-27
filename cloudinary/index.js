const cloudinary = require("cloudinary"); // <-- NO .v2 here
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const storage = cloudinaryStorage({
  cloudinary, // library expects root object (has .v2)
  folder: "YelpCamp",
  allowedFormats: ["jpeg", "png", "jpg"],
});

module.exports = { cloudinary, storage };
