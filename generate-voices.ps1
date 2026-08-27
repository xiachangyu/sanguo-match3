# 生成 12 个武将台词的中文语音到 audio/ 目录（WAV）
# ⚠️ 需要在正常桌面会话运行本脚本；受限/后台会话(mg 沙箱等)无法访问语音引擎会报"没有语音可用"。
# 依赖：Windows 自带中文语音（Microsoft Huihui Desktop, zh-CN）。运行过一次后即可在游戏里发声。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer

# 找到中文语音
$zh = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh-*' -and $_.Enabled } | Select-Object -First 1
if (-not $zh) {
  $s.Dispose()
  throw '未找到中文语音(zh-CN)。请安装中文语音包，或改用它处语音。'
}
$s.SelectVoice($zh.VoiceInfo.Name)
Write-Host ("使用语音: {0}（{1}）" -f $zh.VoiceInfo.Name, $zh.VoiceInfo.Culture.Name)

New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'audio') | Out-Null
# 16kHz / 16bit / 单声道，控制体积（每条几秒约几十 KB）
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  16000,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)

$voices = @(
  @{ id = 'liubei';    text = '我二弟天下无敌' },
  @{ id = 'guanyu';    text = '看我温酒斩华雄' },
  @{ id = 'zhangfei';  text = '俺也一样' },
  @{ id = 'huaxiong';  text = '谁敢应战' },
  @{ id = 'lvbu';      text = '天下无敌' },
  @{ id = 'caocao';    text = '宁教我负天下人' },
  @{ id = 'yuanshao';  text = '我有颜良文丑' },
  @{ id = 'zhugeliang';text = '鞠躬尽瘁，死而后已' },
  @{ id = 'lusu';      text = '以和为贵' },
  @{ id = 'zhouyu';    text = '既生瑜，何生亮' },
  @{ id = 'menghuo';   text = '七纵七擒' },
  @{ id = 'simayi';    text = '鹰视狼顾' }
)

foreach ($v in $voices) {
  $out = Join-Path $PSScriptRoot ('audio\' + $v.id + '.wav')
  $s.SetOutputToWaveFile($out, $fmt)
  $s.Speak($v.text)
  $s.SetOutputToNull()
  $len = (Get-Item $out).Length
  Write-Host ("生成 {0}.wav（{1}） : {2}" -f $v.id, ("{0:N0}" -f $len), $v.text)
}

$s.Dispose()
Write-Host '完成：12 个武将语音已生成到 audio/ 目录。'
