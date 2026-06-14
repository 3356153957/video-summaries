import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.douyin.com/video/7650190124579618731', { timeout: 15000 });
    // wait for video or image
    await page.waitForTimeout(3000);
    
    // try to get the poster of the video element
    const poster = await page.evaluate(() => {
      const vid = document.querySelector('video');
      return vid ? vid.getAttribute('poster') : null;
    });
    console.log('Poster:', poster);
    
    // try to find any img tag that might be a cover
    const imgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.includes('pstatp.com') || src.includes('douyinpic.com') || src.includes('douyinvod.com'));
    });
    console.log('Images:', imgs);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
