import SwiftUI
import WidgetKit

private enum WidgetStore {
  static let appGroup = "group.app.dzvinka.schedule"
  static let snapshotKey = "widgetSnapshot"
}

private struct Lesson: Codable, Hashable {
  let n: Int
  let period: Int
  let start: Int
  let end: Int
  let title: String
  let subtitle: String
  let room: String
  let time: String
  let isClub: Bool
}

private struct SnapshotStatus: Codable, Hashable {
  let kind: String
  let title: String
  let subtitle: String
  let minutes: Int
  let progress: Double
}

private struct Snapshot: Codable, Hashable {
  let version: Int
  let updatedAt: String
  let date: String
  let dayName: String
  let profileName: String
  let profileSub: String
  let schoolCount: Int
  let lessons: [Lesson]
  let status: SnapshotStatus
}

private enum LiveStatus: Hashable {
  case empty
  case before(next: Lesson, minutes: Int)
  case lesson(current: Lesson, next: Lesson?, minutes: Int, progress: Double)
  case pause(next: Lesson, minutes: Int)
  case done(total: Int)
}

private struct WidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot?
  let status: LiveStatus
}

private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> WidgetEntry {
    WidgetEntry(date: Date(), snapshot: Snapshot.demo, status: .lesson(current: .demo, next: .nextDemo, minutes: 12, progress: 0.62))
  }

  func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
    completion(entry(for: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
    let now = Date()
    let moments = refreshMoments(from: now, snapshot: loadSnapshot())
    let entries = moments.map { entry(for: $0) }
    completion(Timeline(entries: entries, policy: .after(moments.last ?? now.addingTimeInterval(15 * 60))))
  }

  private func entry(for date: Date) -> WidgetEntry {
    let snapshot = loadSnapshot()
    return WidgetEntry(date: date, snapshot: snapshot, status: liveStatus(snapshot: snapshot, at: date))
  }

  private func loadSnapshot() -> Snapshot? {
    guard
      let data = UserDefaults(suiteName: WidgetStore.appGroup)?.data(forKey: WidgetStore.snapshotKey),
      let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
    else { return nil }
    return snapshot
  }

  private func refreshMoments(from now: Date, snapshot: Snapshot?) -> [Date] {
    var dates = [now]
    for minute in stride(from: 5, through: 60, by: 5) {
      dates.append(now.addingTimeInterval(TimeInterval(minute * 60)))
    }

    let calendar = Self.kyivCalendar
    let startOfDay = calendar.startOfDay(for: now)
    for lesson in snapshot?.lessons ?? [] {
      for value in [lesson.start, lesson.end] {
        if let date = calendar.date(byAdding: .minute, value: value, to: startOfDay), date > now {
          dates.append(date)
          dates.append(date.addingTimeInterval(60))
        }
      }
    }

    return Array(Set(dates)).sorted().prefix(24).map { $0 }
  }

  private func liveStatus(snapshot: Snapshot?, at date: Date) -> LiveStatus {
    guard let snapshot else { return .empty }
    guard snapshot.date == Self.dateKey(date) else { return .empty }
    let lessons = snapshot.lessons
    guard let first = lessons.first, let last = lessons.last else { return .empty }

    let minute = Self.minuteOfDay(date)
    if minute < first.start {
      return .before(next: first, minutes: max(0, first.start - minute))
    }
    if minute >= last.end {
      return .done(total: snapshot.schoolCount)
    }

    for index in lessons.indices {
      let lesson = lessons[index]
      if minute >= lesson.end { continue }
      if minute >= lesson.start {
        let length = max(1, lesson.end - lesson.start)
        let progress = Double(minute - lesson.start) / Double(length)
        return .lesson(
          current: lesson,
          next: lessons.indices.contains(index + 1) ? lessons[index + 1] : nil,
          minutes: max(0, lesson.end - minute),
          progress: progress
        )
      }
      return .pause(next: lesson, minutes: max(0, lesson.start - minute))
    }

    return .done(total: snapshot.schoolCount)
  }

  private static var kyivCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Kyiv") ?? .current
    return calendar
  }

  private static func minuteOfDay(_ date: Date) -> Int {
    let parts = kyivCalendar.dateComponents([.hour, .minute], from: date)
    return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
  }

  private static func dateKey(_ date: Date) -> String {
    let parts = kyivCalendar.dateComponents([.year, .month, .day], from: date)
    return "\(parts.year ?? 0)-\(String(format: "%02d", parts.month ?? 0))-\(String(format: "%02d", parts.day ?? 0))"
  }
}

private extension Lesson {
  static let demo = Lesson(n: 3, period: 3, start: 600, end: 645, title: "Математика", subtitle: "Олена П.", room: "12", time: "10:00-10:45", isClub: false)
  static let nextDemo = Lesson(n: 4, period: 4, start: 655, end: 700, title: "Українська мова", subtitle: "каб. 18", room: "18", time: "10:55-11:40", isClub: false)
}

private extension Snapshot {
  static let demo = Snapshot(
    version: 1,
    updatedAt: "2026-09-12T12:00:00Z",
    date: "2026-09-12",
    dayName: "Середа",
    profileName: "10-Б",
    profileSub: "Розклад уроків",
    schoolCount: 6,
    lessons: [.demo, .nextDemo],
    status: SnapshotStatus(kind: "lesson", title: "Зараз 3 урок", subtitle: "Математика", minutes: 12, progress: 0.62)
  )
}

private extension View {
  func dzvinkaBackground() -> some View {
    containerBackground(for: .widget) {
      LinearGradient(
        colors: [Color(red: 0.96, green: 0.98, blue: 0.99), Color(red: 0.89, green: 0.95, blue: 0.94)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
  }
}

private func minutesText(_ minutes: Int) -> String {
  if minutes <= 0 { return "зараз" }
  return "\(minutes) хв"
}

private func title(for status: LiveStatus) -> String {
  switch status {
    case .empty: return "Уроків немає"
    case .before: return "До початку"
    case .lesson(let current, _, _, _): return current.isClub ? "Зараз гурток" : "Зараз \(current.n) урок"
    case .pause: return "Перерва"
    case .done: return "Уроки все"
  }
}

private func subject(for status: LiveStatus) -> String {
  switch status {
    case .empty: return "Відкрий Дзвінку, щоб оновити"
    case .before(let next, _), .pause(let next, _): return next.title
    case .lesson(let current, _, _, _): return current.title
    case .done(let total): return "Було \(total) уроків"
  }
}

private func minutes(for status: LiveStatus) -> Int {
  switch status {
    case .before(_, let minutes), .lesson(_, _, let minutes, _), .pause(_, let minutes): return minutes
    default: return 0
  }
}

private func progress(for status: LiveStatus) -> Double {
  if case .lesson(_, _, _, let progress) = status { return progress }
  return 0
}

private struct NowSmallView: View {
  let entry: WidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(entry.snapshot?.profileName ?? "Дзвінка")
        .font(.headline)
        .lineLimit(1)
      Spacer(minLength: 0)
      Text(title(for: entry.status))
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(subject(for: entry.status))
        .font(.title3.weight(.semibold))
        .lineLimit(2)
        .minimumScaleFactor(0.7)
      Gauge(value: progress(for: entry.status)) {
        EmptyView()
      }
      .gaugeStyle(.accessoryLinearCapacity)
      Text(minutes(for: entry.status) > 0 ? "\(minutesText(minutes(for: entry.status))) лишилось" : "за київським часом")
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .dzvinkaBackground()
  }
}

private struct NowAccessoryRectangularView: View {
  let entry: WidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title(for: entry.status)).font(.caption2)
      Text(subject(for: entry.status)).font(.headline).lineLimit(1)
      if minutes(for: entry.status) > 0 {
        Text("\(minutesText(minutes(for: entry.status)))").font(.caption)
      }
    }
  }
}

private struct NowAccessoryCircularView: View {
  let entry: WidgetEntry

  var body: some View {
    Gauge(value: progress(for: entry.status)) {
      Text("Дз")
    } currentValueLabel: {
      Text(minutes(for: entry.status) > 0 ? "\(minutes(for: entry.status))" : "✓")
    }
    .gaugeStyle(.accessoryCircular)
  }
}

private struct NextSmallView: View {
  let entry: WidgetEntry

  private var lesson: Lesson? {
    switch entry.status {
      case .before(let next, _), .pause(let next, _): return next
      case .lesson(_, let next, _, _): return next
      default: return nil
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("Далі")
        .font(.caption)
        .foregroundStyle(.secondary)
      if let lesson {
        Text(lesson.title)
          .font(.title3.weight(.semibold))
          .lineLimit(2)
          .minimumScaleFactor(0.7)
        Spacer(minLength: 0)
        Text(lesson.time)
          .font(.headline.monospacedDigit())
        Text(lesson.room.isEmpty ? lesson.subtitle : "каб. \(lesson.room)")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text("На сьогодні все")
          .font(.title3.weight(.semibold))
        Spacer(minLength: 0)
        Text(entry.snapshot?.dayName ?? "")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .dzvinkaBackground()
  }
}

private struct DayView: View {
  let entry: WidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text(entry.snapshot?.profileName ?? "Дзвінка")
            .font(.headline)
          Text(entry.snapshot?.dayName ?? "Розклад")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer()
        Text(minutes(for: entry.status) > 0 ? minutesText(minutes(for: entry.status)) : "")
          .font(.headline.monospacedDigit())
      }

      ForEach(Array((entry.snapshot?.lessons ?? []).prefix(5).enumerated()), id: \.offset) { _, lesson in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(lesson.time)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 72, alignment: .leading)
          VStack(alignment: .leading, spacing: 1) {
            Text(lesson.title)
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)
            Text(lesson.room.isEmpty ? lesson.subtitle : "каб. \(lesson.room)")
              .font(.caption2)
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
        }
      }

      Spacer(minLength: 0)
    }
    .dzvinkaBackground()
  }
}

private struct NowWidgetRoot: View {
  @Environment(\.widgetFamily) private var family

  let entry: WidgetEntry

  var body: some View {
    switch family {
      case .accessoryCircular:
        NowAccessoryCircularView(entry: entry)
      case .accessoryRectangular, .accessoryInline:
        NowAccessoryRectangularView(entry: entry)
      default:
        NowSmallView(entry: entry)
    }
  }
}

struct DzvinkaNowWidget: Widget {
  let kind = "DzvinkaNowWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      NowWidgetRoot(entry: entry)
    }
    .configurationDisplayName("Що зараз")
    .description("Поточний урок, час до дзвінка і прогрес.")
    .supportedFamilies([.systemSmall, .accessoryInline, .accessoryCircular, .accessoryRectangular])
  }
}

struct DzvinkaNextWidget: Widget {
  let kind = "DzvinkaNextWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      NextSmallView(entry: entry)
    }
    .configurationDisplayName("Наступний урок")
    .description("Що буде далі і о котрій починається.")
    .supportedFamilies([.systemSmall])
  }
}

struct DzvinkaDayWidget: Widget {
  let kind = "DzvinkaDayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      DayView(entry: entry)
    }
    .configurationDisplayName("День уроків")
    .description("Найближчі уроки сьогодні.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

@main
struct DzvinkaWidgetBundle: WidgetBundle {
  var body: some Widget {
    DzvinkaNowWidget()
    DzvinkaNextWidget()
    DzvinkaDayWidget()
  }
}
