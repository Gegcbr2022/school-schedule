import Foundation
import XCTest
@testable import DzvinkaWatchModel

final class WatchSnapshotTests: XCTestCase {
  private let lessons = [
    WatchLesson(n: 1, period: 1, start: 540, end: 585, title: "Математика", subtitle: "", room: "12", time: "09:00–09:45", isClub: false),
    WatchLesson(n: 2, period: 2, start: 600, end: 645, title: "Історія", subtitle: "", room: "", time: "10:00–10:45", isClub: false),
  ]

  func testDaySelectionUsesKyivDateAndRejectsYesterday() throws {
    let snapshot = WatchSnapshot(updatedAt: "2026-09-20T08:00:00Z", date: "2026-09-20", dayName: "Неділя", profileName: "5-А", profileSub: "", schoolCount: 0, lessons: [], days: [
      WatchDay(date: "2026-09-21", dayName: "Понеділок", schoolCount: 2, lessons: lessons),
    ])
    let kyiv = TimeZone(identifier: "Europe/Kyiv")!
    let monday = ISO8601DateFormatter()
    monday.timeZone = kyiv
    let date = monday.date(from: "2026-09-21T00:30:00+03:00")!
    XCTAssertEqual(snapshot.day(for: date)?.date, "2026-09-21")
    XCTAssertNil(snapshot.day(for: monday.date(from: "2026-09-22T23:59:00+03:00")!))
  }

  func testLegacySnapshotOnlyWorksOnItsExactDate() {
    let snapshot = WatchSnapshot(updatedAt: "2026-09-20T08:00:00Z", date: "2026-09-20", dayName: "Неділя", profileName: "5-А", profileSub: "", schoolCount: 2, lessons: lessons)
    let date = WatchCalendar.kyiv.date(from: DateComponents(year: 2026, month: 9, day: 20, hour: 10))!
    XCTAssertEqual(snapshot.day(for: date)?.lessons.count, 2)
    XCTAssertNil(snapshot.day(for: date.addingTimeInterval(86_400)))
  }

  func testScheduleTransitions() {
    let calendar = WatchCalendar.kyiv
    func date(_ minute: Int) -> Date { calendar.date(from: DateComponents(year: 2026, month: 9, day: 21, hour: minute / 60, minute: minute % 60))! }
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(500)), .before(lessons[0]))
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(540)), .lesson(lessons[0]))
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(585)), .breakTime(lessons[1]))
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(590)), .breakTime(lessons[1]))
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(600)), .lesson(lessons[1]))
    XCTAssertEqual(WatchSchedule.state(for: lessons, at: date(645)), .expired)
    XCTAssertEqual(WatchSchedule.state(for: [], at: date(600)), .empty)
  }

  func testDecoderRejectsUnsupportedVersionAndAcceptsMissingDays() throws {
    let data = Data(#"{"version":1,"updatedAt":"2026-09-20T08:00:00.123Z","date":"2026-09-20","dayName":"Неділя","profileName":"5-А","profileSub":"","schoolCount":0,"lessons":[]}"#.utf8)
    XCTAssertNoThrow(try JSONDecoder().decode(WatchSnapshot.self, from: data))
    let bad = Data(String(decoding: data, as: UTF8.self).replacingOccurrences(of: "\"version\":1", with: "\"version\":2").utf8)
    XCTAssertThrowsError(try JSONDecoder().decode(WatchSnapshot.self, from: bad))
  }

  func testDecoderRejectsMalformedDateAndTimestamp() {
    let base = #"{"version":1,"updatedAt":"2026-09-20T08:00:00.123Z","date":"2026-09-20","dayName":"Неділя","profileName":"5-А","profileSub":"","schoolCount":0,"lessons":[]}"#
    for replacement in [
      ("\"date\":\"2026-09-20\"", "\"date\":\"2026-02-30\""),
      ("\"updatedAt\":\"2026-09-20T08:00:00.123Z\"", "\"updatedAt\":\"not-a-date\"")
    ] {
      let malformed = Data(base.replacingOccurrences(of: replacement.0, with: replacement.1).utf8)
      XCTAssertThrowsError(try JSONDecoder().decode(WatchSnapshot.self, from: malformed))
    }
  }

  func testDecoderRejectsInvalidLessonRangesAndOrdering() {
    let base = #"{"version":1,"updatedAt":"2026-09-20T08:00:00.123Z","date":"2026-09-20","dayName":"Неділя","profileName":"5-А","profileSub":"","schoolCount":1,"lessons":LESSONS}"#
    let valid = #"[{"n":1,"period":1,"start":540,"end":585,"title":"Математика","subtitle":"","room":"12","time":"09:00–09:45","isClub":false}]"#
    let cases = [
      valid.replacingOccurrences(of: "\"start\":540", with: "\"start\":-1"),
      valid.replacingOccurrences(of: "\"end\":585", with: "\"end\":540"),
      valid.replacingOccurrences(of: "\"end\":585", with: "\"end\":1441"),
      #"[{"n":2,"period":2,"start":600,"end":645,"title":"Історія","subtitle":"","room":"","time":"10:00–10:45","isClub":false},{"n":1,"period":1,"start":540,"end":585,"title":"Математика","subtitle":"","room":"12","time":"09:00–09:45","isClub":false}]"#
    ]
    for lessonsJSON in cases {
      let malformed = Data(base.replacingOccurrences(of: "LESSONS", with: lessonsJSON).utf8)
      XCTAssertThrowsError(try JSONDecoder().decode(WatchSnapshot.self, from: malformed))
    }
  }

  func testEmptyDayIsValidButMissingDayIsUnavailable() {
    let snapshot = WatchSnapshot(updatedAt: "2026-09-20T08:00:00Z", date: "2026-09-20", dayName: "Неділя", profileName: "5-А", profileSub: "", schoolCount: 0, lessons: [], days: [
      WatchDay(date: "2026-09-21", dayName: "Понеділок", schoolCount: 0, lessons: [])
    ])
    let emptyDay = WatchCalendar.kyiv.date(from: DateComponents(year: 2026, month: 9, day: 21, hour: 10))!
    let missingDay = WatchCalendar.kyiv.date(from: DateComponents(year: 2026, month: 9, day: 22, hour: 10))!
    XCTAssertNotNil(snapshot.day(for: emptyDay))
    XCTAssertEqual(WatchSchedule.state(for: snapshot.day(for: emptyDay)!.lessons, at: emptyDay), .empty)
    XCTAssertNil(snapshot.day(for: missingDay))
  }

  func testCachedDaysAreUniqueSortedAndIncludeLegacyTopDay() {
    let duplicate = WatchDay(date: "2026-09-21", dayName: "Перший", schoolCount: 0, lessons: [])
    let later = WatchDay(date: "2026-09-23", dayName: "Середа", schoolCount: 0, lessons: [])
    let snapshot = WatchSnapshot(updatedAt: "2026-09-20T08:00:00Z", date: "2026-09-20", dayName: "Неділя", profileName: "5-А", profileSub: "", schoolCount: 0, lessons: [], days: [later, duplicate, WatchDay(date: "2026-09-21", dayName: "Другий", schoolCount: 1, lessons: lessons)])
    XCTAssertEqual(snapshot.cachedDays.map(\.date), ["2026-09-20", "2026-09-21", "2026-09-23"])
    XCTAssertEqual(snapshot.cachedDays[1].dayName, "Перший")
  }

  func testKyivCalendarMinuteAndDeadlineBoundaries() {
    let date = WatchCalendar.date(for: "2026-09-21")!
    XCTAssertEqual(WatchCalendar.date(for: "2026-02-30"), nil)
    XCTAssertEqual(WatchCalendar.date(for: "2026-9-21"), nil)
    XCTAssertEqual(WatchCalendar.minuteStart(of: date), date)
    XCTAssertNotNil(WatchCalendar.dateTime(on: date, minute: 0))
    XCTAssertNotNil(WatchCalendar.dateTime(on: date, minute: 1440))
    XCTAssertNil(WatchCalendar.dateTime(on: date, minute: -1))
    XCTAssertNil(WatchCalendar.dateTime(on: date, minute: 1441))
    XCTAssertEqual(WatchCalendar.dateKey(WatchCalendar.dateTime(on: date, minute: 1440)!), "2026-09-22")
  }
}
