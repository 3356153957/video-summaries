import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const dataPath = 'c:/Users/Administrator/Documents/视频总结/dashboard/data.js';
const dataContent = fs.readFileSync(dataPath, 'utf-8');
const jsonMatch = dataContent.match(/window\.VIDEO_DASHBOARD_DATA\s*=\s*(\[\s*\{[\s\S]*\}\s*\])\s*;/);
let videos = JSON.parse(jsonMatch[1]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let updatedCount = 0;
  // process a max of 20 videos at a time to prevent blocking and long wait times
  let processedThisRun = 0;
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (v.platform === 'Douyin' && v.cover === '') {
      processedThisRun++;
      if (processedThisRun > 90) {
        console.log("Processed 90 videos, stopping to prevent blocking. Run again to process more.");
        break;
      }
      
      console.log(`Scraping cover for ${v.url}...`);
      try {
        await page.goto(v.url, { timeout: 20000 });
        await page.waitForTimeout(3000);
        
        // Find image with biz_tag=pcweb_cover
        const coverUrl = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          const coverImg = imgs.find(img => img.src && img.src.includes('biz_tag=pcweb_cover'));
          return coverImg ? coverImg.src : null;
        });
        
        if (coverUrl) {
          console.log(`Found cover URL: ${coverUrl.substring(0, 50)}...`);
          // Download as base64
          const base64Data = await page.evaluate(async (url) => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result.split(',')[1]);
              reader.readAsDataURL(blob);
            });
          }, coverUrl);
          
          const videoId = v.url.split('/').pop().split('?')[0];
          const filename = `douyin-${videoId}.jpg`;
          const filepath = path.join('c:/Users/Administrator/Documents/视频总结/dashboard/covers', filename);
          fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
          console.log(`Saved cover to ${filename}`);
          
          videos[i].cover = `./covers/${filename}`;
          updatedCount++;
        } else {
          console.log(`No cover found for ${v.url}`);
        }
      } catch (e) {
        console.error(`Error processing ${v.url}: ${e.message}`);
      }
      
      // Save progress
      if (updatedCount > 0) {
        const newData = `window.VIDEO_DASHBOARD_DATA = ${JSON.stringify(videos, null, 2)};`;
        fs.writeFileSync(dataPath, newData);
      }
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Successfully updated ${updatedCount} covers.`);
  } else {
    console.log('No covers updated.');
  }
  
  await browser.close();
})();
