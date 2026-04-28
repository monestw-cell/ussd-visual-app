#!/bin/bash
set -e

echo "══════════════════════════════════════"
echo "   بناء APK لتطبيق USSD بواجهة مرئية"
echo "══════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# تثبيت EAS CLI
echo "▶ تثبيت EAS CLI..."
npm install -g eas-cli --silent 2>/dev/null || npx eas-cli --version > /dev/null 2>&1

echo ""
echo "▶ تسجيل الدخول لحساب Expo..."
echo "  (إذا ليس عندك حساب: expo.dev → Sign Up مجاناً)"
echo ""
eas login

echo ""
echo "▶ بناء APK على السحابة (سيستغرق 5-10 دقائق)..."
echo ""
eas build --platform android --profile preview --non-interactive

echo ""
echo "✅ تم! الرابط أعلاه للتحميل المباشر"
echo "   أو افتح expo.dev → Builds لرؤية الـ APK"
