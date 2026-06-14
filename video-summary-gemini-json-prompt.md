你将读取一个 JSON 输入包，里面包含 Bilibili、Douyin、YouTube 收藏条目，以及少量必要转写稿片段。

请严格输出 JSON，不要输出 Markdown，不要输出解释性前后缀。

目标：
1. 重新生成更具体的视频收藏总结。
2. 教程类视频不要深挖内容，只输出用途、适合谁看、学习价值和是否需要看。
3. 清单类/工具推荐类视频必须尽量抽取“具体清单项”。例如“10 个必装插件”要列出插件名和大概作用；如果转写有疑似识别错误，标注 confidence 为 low，不要脑补成确定事实。
4. 案例类视频抽取：做了什么、用了什么工具、结果是什么、可复用点。
5. 对 Douyin / YouTube 如果只有标题，就只基于标题做轻量总结，不要假装看过内容。
6. 输出要压缩，适合 Codex 后续接网页/飞书，不要长篇复述。

输出 JSON schema：
{
  "generated_at": "ISO 时间或空字符串",
  "policy_used": {
    "tutorial": "教程类处理规则",
    "list_or_tool": "清单类处理规则",
    "case": "案例类处理规则"
  },
  "platform_overview": [
    {
      "platform": "Bilibili/Douyin/YouTube",
      "count": 0,
      "themes": ["主题"],
      "notes": "一句话概览"
    }
  ],
  "items": [
    {
      "platform": "平台",
      "source_id": "BVID/videoId/空",
      "title": "标题",
      "url": "链接或空",
      "folder": "分类",
      "content_type": "tutorial/list_or_tool/case/general",
      "summary": "一句到三句具体总结",
      "named_items": [
        {
          "name": "插件/工具/项目名",
          "role": "作用",
          "confidence": "high/medium/low",
          "note": "可选，说明是否疑似转写错误"
        }
      ],
      "tools": ["工具或概念"],
      "actions": ["可执行动作"],
      "risks": ["时效性/隐私/不确定点"],
      "source_refs": ["精准锚点，例如 video-summary-gemini-input.json:id=BV1xxxx、transcript.txt:L200-250 或 video.srt:[12:30]"],
      "value_level": "高/中/低",
      "deep_watch_needed": true,
      "confidence": "high/medium/low"
    }
  ],
  "recommended_next_actions": ["下一步动作"]
}

限制：
- items 不需要覆盖所有 200 条；但必须覆盖所有 Bilibili AI 相关视频、Douyin AI与Codex工具中最有代表性的 20 条、YouTube 全部 23 条。
- 对于“Codex 10个必装插件”这条，named_items 必须尽力列出视频中提到的插件；不确定就 low confidence。
- 每个 item 必须输出 source_refs；如果只基于标题或输入元数据判断，用输入条目的 id/source_id/url 作为锚点；如果基于转写片段判断，使用文件名加行号或时间戳。
- 不要处理或复述明文密钥、token、cookie、密码、私钥。
