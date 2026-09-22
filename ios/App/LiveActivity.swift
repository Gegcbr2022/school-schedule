import ActivityKit
import Foundation
import OSLog

/// Жива активність: поточний урок на екрані блокування й у динамічному
/// острові.
///
/// ЧОМУ ТАК МАЛО КОДУ. Відлік малює система: у стані лежить не «12 хв», а
/// момент кінця уроку, і `Text(timerInterval:)` у віджеті рахує сам.
/// Тому активність не треба оновлювати щохвилини — досить чіпати її на
/// межі уроку, тобто кілька разів на день. Саме через це вона й не з'їдає
/// батарею.
///
/// ХТО ЇЇ ЧІПАЄ. Веб — коли застосунок відкритий (`src/lib/live.ts`), і
/// `Alerts`, коли міняється стан тривоги. Тривога головніша за урок: поки
/// вона триває, на екрані блокування має бути вона.
///
/// ЧОГО ВОНА НЕ ВМІЄ. Запуститись сама, коли застосунок закритий. Для
/// цього потрібні push-to-start токени, тобто сервер, — а його тут немає.
/// Активність з'являється тоді, коли застосунок відкрили, і зникає після
/// останнього уроку.
final class LiveActivityController {
  static let shared = LiveActivityController()

  private let log = OSLog(subsystem: "app.dzvinka", category: "live")

  private init() {}

  /**
   * Стан тривоги — у спільному сховищі, а не в пам'яті.
   *
   * Застосунок-оболонку iOS присипляє й вивантажує охоче, а тривога
   * триває годинами. Якби це число жило в пам'яті, то після
   * вивантаження перший же урок, який приїхав від вебу, стер би тривогу
   * з екрана блокування — саме тоді, коли на нього й дивляться.
   */
  private var alert: (level: Int, note: String) {
    get {
      (
        SharedStore.defaults?.integer(forKey: SharedStore.alertLevelKey) ?? AlertLevel.none,
        SharedStore.defaults?.string(forKey: SharedStore.alertNoteKey) ?? ""
      )
    }
    set {
      SharedStore.defaults?.set(newValue.level, forKey: SharedStore.alertLevelKey)
      SharedStore.defaults?.set(newValue.note, forKey: SharedStore.alertNoteKey)
    }
  }

  private var current: Activity<DzvinkaActivity>? {
    Activity<DzvinkaActivity>.activities.first
  }

  /// Чи дозволила система показувати живі активності.
  var allowed: Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  /// Стан тривоги окремо: він приходить не від вебу, а від `Alerts`,
  /// і мусить пережити будь-яке оновлення уроку.
  ///
  /// Якщо активності ще немає — тривога піднімає її сама. Саме цей
  /// випадок і найважливіший: у вихідний чи ввечері застосунок сьогодні
  /// не відкривали, уроку немає, а тривога є, і бачити її треба на
  /// екрані блокування, а не в списку сповіщень.
  func setAlert(level: Int, note: String, show: Bool = true) {
    alert = (level, note)

    guard let activity = current else {
      if show, level > AlertLevel.none { startAlertOnly(level: level, note: note) }
      return
    }

    var state = activity.content.state
    state.alert = show ? level : AlertLevel.none
    state.alertNote = show ? note : ""

    // Тривога скінчилась, а уроку під нею не було — активності більше
    // немає про що бути.
    if level == AlertLevel.none, state.subject.isEmpty, state.deadline == nil {
      hide()
      return
    }

    push(state, staleDate: activity.content.staleDate)
  }

  private func startAlertOnly(level: Int, note: String) {
    guard allowed else { return }
    do {
      _ = try Activity.request(
        attributes: DzvinkaActivity(),
        content: ActivityContent(
          state: DzvinkaActivity.ContentState(
            headline: AlertLevel.title(level),
            subject: "",
            room: "",
            next: "",
            deadline: nil,
            since: Date(),
            alert: level,
            alertNote: note,
            profileName: ""
          ),
          // Тривога довша за чотири години — це вже не та тривога, про
          // яку ми щось знаємо; хай система пригасить картку сама.
          staleDate: Date(timeIntervalSinceNow: 4 * 60 * 60)
        ),
        pushType: nil
      )
    } catch {
      os_log("alert activity error %{public}@", log: log, type: .error, error.localizedDescription)
    }
  }

  /// Показати або оновити активність.
  ///
  /// `staleDate` — момент, після якого те, що написано, перестає бути
  /// правдою: система пригасить активність сама, навіть якщо застосунок
  /// більше не запускали.
  func show(state: DzvinkaActivity.ContentState, staleDate: Date?) {
    guard allowed else { return }

    var merged = state
    let ongoing = alert
    merged.alert = ongoing.level
    merged.alertNote = ongoing.note

    if current != nil {
      push(merged, staleDate: staleDate)
      return
    }

    do {
      _ = try Activity.request(
        attributes: DzvinkaActivity(),
        content: ActivityContent(state: merged, staleDate: staleDate),
        pushType: nil
      )
      os_log("live activity started", log: log, type: .info)
    } catch {
      os_log("live activity error %{public}@", log: log, type: .error, error.localizedDescription)
    }
  }

  /// Прибрати активність — уроки закінчились або її вимкнули.
  func hide() {
    for activity in Activity<DzvinkaActivity>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }

  private func push(_ state: DzvinkaActivity.ContentState, staleDate: Date?) {
    guard let activity = current else { return }
    Task {
      await activity.update(ActivityContent(state: state, staleDate: staleDate))
    }
  }
}
