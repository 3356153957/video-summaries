import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('file:///c:/Users/Administrator/Documents/视频总结/dashboard/index.html');
  await page.waitForTimeout(2000); // 等待页面加载和渲染完成
  
  // 截图整个页面
  const imgPath = 'C:/Users/Administrator/.gemini/antigravity/brain/6a874430-4e5a-43b0-98ec-4d60cce35dad/dashboard_screencast.png';
  await page.screenshot({ path: imgPath });
  console.log('Screenshot saved to:', imgPath);
  
  // 过滤平台为“抖音”以查看抖音卡片
  // 我们找到平台的 filter-button 里面 text 是 Douyin 的
  const buttons = await page.$$('.filter-button');
  for (const btn of buttons) {
    const text = await btn.innerText();
    if (text.includes('Douyin')) {
      await btn.click();
      await page.waitForTimeout(1000);
      const imgPathDouyin = 'C:/Users/Administrator/.gemini/antigravity/brain/6a874430-4e5a-43b0-98ec-4d60cce35dad/dashboard_screencast_douyin.png';
      await page.screenshot({ path: imgPathDouyin });
      console.log('Douyin screenshot saved to:', imgPathDouyin);
      break;
    }
  }

  await browser.close();
})();
