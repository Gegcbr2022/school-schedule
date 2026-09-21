import Foundation

struct WatchLesson: Codable, Hashable, Identifiable {
  let n: Int
  let period: Int
  let start: Int
  let end: Int
  let title: String
  let subtitle: String
  let room: String
  let time: String
  let isClub: Bool

  var id: String { "\(n)-\(start)-\(title)" }
}

struct WatchDay: Codable, Hashable, Identifiable {
  let date: String
  let dayName: String
  let schoolCount: Int
  let lessons: [WatchLesson]

  var id: String { date }
}

struct WatchSnapshot: Codable, Hashable {
  let version: Int
  let updatedAt: String
  let date: String
  let dayName: String
  let profileName: String
  let profileSub: String
  let schoolCount: Int
  let lessons: [WatchLesson]
  let days: [WatchDay]?

  var cachedDays: [WatchDay] {
    var byDate: [String: WatchDay] = [:]
    for day in days ?? [] where byDate[day.date] == nil {
      byDate[day.date] = day
    }
    if byDate[date] == nil {
      byDate[date] = WatchDay(date: date, dayName: dayName, schoolCount: schoolCount, lessons: lessons)
    }
    return byDate.values.sorted { $0.date < $1.date }
  }

  var updatedAtDate: Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: updatedAt) ?? ISO8601DateFormatter().date(from: updatedAt)
  }

  private enum CodingKeys: String, CodingKey {
    case version, updatedAt, date, dayName, profileName, profileSub, schoolCount, lessons, days
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    version = try container.decode(Int.self, forKey: .version)
    guard version == 1 else { throw WatchSnapshotError.unsupportedVersion(version) }
    updatedAt = try container.decode(String.self, forKey: .updatedAt)
    guard Self.parseTimestamp(updatedAt) != nil else { throw DecodingError.dataCorruptedError(forKey: .updatedAt, in: container, debugDescription: "Invalid ISO8601 timestamp") }
    date = try container.decode(String.self, forKey: .date)
    dayName = try container.decode(String.self, forKey: .dayName)
    profileName = try container.decode(String.self, forKey: .profileName)
    profileSub = try container.decode(String.self, forKey: .profileSub)
    schoolCount = try container.decode(Int.self, forKey: .schoolCount)
    lessons = try container.decode([WatchLesson].self, forKey: .lessons)
    days = try container.decodeIfPresent([WatchDay].self, forKey: .days)
    guard WatchCalendar.date(for: date) != nil, Self.validLessons(lessons) else {
      throw DecodingError.dataCorruptedError(forKey: .date, in: container, debugDescription: "Invalid schedule date or lesson time")
    }
    if let days {
      guard days.allSatisfy({ WatchCalendar.date(for: $0.date) != nil && Self.validLessons($0.lessons) }) else {
        throw DecodingError.dataCorruptedError(forKey: .days, in: container, debugDescription: "Invalid schedule day")
      }
    }
  }

  private static func parseTimestamp(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }

  private static func validLessons(_ lessons: [WatchLesson]) -> Bool {
    lessons.allSatisfy { $0.start >= 0 && $0.start < $0.end && $0.end <= 24 * 60 }
      && zip(lessons, lessons.dropFirst()).allSatisfy { $0.start <= $1.start }
  }

  init(version: Int = 1, updatedAt: String, date: String, dayName: String, profileName: String, profileSub: String, schoolCount: Int, lessons: [WatchLesson], days: [WatchDay]? = nil) {
    self.version = version
    self.updatedAt = updatedAt
    self.date = date
    self.dayName = dayName
    self.profileName = profileName
    self.profileSub = profileSub
    self.schoolCount = schoolCount
    self.lessons = lessons
    self.days = days
  }
}

enum WatchSnapshotError: LocalizedError {
  case unsupportedVersion(Int)

  var errorDescription: String? {
    switch self {
      case .unsupportedVersion(let version): return "Непідтримувана версія розкладу: \(version)"
    }
  }
}

enum WatchCalendar {
  static var kyiv: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Kyiv") ?? .current
    return calendar
  }

  static func dateKey(_ date: Date) -> String {
    let parts = kyiv.dateComponents([.year, .month, .day], from: date)
    return "\(parts.year ?? 0)-\(String(format: "%02d", parts.month ?? 0))-\(String(format: "%02d", parts.day ?? 0))"
  }

  static func minuteOfDay(_ date: Date) -> Int {
    let parts = kyiv.dateComponents([.hour, .minute], from: date)
    return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
  }

  static func date(for key: String) -> Date? {
    guard key.count == 10 else { return nil }
    let formatter = DateFormatter()
    formatter.calendar = kyiv
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = kyiv.timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let date = formatter.date(from: key), formatter.string(from: date) == key else { return nil }
    return date
  }

  static func minuteStart(of date: Date) -> Date {
    if let start = kyiv.dateInterval(of: .minute, for: date)?.start { return start }
    let seconds = date.timeIntervalSince1970
    return Date(timeIntervalSince1970: floor(seconds / 60) * 60)
  }

  static func dateTime(on date: Date, minute: Int) -> Date? {
    guard (0...1440).contains(minute) else { return nil }
    let start = kyiv.startOfDay(for: date)
    if minute == 1440 { return kyiv.date(byAdding: .day, value: 1, to: start) }
    return kyiv.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: start)
  }
}

extension WatchSnapshot {
  func day(for date: Date) -> WatchDay? {
    let key = WatchCalendar.dateKey(date)
    return cachedDays.first(where: { $0.date == key })
  }
}

enum WatchScheduleState: Equatable {
  case empty
  case before(WatchLesson)
  case lesson(WatchLesson)
  case breakTime(WatchLesson)
  case expired
}

enum WatchSchedule {
  static func state(for lessons: [WatchLesson], at date: Date) -> WatchScheduleState {
    guard let first = lessons.first, let last = lessons.last else { return .empty }
    let minute = WatchCalendar.minuteOfDay(date)
    if minute < first.start { return .before(first) }
    if minute >= last.end { return .expired }
    for lesson in lessons {
      if minute < lesson.start { return .breakTime(lesson) }
      if minute < lesson.end { return .lesson(lesson) }
    }
    return .expired
  }
}
