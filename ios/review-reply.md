# Відповідь на Guideline 2.1 — Information Needed

Apple не відхилила застосунок по суті. Це стандартний запит до облікових
записів із короткою історією перевірок: «розкажіть докладніше». Треба
відповісти в App Store Connect і **тим самим текстом заповнити поле Notes**
у розділі App Review Information — тоді наступні випуски проходитимуть без
цих питань.

Куди писати: App Store Connect → Дзвінка → Проверка приложения → відправка
від 12 вересня → **Ответ на проверку приложения**.

---

## Текст відповіді (скопіювати повністю)

```
Thank you for reviewing Dzvinka. Please find the requested information below.

2. PURPOSE AND TARGET AUDIENCE

Dzvinka is a school timetable app for Ukrainian schoolchildren, their parents
and their teachers. Its primary audience is pupils aged 10-17 in grades 4-11.

The problem it solves: a school timetable in Ukraine is a paper sheet on a wall
or a photo forwarded in a chat group. To know what lesson is on right now, a
pupil has to find that photo, find their class row, find the correct column,
and compare it against the bell schedule. Dzvinka answers that in one glance:
it shows the current lesson, the room, the teacher, and a countdown to the bell.

The app also filters the timetable down to the pupil's own subgroups (learning
group, second foreign language, English subgroup, PE split), so a pupil never
sees a lesson that is not theirs.

There are no accounts, no grades, no social features, no user-generated content
shared between users, no advertising and no analytics. Nothing is collected
about the user. All settings stay on the device.

3. SETTING UP AND ACCESSING THE MAIN FEATURES

No login is required. There are no accounts of any kind, so no demo credentials
are needed and no account deletion flow exists.

On first launch the app shows a setup sheet:
  1. Choose a class, for example "10-Б".
  2. Optionally choose subgroups (learning group 1 or 2, German or French,
     English subgroup A/B/C, PE split).
  3. Tap "Готово" (Done).

The timetable appears immediately. No network connection is required at any
point - the full school timetable is bundled inside the app.

Main features and how to reach them, all from the main screen:
  - Current lesson with countdown: shown on the card at the top.
  - Any other day: tap a date in the horizontal date strip.
  - Whole week at once: the "Весь тиждень" button.
  - Teacher directory: the person icon in the header.
  - Textbooks (PDF): the book icon in the header.
  - Light/dark theme: the moon/sun icon in the header.
  - Settings, profiles, clubs: the sliders icon in the header.
  - Homework and notes: tap "Додати ДЗ" on any lesson, or the note field
    above the day.
  - Canteen menu: the "Меню" chip above the timetable.

4. EXTERNAL SERVICES, TOOLS AND PLATFORMS

The app's core functionality uses no external services. It has no backend, no
authentication provider, no payment processor, no advertising SDK, no analytics
SDK and no AI services. It contains no third-party frameworks at all - the iOS
shell is plain SwiftUI and WKWebView.

The app makes exactly two kinds of network request, both of them simple
downloads of static files, and both optional:

  a) Timetable updates. The app periodically downloads one static JSON file
     containing the school timetable, so that a changed lesson reaches pupils
     without an app update. Nothing is uploaded and no information about the
     user is sent. If the request fails, the app keeps using the timetable
     bundled in the binary.

  b) Textbook PDFs. Only when the user explicitly opens or saves a textbook.
     These are static PDF files hosted on Cloudflare R2 object storage.

5. REGIONAL DIFFERENCES

There are none. The app behaves identically in every region and contains no
region-gated features or content. It is available in Ukrainian only.

One deliberate detail: all times are always computed in the Europe/Kyiv time
zone regardless of the device's own time zone, because the school bells ring in
Ukraine. A user travelling abroad still sees the correct Ukrainian lesson times.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL

The app does not operate in a regulated industry. It provides no services that
require a licence.

Regarding third-party material: the app displays the lesson timetable of one
Ukrainian state school - Lyceum No. 11 of Ivano-Frankivsk City Council - and
the surnames of its teachers. This is the same information the school publishes
itself: the timetable is posted publicly on the school premises and distributed
to pupils and parents. The app shows teachers' surnames exactly as they appear
on that official timetable. No contact details, no photographs, and no personal
data of teachers or pupils are included in the app.

The app is not affiliated with the school in any official capacity and does not
claim to be. It does not use the school's logo or branding.

1. SCREEN RECORDING

A screen recording captured on a physical iPhone is attached, showing the app
from launch through the typical user flow: first-launch class selection, the
current-lesson card, switching days, the weekly view, the teacher directory and
the settings.

The app has no account registration, no login, no account deletion flow, no
user-generated content shared between users, and no paid content or features,
so none of those flows appear in the recording.
```

---

## Коротка версія — для поля Notes

Повна відповідь вище не вміщається в поле «Примечания» (ліміт 4000 знаків,
у ній 4828). Тому туди — ось це, а повний текст іде у відповідь на перевірку.

```
Dzvinka is a school timetable app for Ukrainian pupils (grades 4-11), their
parents and teachers.

NO LOGIN. There are no accounts of any kind, so no demo credentials are needed
and no account deletion flow exists. On first launch, pick a class (e.g. 10-Б),
tap "Готово", and the timetable appears. No network connection is required -
the full timetable is bundled in the app.

MAIN FEATURES, all reachable from the main screen: current lesson with a
countdown to the bell; any other day via the date strip; "Весь тиждень" for the
whole week; person icon for the teacher directory; book icon for textbooks;
moon icon for dark theme; sliders icon for settings, profiles and clubs;
"Додати ДЗ" on a lesson for homework; "Меню" chip for the canteen menu.

NO USER-GENERATED CONTENT shared between users. No advertising, no analytics,
no tracking, no in-app purchases, no paid features.

EXTERNAL SERVICES: none for core functionality. No backend, no authentication,
no payment processor, no AI services, no third-party SDKs. The app makes only
two kinds of request, both plain downloads of static files and both optional:
(a) one static JSON file with the timetable, so a changed lesson reaches pupils
without an app update - nothing is uploaded; (b) textbook PDFs from Cloudflare
R2, only when the user opens or saves a book.

REGIONS: no regional differences. Ukrainian only. All times are always computed
in the Europe/Kyiv time zone, because the school bells ring in Ukraine.

THIRD-PARTY MATERIAL: the app shows the timetable of one Ukrainian state school
(Lyceum No. 11, Ivano-Frankivsk) and its teachers' surnames, exactly as the
school publishes them on the timetable posted on its premises. No contact
details, photographs or personal data of teachers or pupils are included. The
app is not affiliated with the school and does not use its logo or branding.
```

---

## Що зняти на відео

Apple просить запис **із фізичного телефона**, не з симулятора. Застосунок
уже стоїть через TestFlight, тож підійде звичайний запис екрана iPhone
(Пункт керування → «Запис екрана»).

Приблизно хвилина, без поспіху:

1. **Домашній екран**, дотик по іконці «Дзвінка» — запис має починатися
   із запуску застосунку, це вимога.
2. **Екран «Ваш клас»**: прокрутити, вибрати клас (10-Б), вибрати групи,
   натиснути «Готово».
3. **Головний екран**: показати картку «що зараз» / «наступний урок»,
   дати секунду роздивитися.
4. **Стрічка дат**: перемкнути на понеділок, показати список уроків із
   кабінетами й учителями.
5. **«Весь тиждень»** — відкрити, прокрутити, закрити.
6. **Іконка людини** — довідник учителів, прокрутити.
7. **Іконка книжок** — підручники.
8. **Іконка місяця** — перемкнути тему й назад.
9. **Іконка налаштувань** — показати профілі й гуртки, закрити.

Чого **не** показувати: нічого з того, чого в застосунку немає — реєстрації,
входу, покупок. Їх немає, і в тексті відповіді так і написано.

---

## Знімки екрана — з ними все гаразд

Apple нагадала про **Guideline 2.3.3** (знімки мають показувати застосунок у
роботі, а не заставку), але це стандартний абзац «Prevent Common Issues», а
не зауваження до нас.

Перевірено в App Store Connect: завантажено 4 знімки, і перший — головний
екран із поточним уроком «Англійська мова» та «До кінця 40 хв». Це саме
застосунок у роботі. Міняти нічого не треба.

## Куди прикласти відео

У тому ж розділі «Інформація для перевірки застосунку», під полем
«Примечания», є **«Вкладення»** — туди й лягає запис екрана. Так він
потрапить одразу до перевіряльника.
