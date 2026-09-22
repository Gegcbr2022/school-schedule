import AppIntents
import Foundation

/// «Гей, Сірі, який у мене зараз урок?»
///
/// Читаємо той самий знімок дня, що годує віджети (App Group). Тобто
/// відповідь не вимагає ані відкривати застосунок, ані мережі, ані
/// перерахунку розкладу: усе вже пораховано тим самим кодом, що малює
/// екран, і розійтись вони не можуть.
///
/// Через це ж і головне обмеження, яке варто знати: якщо застосунок не
/// відкривали дуже давно, знімок може бути вчорашній. Тоді ми так і
/// кажемо — «відкрийте Дзвінку», — а не вигадуємо урок.
private struct DaySnapshot {
  struct Lesson {
    let n: Int
    let start: Int
    let end: Int
    let title: String
    let room: String
    let isClub: Bool
  }

  let profileName: String
  let dayName: String
  let lessons: [Lesson]

  static func load() -> DaySnapshot? {
    guard
      let data = SharedStore.defaults?.data(forKey: SharedStore.widgetSnapshotKey),
      let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      raw["date"] as? String == Clock.todayKey(),
      let rows = raw["lessons"] as? [[String: Any]]
    else { return nil }

    return DaySnapshot(
      profileName: raw["profileName"] as? String ?? "Дзвінка",
      dayName: raw["dayName"] as? String ?? "",
      lessons: rows.map {
        Lesson(
          n: $0["n"] as? Int ?? 0,
          start: $0["start"] as? Int ?? 0,
          end: $0["end"] as? Int ?? 0,
          title: $0["title"] as? String ?? "",
          room: $0["room"] as? String ?? "",
          isClub: $0["isClub"] as? Bool ?? false
        )
      }
    )
  }

  var current: Lesson? {
    let minute = Clock.minuteNow()
    return lessons.first { minute >= $0.start && minute < $0.end }
  }

  var next: Lesson? {
    let minute = Clock.minuteNow()
    return lessons.first { $0.start > minute }
  }
}

private enum Clock {
  static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Kyiv") ?? .current
    return calendar
  }

  static func minuteNow() -> Int {
    let parts = calendar.dateComponents([.hour, .minute], from: Date())
    return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
  }

  static func todayKey() -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: Date())
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  static func time(_ minute: Int) -> String {
    String(format: "%02d:%02d", minute / 60, minute % 60)
  }

  /// «12 хвилин», «1 годину 5 хвилин» — так, як це вимовляє Сірі.
  static func duration(_ minutes: Int) -> String {
    if minutes < 60 { return "\(minutes) хв" }
    let h = minutes / 60
    let m = minutes % 60
    return m == 0 ? "\(h) год" : "\(h) год \(m) хв"
  }
}

private let noData = "Відкрийте Дзвінку — розклад на сьогодні ще не оновився."

private func place(_ lesson: DaySnapshot.Lesson) -> String {
  lesson.room.isEmpty ? "" : ", каб. \(lesson.room)"
}

struct CurrentLessonIntent: AppIntent {
  static var title: LocalizedStringResource = "Який зараз урок"
  static var description = IntentDescription("Урок, який іде просто зараз, і скільки до дзвінка.")
  /// Відповідь уміщається в одну фразу — відкривати застосунок нема сенсу.
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let day = DaySnapshot.load() else { return .result(dialog: "\(noData)") }

    guard let now = day.current else {
      if let next = day.next {
        let left = next.start - Clock.minuteNow()
        return .result(
          dialog: "Зараз уроку немає. Далі \(next.title) о \(Clock.time(next.start)) — через \(Clock.duration(left))."
        )
      }
      return .result(dialog: "На сьогодні уроки закінчились.")
    }

    let left = now.end - Clock.minuteNow()
    let what = now.isClub ? "Зараз \(now.title)" : "Зараз \(now.n) урок — \(now.title)"
    return .result(dialog: "\(what)\(place(now)). До дзвінка \(Clock.duration(left)).")
  }
}

struct NextLessonIntent: AppIntent {
  static var title: LocalizedStringResource = "Який наступний урок"
  static var description = IntentDescription("Що буде далі й о котрій воно починається.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let day = DaySnapshot.load() else { return .result(dialog: "\(noData)") }
    guard let next = day.next else {
      return .result(dialog: "Більше сьогодні нічого немає.")
    }

    let left = next.start - Clock.minuteNow()
    let what = next.isClub ? next.title : "\(next.n) урок — \(next.title)"
    return .result(
      dialog: "Далі \(what)\(place(next)) о \(Clock.time(next.start)), через \(Clock.duration(left))."
    )
  }
}

struct TimeLeftIntent: AppIntent {
  static var title: LocalizedStringResource = "Скільки до дзвінка"
  static var description = IntentDescription("Скільки хвилин лишилось до найближчого дзвінка.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let day = DaySnapshot.load() else { return .result(dialog: "\(noData)") }
    let minute = Clock.minuteNow()

    if let now = day.current {
      return .result(dialog: "До дзвінка \(Clock.duration(now.end - minute)).")
    }
    if let next = day.next {
      return .result(dialog: "Урок почнеться через \(Clock.duration(next.start - minute)).")
    }
    return .result(dialog: "Дзвінків сьогодні більше не буде.")
  }
}

/// Фрази, якими це кличуть. `\(.applicationName)` обов'язковий: без назви
/// застосунку Сірі не знає, кого саме питають, і фразу не приймає.
struct DzvinkaShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: CurrentLessonIntent(),
      phrases: [
        "Який зараз урок у \(.applicationName)",
        "Що зараз у \(.applicationName)",
        "\(.applicationName): що зараз",
      ],
      shortTitle: "Що зараз",
      systemImageName: "clock"
    )
    AppShortcut(
      intent: NextLessonIntent(),
      phrases: [
        "Який наступний урок у \(.applicationName)",
        "Що далі у \(.applicationName)",
        "\(.applicationName): наступний урок",
      ],
      shortTitle: "Наступний урок",
      systemImageName: "arrow.right.circle"
    )
    AppShortcut(
      intent: TimeLeftIntent(),
      phrases: [
        "Скільки до дзвінка у \(.applicationName)",
        "\(.applicationName): скільки до дзвінка",
      ],
      shortTitle: "До дзвінка",
      systemImageName: "bell"
    )
  }
}
