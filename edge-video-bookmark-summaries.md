# Edge Video Bookmark Summaries

- Generated: 2026-06-13 13:30:00
- Browser: Edge
- Scope: bilibili.com, b23.tv, douyin.com, youtube.com, youtu.be
- Matched bookmarks: 3

## Overall Summary

Edge favorites currently contain video-site entry bookmarks rather than individual video bookmarks. I found Bilibili, Douyin Jingxuan, and YouTube, but no specific Bilibili video pages, Douyin video pages, or YouTube watch/shorts/live links.

This means the current collection is better understood as a quick-launch group for video platforms, not yet as a watchlist that can be summarized by video topic, creator, or learning value.

## Favorites Found

### Bilibili

- Title: 哔哩哔哩 (゜-゜)つロ 干杯~-bilibili
- URL: https://www.bilibili.com/
- Folder: bookmark_bar / 收藏夹栏
- Type: site homepage

Summary: This is the main Bilibili entry point. It does not point to a specific video, playlist, creator, or topic, so there is no video content to summarize from this bookmark alone.

### Douyin

- Title: 抖音精选电脑版 - 抖音旗下优质视频平台
- URL: https://www.douyin.com/jingxuan
- Folder: bookmark_bar / 收藏夹栏 / 影视
- Type: curated video portal

Summary: This bookmark points to Douyin Jingxuan, placed under the "影视" folder. It suggests the Edge favorites include Douyin mainly as an entertainment or film/video discovery portal, but it still does not preserve a concrete video URL.

### YouTube

- Title: YouTube
- URL: https://www.youtube.com/
- Folder: bookmark_bar / 收藏夹栏
- Type: site homepage

Summary: This is the YouTube homepage entry. The extracted static page description identifies it as a platform for watching, uploading, and sharing videos and music. Since the bookmark is not a watch page, it cannot be summarized as a specific video.

## Practical Conclusion

Your Edge video favorites currently cover three platforms:

1. Bilibili: general Chinese video/community platform entry.
2. Douyin: curated short-video/entertainment entry, saved under "影视".
3. YouTube: general international video platform entry.

There are no specific saved video links in Edge favorites under the selected domains. To make future summaries more useful, save actual pages like:

- `https://www.bilibili.com/video/...`
- `https://www.douyin.com/video/...`
- `https://www.youtube.com/watch?v=...`
- `https://youtu.be/...`
- `https://www.youtube.com/shorts/...`

Then rerun:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Summarize-VideoBookmarks.ps1 -Browser Edge -Domains bilibili.com,b23.tv,douyin.com,youtube.com,youtu.be
```
