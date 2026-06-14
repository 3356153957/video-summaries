你将读取一个 JSON 输入包，里面只包含当前看板里“未分类 / 泛泛总结”的视频条目。

请严格输出 JSON，不要输出 Markdown，不要输出解释性前后缀。

任务：
1. 只基于 title、platform、url、current_summary 做轻量分类和标题级总结。
2. 不要假装看过视频内容；如果只能从标题判断，就写“基于标题判断”。
3. 不要输出“未分类”“等待后续深度总结”“基于标题轻量归档”这类无信息摘要。
4. 教程类不需要深挖内容，只说明教程主题、适合谁看、可能价值。
5. 工具/清单/项目类尽量提取标题里的工具名、项目名、软件名。
6. category 必须从 allowed_categories 中选择一个。

输出 JSON schema：
{
  "generated_at": "ISO 时间或空字符串",
  "items": [
    {
      "id": "原 id",
      "category": "allowed_categories 中的一个",
      "summary": "1-2 句，具体说明这条大概是什么，不能泛泛说等待总结",
      "key_points": ["2-4 个短要点"],
      "tools": ["标题里出现的工具/软件/概念，没有则空数组"],
      "actions": ["适合用户下一步做什么，1-3 条"],
      "risks": ["不确定性或时效性说明，1-2 条"],
      "source_refs": ["精准锚点，例如 video-summary-unclassified-input.json:id=Douyin-71"],
      "value_level": "高/中/低",
      "confidence": "high/medium/low"
    }
  ]
}

分类参考：
- AI与Codex工具：AI、Codex、Claude、Gemini、Agent、GitHub AI 项目、自动化、编程提效。
- CAD建模3D打印：CAD、SolidWorks、Fusion360、UG、3D 打印、MakerWorld、模型建模。
- 工程制造：机器人、无人机、飞控、PCB、机械结构、航天、工业设备。
- 学习教程：数学、软件教程、考试、通用学习方法。
- 健身健康：训练、拉伸、心率、身体健康。
- 哲学人文：哲学、心理学、人文、社会议题、生命意义。
- 游戏攻略：游戏、Steam、Minecraft、三角洲行动等。
- 模板素材：剪映模板、PS/PPT/素材模板、图片处理模板。
- 生活情感：亲密关系、日常生活、穿搭、家居、情感。
- 旅行美食：旅行、城市、景点、美食。
- 影音娱乐：音乐、演出、搞笑、影视、二创娱乐。
- 时事升学：高考、升学、新闻时事、政策信息。
- 其它收藏：实在无法归入以上类别但仍要保留。

不要处理或复述明文密钥、token、cookie、密码、私钥、支付信息。

每个 item 必须输出 source_refs；本任务只基于标题和输入元数据判断，所以优先使用输入条目的 id 作为锚点，例如 video-summary-unclassified-input.json:id=Douyin-71。
