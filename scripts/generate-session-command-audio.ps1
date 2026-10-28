# Optional synthetic command fixtures using installed Windows voices; no cloud TTS.
# These are not human recordings or a Palestinian dialect benchmark.
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../.wrangler/session-voice-audio'))
Add-Type -AssemblyName System.Speech
[IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
$cases = @(
 @{Name='command-ar';Culture='ar-SA';Voice='Microsoft Naayf';Text='أضف بند فحص تسجيل الدخول'},
 @{Name='command-he';Culture='he-IL';Voice='Microsoft Asaf';Text='הוסף בדיקת התחברות לרשימה'},
 @{Name='command-en';Culture='en-US';Voice='Microsoft David Desktop';Text='Add task check Firebase authentication'}
)
foreach ($case in $cases) {
 $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
 try {
  $synth.SelectVoice($case.Voice)
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile((Join-Path $OutputDirectory ($case.Name+'.wav')),$format)
  $synth.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="'+$case.Culture+'"><break time="1s"/>'+$case.Text+'<break time="1s"/></speak>')
  $metadata = @{rows=@(@{row=@{transcription=$case.Text;source=('Synthetic installed Windows voice: '+$case.Voice)}})} | ConvertTo-Json -Depth 6
  [IO.File]::WriteAllText((Join-Path $OutputDirectory ($case.Name+'-row.json')),$metadata,[Text.UTF8Encoding]::new($false))
 } finally { $synth.Dispose() }
}
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
 $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
 $synth.SetOutputToWaveFile((Join-Path $OutputDirectory 'command-mixed.wav'),$format)
 $synth.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><break time="1s"/><voice name="Microsoft Naayf">ضيف فحص </voice><voice name="Microsoft David Desktop">Firebase Auth</voice><voice name="Microsoft Naayf"> للتشيك ليست</voice><break time="1s"/></speak>')
 $metadata = @{rows=@(@{row=@{transcription='ضيف فحص Firebase Auth للتشيك ليست';source='Synthetic Arabic/English voice splice; not natural code-switch speech'}})} | ConvertTo-Json -Depth 6
 [IO.File]::WriteAllText((Join-Path $OutputDirectory 'command-mixed-row.json'),$metadata,[Text.UTF8Encoding]::new($false))
} finally { $synth.Dispose() }
