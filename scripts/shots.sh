#!/bin/bash
#
# Знімок екрана симулятора для App Store.
#
# Повної автоматики тут навмисно немає: які саме екрани показувати в
# магазині — рішення людини, а не скрипта, та й «пройтись по застосунку
# й натиснути п'ять разів» швидше, ніж лагодити крихкий автомат, що
# тицяє по координатах.
#
# Скрипт бере на себе те, що дратує: правильний пристрій, правильний
# розмір і зрозумілі імена файлів.
#
#   ./scripts/shots.sh 1-today
#   ./scripts/shots.sh 2-week
#   ./scripts/shots.sh 3-teachers
#
# App Store вистачає одного набору 6.9″ (1320×2868) — на менші екрани
# Apple масштабує сама.
set -euo pipefail

cd "$(dirname "$0")/.."

DEVICE="${DEVICE:-iPhone 17 Pro Max}"
OUT="ios/screenshots"
NAME="${1:-}"

if [ -z "$NAME" ]; then
  echo "Вкажіть ім'я знімка: ./scripts/shots.sh 1-today"
  exit 1
fi

mkdir -p "$OUT"
FILE="$OUT/$NAME.png"

xcrun simctl io "$DEVICE" screenshot "$FILE" >/dev/null

SIZE=$(sips -g pixelWidth -g pixelHeight "$FILE" | awk '/pixel/ {printf "%s", $2"x"} END {print ""}' | sed 's/x$//')
WIDTH=$(sips -g pixelWidth "$FILE" | awk '/pixelWidth/ {print $2}')

echo "$FILE — $SIZE"

# 1320×2868 — єдиний розмір, який App Store приймає як 6.9″.
if [ "$WIDTH" != "1320" ]; then
  echo
  echo "УВАГА: ширина $WIDTH, а App Store для 6.9″ чекає 1320."
  echo "Знімайте на «iPhone 17 Pro Max» або задайте DEVICE=..."
fi
