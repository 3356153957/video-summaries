$Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "c:\Users\Administrator\Documents\视频总结\DailyMorningNews.mjs" -WorkingDirectory "c:\Users\Administrator\Documents\视频总结"
$Trigger = New-ScheduledTaskTrigger -Daily -At 7:00am
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName "FeishuDailyMorningNews" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Send Daily Tech and Current Events News to Feishu" -Force

Write-Output "Scheduled task 'FeishuDailyMorningNews' has been successfully registered!"
