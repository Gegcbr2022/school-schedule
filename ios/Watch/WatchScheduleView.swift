import SwiftUI

struct WatchScheduleView: View {
  @ObservedObject var store: WatchStore
  @State private var selectedDate: String

  init(store: WatchStore, initialDate: String) {
    self.store = store
    _selectedDate = State(initialValue: initialDate)
  }

  var body: some View {
    TimelineView(.periodic(from: WatchCalendar.minuteStart(of: Date()), by: 60)) { context in
      let days = store.snapshot?.cachedDays ?? []
      let index = days.firstIndex(where: { $0.date == selectedDate }) ?? 0
      List {
        if days.indices.contains(index) {
          let day = days[index]
          dayNavigation(days, index: index)
            .listRowBackground(Color.clear)
          if day.lessons.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
              Label("Без занять", systemImage: "sun.max")
                .font(.headline).foregroundStyle(.mint)
              Text("У цей день уроків немає")
                .font(.caption).foregroundStyle(.secondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .padding(.vertical, 8)
          }
          ForEach(Array(day.lessons.enumerated()), id: \.offset) { _, lesson in
            WatchScheduleRow(lesson: lesson, day: day, date: context.date)
              .listRowBackground(isCurrent(lesson, day: day, date: context.date) ? Color.mint.opacity(0.15) : Color.gray.opacity(0.14))
          }
          Text("Час уроків — київський")
            .font(.caption2).foregroundStyle(.secondary)
            .listRowBackground(Color.clear)
        } else {
          Text("Відкрийте Дзвінку на iPhone, щоб отримати розклад")
            .font(.caption).fixedSize(horizontal: false, vertical: true)
        }
      }
      .listStyle(.plain)
    }
    .navigationTitle("Розклад")
  }

  private func dayNavigation(_ days: [WatchDay], index: Int) -> some View {
    HStack(spacing: 0) {
      Button {
        guard index > 0 else { return }
        selectedDate = days[index - 1].date
      } label: {
        Image(systemName: "chevron.left").frame(width: 32, height: 44)
      }
      .buttonStyle(.plain)
      .disabled(index == 0)
      .accessibilityLabel("Попередній день")

      VStack(spacing: 3) {
        Text(days[index].dayName).font(.caption.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)
        if let date = WatchCalendar.date(for: days[index].date) {
          Text(WatchDisplay.shortDate(date)).font(.caption2).foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity)
      .multilineTextAlignment(.center)

      Button {
        guard index + 1 < days.count else { return }
        selectedDate = days[index + 1].date
      } label: {
        Image(systemName: "chevron.right").frame(width: 32, height: 44)
      }
      .buttonStyle(.plain)
      .disabled(index + 1 == days.count)
      .accessibilityLabel("Наступний день")
    }
  }

  private func isCurrent(_ lesson: WatchLesson, day: WatchDay, date: Date) -> Bool {
    guard day.date == WatchCalendar.dateKey(date) else { return false }
    let minute = WatchCalendar.minuteOfDay(date)
    return lesson.start <= minute && minute < lesson.end
  }
}

private struct WatchScheduleRow: View {
  let lesson: WatchLesson
  let day: WatchDay
  let date: Date

  private var isToday: Bool { day.date == WatchCalendar.dateKey(date) }
  private var isCurrent: Bool {
    isToday && lesson.start <= WatchCalendar.minuteOfDay(date) && WatchCalendar.minuteOfDay(date) < lesson.end
  }
  private var isPast: Bool {
    day.date < WatchCalendar.dateKey(date) || (isToday && lesson.end <= WatchCalendar.minuteOfDay(date))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack {
        Text(lesson.isClub ? "Гурток" : "\(lesson.n) урок")
        Spacer(minLength: 4)
        if isCurrent { Text("Зараз").foregroundStyle(.mint) }
        else if isPast { Image(systemName: "checkmark").foregroundStyle(.secondary) }
      }
      .font(.caption2.weight(.medium))
      .foregroundStyle(.secondary)

      Text(lesson.title).font(.headline)
        .fixedSize(horizontal: false, vertical: true)
      Text(WatchDisplay.lessonTime(lesson) + (lesson.room.isEmpty ? "" : " · каб. \(lesson.room)"))
        .font(.caption2).monospacedDigit().foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
      if !lesson.subtitle.isEmpty {
        Text(lesson.subtitle).font(.caption2).foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, 6)
    .accessibilityElement(children: .combine)
  }
}
