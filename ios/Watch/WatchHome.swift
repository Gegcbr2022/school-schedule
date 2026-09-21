import SwiftUI

private enum WatchRoute: Hashable {
  case schedule(String)
}

struct WatchHome: View {
  @ObservedObject var store: WatchStore
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    NavigationStack {
      TimelineView(.periodic(from: WatchCalendar.minuteStart(of: Date()), by: 60)) { context in
        ScrollView {
          VStack(alignment: .leading, spacing: 12) {
            if let snapshot = store.snapshot, let day = snapshot.day(for: context.date) {
              currentCard(day: day, date: context.date)
              if case .lesson(let current) = WatchSchedule.state(for: day.lessons, at: context.date),
                let next = day.lessons.first(where: { $0.start >= current.end }) {
                nextCard(next)
              }
              if day.lessons.isEmpty || WatchSchedule.state(for: day.lessons, at: context.date) == .expired {
                upcomingDay(snapshot, after: day.date)
              }
            } else {
              missingSchedule
            }
            if let snapshot = store.snapshot, !snapshot.cachedDays.isEmpty {
              NavigationLink(value: WatchRoute.schedule(WatchCalendar.dateKey(context.date))) {
                Label("Розклад", systemImage: "list.bullet")
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
              .buttonStyle(.bordered)
            }
            syncFooter
          }
          .padding(.horizontal, 8)
          .padding(.bottom, 12)
        }
      }
      .navigationTitle(store.snapshot?.profileName ?? "Дзвінка")
      .navigationDestination(for: WatchRoute.self) { route in
        switch route {
          case .schedule(let date): WatchScheduleView(store: store, initialDate: date)
        }
      }
    }
    .tint(.mint)
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { store.refreshAutomatically() }
    }
  }

  @ViewBuilder
  private func currentCard(day: WatchDay, date: Date) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      switch WatchSchedule.state(for: day.lessons, at: date) {
        case .empty:
          Label("Сьогодні вільно", systemImage: "sun.max")
            .font(.headline).foregroundStyle(.mint)
          Text("У розкладі немає уроків")
            .font(.caption).foregroundStyle(.secondary)
        case .expired:
          Label("На сьогодні все", systemImage: "checkmark.circle")
            .font(.headline).foregroundStyle(.mint)
          Text("Усі заняття закінчилися")
            .font(.caption).foregroundStyle(.secondary)
        case .before(let lesson):
          statusLabel("До початку", lesson: lesson)
          countdown(until: lesson.start, date: date, caption: "до початку", deadlineLabel: "Початок о")
          lessonDescription(lesson)
        case .breakTime(let lesson):
          statusLabel("Перерва", lesson: lesson)
          countdown(until: lesson.start, date: date, caption: "до початку", deadlineLabel: "Початок о")
          lessonDescription(lesson)
        case .lesson(let lesson):
          statusLabel("Зараз", lesson: lesson)
          countdown(until: lesson.end, date: date, caption: lesson.isClub ? "до кінця" : "до дзвінка", deadlineLabel: "До")
          lessonDescription(lesson)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(.quaternary, in: RoundedRectangle(cornerRadius: 16))
  }

  private func statusLabel(_ title: String, lesson: WatchLesson) -> some View {
    Text("\(title) · \(lesson.isClub ? "гурток" : "\(lesson.n) урок")")
      .font(.caption2.weight(.semibold)).foregroundStyle(.mint)
  }

  private func lessonDescription(_ lesson: WatchLesson) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(lesson.title)
        .font(.headline)
        .fixedSize(horizontal: false, vertical: true)
      Text(WatchDisplay.lessonTime(lesson))
        .font(.caption2).monospacedDigit().foregroundStyle(.secondary)
      if !lesson.room.isEmpty {
        Label("Каб. \(lesson.room)", systemImage: "door.left.hand.open")
          .font(.caption2).fixedSize(horizontal: false, vertical: true)
      }
    }
  }

  private func nextCard(_ lesson: WatchLesson) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text("Далі · \(WatchDisplay.clock(lesson.start))")
        .font(.caption2.weight(.semibold)).foregroundStyle(.mint)
      Text(lesson.title).font(.headline)
        .fixedSize(horizontal: false, vertical: true)
      if !lesson.room.isEmpty {
        Text("Каб. \(lesson.room)").font(.caption2).foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 4)
  }

  @ViewBuilder
  private func upcomingDay(_ snapshot: WatchSnapshot, after date: String) -> some View {
    if let day = snapshot.cachedDays.first(where: { $0.date > date && !$0.lessons.isEmpty }),
      let first = day.lessons.first {
      NavigationLink(value: WatchRoute.schedule(day.date)) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Найближчий навчальний день")
            .font(.caption2).foregroundStyle(.secondary)
          Text("\(day.dayName) · \(WatchDisplay.clock(first.start))")
            .font(.headline).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .buttonStyle(.plain)
    }
  }

  private var missingSchedule: some View {
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: "calendar.badge.exclamationmark").font(.title2).foregroundStyle(.mint)
      Text(store.snapshot == nil ? "Потрібен розклад" : "На сьогодні немає даних")
        .font(.headline)
      Text("Відкрийте Дзвінку на iPhone поруч із годинником")
        .font(.caption).foregroundStyle(.secondary)
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.horizontal, 4)
  }

  private var syncFooter: some View {
    VStack(alignment: .leading, spacing: 8) {
      Button { store.refresh() } label: {
        Label(store.isSyncing ? "Оновлення…" : "Оновити з iPhone", systemImage: "arrow.clockwise")
          .font(.caption).frame(maxWidth: .infinity)
      }
      .disabled(store.isSyncing)
      if !store.syncMessage.isEmpty {
        Text(store.syncMessage).font(.caption2).foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
      if let date = store.snapshot?.updatedAtDate {
        Text("Дані від \(WatchDisplay.syncDate(date))")
          .font(.caption2).foregroundStyle(.secondary)
      }
      Text("Час уроків — київський")
        .font(.caption2).foregroundStyle(.secondary)
    }
  }

  @ViewBuilder
  private func countdown(until minute: Int, date: Date, caption: String, deadlineLabel: String) -> some View {
    HStack(alignment: .center, spacing: 6) {
      if isLuminanceReduced {
        Text("\(deadlineLabel) \(WatchDisplay.clock(minute))")
          .font(.title3.weight(.semibold)).monospacedDigit()
      } else if let end = WatchCalendar.dateTime(on: date, minute: minute), end > date {
        Text(timerInterval: date...end, countsDown: true, showsHours: true)
          .font(.system(.title3, design: .rounded).weight(.bold))
          .monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
          .layoutPriority(1)
        Text(caption).font(.caption2).foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
          .frame(width: 58, alignment: .leading)
      }
    }
    .padding(.top, 2)
  }
}

enum WatchDisplay {
  static func clock(_ minute: Int) -> String { String(format: "%02d:%02d", minute / 60, minute % 60) }

  static func lessonTime(_ lesson: WatchLesson) -> String {
    "\(clock(lesson.start))–\(clock(lesson.end))"
  }

  static func shortDate(_ date: Date) -> String { format(date, "d MMM") }
  static func syncDate(_ date: Date) -> String { format(date, "d MMM, HH:mm") }

  private static func format(_ date: Date, _ pattern: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "uk_UA")
    formatter.timeZone = WatchCalendar.kyiv.timeZone
    formatter.dateFormat = pattern
    return formatter.string(from: date)
  }
}
