#!/bin/bash
# Dijalankan oleh workflow setelah "npx cap add android": memasang plugin notifikasi media + TTS bawaan Android.
set -e
J=android/app/src/main/java/app/pembacanovel
M=android/app/src/main/AndroidManifest.xml
cp native/*.java "$J"/
sed -i 's#<application#<queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>\n    <uses-permission android:name="android.permission.WAKE_LOCK"/>\n    <application#' "$M"
sed -i 's#</application>#    <service android:name=".MediaService" android:exported="false" android:foregroundServiceType="mediaPlayback"/>\n    </application>#' "$M"
# Tambalan TTS: sisipkan www/tts-fix.js ke index.html (perbaikan "Lanjut otomatis" di latar belakang)
if [ -f www/tts-fix.js ] && ! grep -q 'tts-fix.js' www/index.html; then
  sed -i 's#</body>#<script src="tts-fix.js"></script></body>#' www/index.html
  echo "tts-fix.js disisipkan ke www/index.html"
fi
ls "$J"; cat "$M"
