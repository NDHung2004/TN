const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /Restaurants/g, to: 'Restaurants' },
    { from: /restaurants/g, to: 'restaurants' },
    { from: /Restaurant/g, to: 'Restaurant' },
    { from: /restaurant/g, to: 'restaurant' },
    { from: /RESTAURANT/g, to: 'RESTAURANT' },
    { from: /RESTAURANTS/g, to: 'RESTAURANTS' }
];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
                results = results.concat(walk(fullPath));
            }
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('./');
let changedFiles = 0;

files.forEach(f => {
    if (f.endsWith('.js') || f.endsWith('.ejs') || f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.md')) {
        let content = fs.readFileSync(f, 'utf8');
        let modified = false;

        replacements.forEach(r => {
            if (content.match(r.from)) {
                content = content.replace(r.from, r.to);
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(f, content, 'utf8');
            changedFiles++;
            console.log(`Updated content: ${f.replace(process.cwd(), '')}`);
        }
    }
});
console.log(`Updated ${changedFiles} files.`);

// Now rename files
const renames = [
    { from: 'models/restaurant.js', to: 'models/restaurant.js' },
    { from: 'controllers/restaurants.js', to: 'controllers/restaurants.js' },
    { from: 'routes/restaurants.js', to: 'routes/restaurants.js' },
    { from: 'views/admin/restaurants.ejs', to: 'views/admin/restaurants.ejs' },
    { from: 'views/users/my-restaurants.ejs', to: 'views/users/my-restaurants.ejs' }
];

renames.forEach(r => {
    const fromPath = path.join(process.cwd(), r.from);
    const toPath = path.join(process.cwd(), r.to);
    if (fs.existsSync(fromPath)) {
        fs.renameSync(fromPath, toPath);
        console.log(`Renamed file: ${r.from} -> ${r.to}`);
    }
});

// Rename directory
const fromDir = path.join(process.cwd(), 'views/restaurants');
const toDir = path.join(process.cwd(), 'views/restaurants');
if (fs.existsSync(fromDir)) {
    fs.renameSync(fromDir, toDir);
    console.log(`Renamed directory: views/restaurants -> views/restaurants`);
}
