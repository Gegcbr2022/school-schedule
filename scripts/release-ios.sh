#!/bin/bash
#
# Збірка й відправка «Дзвінки» до App Store Connect (а звідти — у TestFlight).
#
# ЧОМУ КЛЮЧ, А НЕ ПАРОЛЬ. Завантажувати можна й за Apple ID з паролем, але
# тоді пароль доводиться десь тримати. Ключ App Store Connect — окремий
# файл, який можна відкликати однією кнопкою, не чіпаючи сам Apple ID.
#
# ЩО ПОТРІБНО ОДИН РАЗ:
#
#   1. Платне членство в Apple Developer Program ($99/рік).
#   2. App Store Connect → Users and Access → Integrations → App Store Connect API
#      → «+» → роль App Manager. Завантажити .p8 (дають рівно один раз!),
#      покласти, наприклад, у ~/.appstoreconnect/AuthKey_XXXXXXXX.p8
#   3. Створити застосунок у App Store Connect із bundle ID
#      app.dzvinka.schedule.
#
# ЯК ЗАПУСКАТИ:
#
#   TEAM_ID=775Y5Y2MFQ \
#   ASC_KEY_ID=XXXXXXXX \
#   ASC_ISSUER_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
#   ASC_KEY_PATH=~/.appstoreconnect/AuthKey_XXXXXXXX.p8 \
#   PACK_URL=https://gegcbr2022.github.io/school-schedule/data/school.json \
#   ./scripts/release-ios.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

: "${TEAM_ID:?Не вказано TEAM_ID — ідентифікатор команди розробника}"
: "${ASC_KEY_ID:?Не вказано ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?Не вказано ASC_ISSUER_ID}"
: "${ASC_KEY_PATH:?Не вказано ASC_KEY_PATH — шлях до .p8}"
: "${PACK_URL:?Не вказано PACK_URL — звідки застосунок братиме розклад}"

BUILD_DIR="${BUILD_DIR:-build}"
ARCHIVE="$BUILD_DIR/Dzvinka.xcarchive"

echo "→ Збираю веб (розклад братиметься з $PACK_URL)"
VITE_PACK_URL="$PACK_URL" npm run build:ios

echo "→ Перевіряю типи, лінт і тести"
npx tsc -b
npm run lint
npm test

echo "→ Архівую"
rm -rf "$ARCHIVE"
xcodebuild archive \
  -project ios/Dzvinka.xcodeproj \
  -scheme Dzvinka \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic

# Команду підставляємо у копію, щоб не тримати ідентифікатор у git.
OPTIONS="$BUILD_DIR/ExportOptions.plist"
cp ios/ExportOptions.plist "$OPTIONS"
/usr/libexec/PlistBuddy -c "Add :teamID string $TEAM_ID" "$OPTIONS"

echo "→ Відправляю в App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OPTIONS" \
  -exportPath "$BUILD_DIR/export" \
  -authenticationKeyPath "$(cd "$(dirname "$ASC_KEY_PATH")" && pwd)/$(basename "$ASC_KEY_PATH")" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo
echo "Готово. Збірка пішла на обробку — у TestFlight вона з'явиться"
echo "хвилин через 10–30, коли Apple її прожує."
echo
echo "Далі, вже в App Store Connect → TestFlight:"
echo "  · додати тестувальників (зовнішнім потрібен огляд Apple, зазвичай доба);"
echo "  · внутрішні (до 100) бачать збірку одразу після обробки."
