// if (process.env.NODE_ENV !== "production") {
//   require("dotenv").config();
// }
require("dotenv").config();

const express = require("express");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const mongoose = require("mongoose");
const path = require("path");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const expressMongoSanitize = require("@exortek/express-mongo-sanitize");
const helmet = require("helmet");
const GeneralSetting = require('./models/generalSetting');
const ExpressError = require("./utils/ExpressError");
const User = require("./models/users");

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(async (req, res, next) => {
    // Tìm cấu hình, nếu chưa có thì tạo mới
    let setting = await GeneralSetting.findOne();
    if (!setting) {
        setting = new GeneralSetting({ siteTitle: 'Quán Ăn Việt' });
        await setting.save();
    }
    
    // Biến này sẽ dùng được ở navbar.ejs và footer.ejs
    res.locals.generalSetting = setting; 
    next();
});
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(expressMongoSanitize());

const campgroundRoutes = require("./routes/campgrounds");
const reviewRoutes = require("./routes/reviews");
const userRoutes = require("./routes/users");
const adminRoutes = require('./routes/admin');
mongoose.connect("mongodb://localhost:27017/yelp-camp");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const sessionConfig = {
  name: "__ui_s",
  secret: "secretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    // secure: true,
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(session(sessionConfig));
app.use(flash());

const scriptSrcUrls = [
  "https://stackpath.bootstrapcdn.com/",
  "https://api.tiles.mapbox.com/",
  "https://api.mapbox.com/",
  "https://kit.fontawesome.com/",
  "https://cdnjs.cloudflare.com/",
  "https://cdn.jsdelivr.net",
];

const styleSrcUrls = [
  "https://kit-free.fontawesome.com/",
  "https://stackpath.bootstrapcdn.com/",
  "https://api.mapbox.com/",
  "https://api.tiles.mapbox.com/",
  "https://fonts.googleapis.com/",
  "https://use.fontawesome.com/",
  "https://cdn.jsdelivr.net",
];

const connectSrcUrls = [
  "'self'",
  "https://api.mapbox.com/",
  "https://events.mapbox.com/",
  "https://*.tiles.mapbox.com/",
  "https://cdn.jsdelivr.net",
];

const fontSrcUrls = [
  "'self'",
  "https://fonts.gstatic.com/",
  "https://use.fontawesome.com/",
  "https://cdn.jsdelivr.net",
  "data:",
];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", ...scriptSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      connectSrc: connectSrcUrls,
      imgSrc: [
        "'self'",
        "blob:",
        "data:",
        "https://res.cloudinary.com/dyq8h16eb/",
        "https://images.unsplash.com/",
        "https://images.pexels.com/",
        "https://*.tiles.mapbox.com/",
      ],
      workerSrc: ["'self'", "blob:"],
      fontSrc: fontSrcUrls,
      upgradeInsecureRequests: [],
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    // Nếu đã đăng nhập VÀ bị khóa
    if (req.isAuthenticated() && req.user.isBanned) {
        req.logout(function(err) {
            if (err) { return next(err); }
            req.flash('error', 'Tài khoản của bạn đã bị khóa do vi phạm quy định!');
            return res.redirect('/login');
        });
    } else {
        next();
    }
});
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/fakeuser", async (req, res) => {
  const user = new User({ email: "ansq@gmail.com", username: "ansq" });
  const newUser = await User.register(user, "chicken123");
  res.send(newUser);
});

app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/reviews/", reviewRoutes);
app.use("/", userRoutes);
app.use('/admin', adminRoutes);
app.get("/", (req, res) => {
  res.render("home");
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page not Found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(statusCode).render("error", { err });
});
app.listen(3030, () => {
  console.log("Server is running on port 3030");
});
