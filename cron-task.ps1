# 视频收藏与总结每日 22:00 同步部署脚本
# 运行环境：PowerShell

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Continue"

Write-Host "====== [1/6] 正在拉取最新的 Git 远程代码... ======" -ForegroundColor Cyan
git pull origin master

Write-Host "====== [2/6] 正在运行 Playwright 抓取最新收藏夹数据... ======" -ForegroundColor Cyan
try {
    node Extract-SiteFavorites.mjs
} catch {
    Write-Warning "抓取最新收藏夹出现异常，将继续处理已有数据。异常信息: $_"
}

Write-Host "====== [3/6] 正在整合并更新 Dashboard 输入... ======" -ForegroundColor Cyan
node Build-VideoSummaryGeminiInput.mjs
node Build-DashboardFromGeminiOutput.mjs
node Build-UnclassifiedClassificationInput.mjs

Write-Host "====== [4/6] 正在对新增视频进行 AI 智能分类与提炼... ======" -ForegroundColor Cyan
try {
    # 检查是否有未分类的视频
    $unclassifiedCount = node -e "console.log(require('./video-summary-unclassified-input.json').items.length)"
    if ([int]$unclassifiedCount -gt 0) {
        Write-Host "检测到共有 $unclassifiedCount 个新增未分类视频，开始调用 AI 进行分类整理..."
        node Run-ExternalAiSummary.mjs --prompt-file video-summary-unclassified-prompt.md --input-file video-summary-unclassified-input.json --sanitized-input-file video-summary-unclassified-input.sanitized.json --output-json video-summary-unclassified-output.json --run-meta-file video-summary-unclassified-run.json --provider gemini
        node Apply-UnclassifiedClassification.mjs
    } else {
        Write-Host "今天没有新增的待分类视频。" -ForegroundColor Green
    }
} catch {
    Write-Error "AI 自动分类步骤执行失败: $_"
}

Write-Host "====== [5/6] 正在获取并本地化视频封面图... ======" -ForegroundColor Cyan
node Fix-DashboardCovers.mjs
node Localize-BilibiliCovers.mjs
node Localize-RemoteCovers.mjs

Write-Host "====== [6/6] 正在向飞书推送今日的总结通知... ======" -ForegroundColor Cyan
try {
    node Push-ToFeishu.mjs
} catch {
    Write-Error "飞书消息推送失败，原因: $_"
}

Write-Host "====== 正在提交最新数据并自动部署至 GitHub... ======" -ForegroundColor Cyan
try {
    # 检查 Git 是否有变动
    $status = git status --porcelain
    if (-not [string]::IsNullOrEmpty($status)) {
        git add .
        git commit -m "auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git push origin master
        Write-Host "数据成功推送到 GitHub，GitHub Pages 网页正在后台自动构建部署中..." -ForegroundColor Green
    } else {
        Write-Host "本地数据未发生任何变动，无需推送更新。" -ForegroundColor Yellow
    }
} catch {
    Write-Error "推送到 GitHub 失败，请检查网络连接或 Git 凭证。错误: $_"
}

Write-Host "====== 定时同步流程全部执行完毕 ======" -ForegroundColor Green
