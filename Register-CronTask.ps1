# Auto register Windows Scheduled Task
# Sets cron-task.ps1 to run daily at 22:00 (10:00 PM)

$scriptPath = Join-Path (Get-Location) "cron-task.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find sync script: $scriptPath"
    exit 1
}

Write-Host "Creating daily trigger (10:00 PM)..." -ForegroundColor Cyan
$trigger = New-ScheduledTaskTrigger -Daily -At 10:00PM

Write-Host "Creating task action with hidden window style..." -ForegroundColor Cyan
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

Write-Host "Configuring task settings..." -ForegroundColor Cyan
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Write-Host "Registering Scheduled Task [DailyVideoFavoritesSync]..." -ForegroundColor Cyan

Register-ScheduledTask -TaskName "DailyVideoFavoritesSync" -Trigger $trigger -Action $action -Settings $settings -Description "Daily sync of video favorites, AI classification, Feishu notifications, and GitHub deployments" -Force

if ($?) {
    Write-Host "`n[Success] Scheduled Task [DailyVideoFavoritesSync] has been registered successfully." -ForegroundColor Green
    Write-Host "You can find it in the Windows Task Scheduler (taskschd.msc) root node." -ForegroundColor Green
    Write-Host "Note: Please ensure git credential helper is configured for passwordless push." -ForegroundColor Yellow
} else {
    Write-Error "Failed to register scheduled task. Try running PowerShell as Administrator if permission denied."
}
