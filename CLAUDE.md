# Дзвінка — нотатки для Claude

PWA з розкладом уроків Ліцею №11 (Івано-Франківськ): Vite + React 19 +
TypeScript, звичайний CSS, без бекенду. Сайт живе на GitHub Pages у
підпапці `/school-schedule/`. Поряд — iOS-оболонка (`ios/`) і Cloudflare
Worker зі станом тривоги (`worker/`). Докладно: `README.md`,
`docs/ARCHITECTURE.md`, `ios/README.md`, `worker/README.md`.

## Команди

```bash
npm ci
npm run dev     # http://localhost:5173/school-schedule/ — service worker тут вимкнений
npm run build   # tsc -b → npm run pack → vite build, у dist/
npm test        # vitest run: src/**/*.test.ts, worker/src/index.test.js, scripts/workflows.test.mjs
npm run lint    # oxlint за .oxlintrc.json; падає лише на error, warn не валить
npm run pack    # лише пак даних: src/data/seed → public/data/school.json (файл у .gitignore)
npx tsc -b      # лише типи
```

Офлайн і service worker перевіряються через `npm run build && npm run preview`.

## CI і деплой

- `.github/workflows/deploy.yml` — на push у `main` і вручну:
  `npx tsc -b` → `npm run lint` → `npm test` → `npm run build` → GitHub Pages.
  Червоні типи, lint чи тести зупиняють деплой.
- `.github/workflows/ci.yml` — на pull request ті самі кроки й збірка, без
  публікації і з правами лише на читання.

Кроки в обох файлах мають збігатися: `scripts/workflows.test.mjs` падає, якщо
з якогось зникла перевірка, вона опинилась після збірки або `ci.yml` почав
публікувати.

## Де дані

Усе, що стосується конкретної школи, лежить у `src/data/seed/`:

- `config.ts` — `BELLS` (дзвінки, періоди 1–12), `SUBJECTS`, `SCHOOL` (разом із `seedVersion`);
- `timetable.ts` — уроки 5–11 класів, згенеровані `scripts/import-timetable.mjs`
  з PDF aSc; скрипт накладає `kabinety.mjs`, `vchyteli.mjs`, `stend.mjs`.
  Ручні правки при повторному імпорті треба перенести в `OVERRIDES` скрипта;
- `junior.ts` — 1–4 класи, `scripts/import-junior.mjs` з Word;
- `teachers.ts` — `scripts/import-teachers.mjs` з `учителя.json`;
- `menu.ts`, `books.ts`, `special.ts` (особливі дні за датою) — правляться руками.

`src/data/*.ts` поза `seed/` — типи й функції; самі дані вони беруть із паку
(`src/data/pack.ts`). Пак вибирається синхронно до першого малювання:
свіжий збережений або `SEED_PACK` зі збірки. Нічого асинхронного в `pack.ts`
не додавати. Застосунок підтягує свіжий пак із `data/school.json` на сервері
(`src/lib/packUpdate.ts`) і бере його лише тоді, коли
`version` більша за його поточну (`isNewer`, порівняння рядків).

**Змінили дані в `seed/` — підніміть `SCHOOL.seedVersion`** у
`seed/config.ts`, формат `рррр-мм-ддТгг:хх`. Без цього сайт оновиться з новою
збіркою, а iOS-застосунок, у якого ця версія вже є, нових даних із сервера не
візьме: версія та сама.

## Меню на тиждень

Джерело — примірне меню їдальні (таблиця у Word), переписується руками,
скрипта імпорту немає. Так робилися коміти «Меню на 14–18 вересня» й
«Меню на 21–25 вересня»:

1. `src/data/seed/menu.ts`: переписати `MENU` — п'ять днів Пн…Пт, у кожному
   `breakfast` і `lunch` зі страв `{ out, name }`. `out` — рядок: «150»,
   «130/3», «1 шт». Посунути `MENU_FROM`/`MENU_TO` (`рррр-мм-дд`), звірити
   `MENU_TITLE` і `MENU_FOR`. Виправлені помилки оригіналу записати в шапку файлу.
2. Підняти `SCHOOL.seedVersion` у `src/data/seed/config.ts`. Без цього
   встановлений iOS-застосунок нове меню не отримає.
3. `npm test`, коміт `Меню на ДД–ДД місяця`, push у `main` — далі деплой сам.

Коли дата поза `MENU_FROM…MENU_TO`, аркуш меню (`src/components/MenuSheet.tsx`)
показує останнє меню з приміткою «Свіжішого в їдальні ще не давали — страви
можуть відрізнятись». Забуте оновлення видно лише з цієї примітки.

## Обережно

- **`ios/`** — Swift-оболонка (застосунок, віджети, Watch, Live Activity).
  Збирається лише на Mac у Xcode (`npm run build:ios`, `scripts/release-ios.sh`),
  тут її не зібрати й не перевірити — без прямого прохання не чіпати.
  `ios/Web/` генерується й лежить у `.gitignore`. Веб говорить з оболонкою
  через `window.webkit.messageHandlers` у `src/lib/native.ts`, `widgets.ts`,
  `notifications.ts`, `live.ts`, `alerts.ts`, `haptics.ts`, `review.ts`:
  зміна формату там ламає Swift-бік.
- **`worker/`** — Cloudflare Worker `dzvinka-alerts`. Деплоїться вручну
  (`npx wrangler deploy` з `worker/`), а не з CI; секрети `ALERTS_TOKEN`,
  `REFRESH_KEY` живуть у Worker'і. Формат `alerts.json` (`{ v: 1, at, regions }`)
  читають і `src/lib/alerts.ts`, і `ios/App/Alerts.swift`, тож зміна формату
  ламає вже встановлені застосунки. Тести Worker'а йдуть у загальному `npm test`.
- **Ключі сховища** `rozklad:*` у `localStorage` і кеші `rozklad-*` не
  перейменовувати: там налаштування людей і скачані підручники.
- **`base: '/school-schedule/'`** у `vite.config.ts` дорівнює назві
  репозиторію. Не перейменовувати ні те, ні інше.
- **`const BUILD = 'dev'` у `public/sw.js`**: цей рядок підміняє
  `stampServiceWorker` у `vite.config.ts`. Змінили рядок — збірка впаде з помилкою.
- **Персональні дані**: `src/data/contacts.ts` (телефони вчителів),
  `учителя.json`, `.r2.env` лежать у `.gitignore` і в git не потрапляють.
  Якщо `contacts.ts` є локально, `npm run build` вшиє телефони в `dist/`.
