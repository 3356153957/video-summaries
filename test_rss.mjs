import Parser from 'rss-parser';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
});

const feeds = [
  { name: '36kr (Tech/AI)', url: 'https://36kr.com/feed' },
  { name: 'IT之家 (Hardware)', url: 'https://www.ithome.com/rss/' },
  { name: 'Sina 国内', url: 'https://rss.sina.com.cn/news/china/focus15.xml' },
  { name: 'Sina 国际', url: 'https://rss.sina.com.cn/news/world/focus15.xml' }
];

async function testFeeds() {
  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      console.log(`✅ [${feed.name}] Success! Found ${parsed.items.length} items. Title 1: ${parsed.items[0]?.title}`);
    } catch (e) {
      console.log(`❌ [${feed.name}] Failed: ${e.message}`);
    }
  }
}

testFeeds();
