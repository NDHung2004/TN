const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:3030/login');
        await page.fill('input[name="username"]', 'ansq');
        await page.fill('input[name="password"]', 'chicken123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        console.log('Logged in successfully!');
        
        await page.goto('http://localhost:3030/profile/666ef11d51abf1b822d64f0f'); // Fake user ID won't work easily, need to get the real ID. Let's just find the profile link.
        await page.click('text="Trang cá nhân"'); // Usually in navbar
        await page.waitForTimeout(2000);
        
        console.log('On profile page. Clicking Edit button...');
        await page.click('button:has-text("Chỉnh sửa trang cá nhân")');
        
        await page.waitForTimeout(1000);
        
        const modal = await page.locator('#editProfileModal');
        const isVisible = await modal.isVisible();
        console.log('Is modal visible?', isVisible);
        
        const display = await modal.evaluate((node) => window.getComputedStyle(node).display);
        console.log('Modal display property:', display);
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
