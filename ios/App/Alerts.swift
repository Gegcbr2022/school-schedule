import BackgroundTasks
import Foundation
import OSLog
import UserNotifications
import WebKit

/// Повітряна тривога: стежити, сповіщати, підказати, на який урок
/// повертатись.
///
/// ЧОМУ ЦЕ ТУТ, А НЕ У ВЕБІ. Веб уміє питати стан, поки застосунок
/// відкритий, — і саме це він і робить (`src/lib/alerts.ts`). Але
/// тривога починається тоді, коли на телефон ніхто не дивиться, а
/// присплений WKWebView нічого не питає. Тому у фоні цим займається
/// оболонка: вона єдина, кому iOS може дати час, коли застосунок
/// закритий.
///
/// ЧЕСНО ПРО ФОН. `BGAppRefreshTask` — це прохання, а не таймер. Скільки
/// разів на годину система його виконає, вирішує вона сама, зважаючи на
/// батарею, мережу й те, як часто застосунок відкривають. Тому це
/// підстраховка, а не сирена: застосунок не має підміняти офіційне
/// оповіщення й ніде цього не обіцяє.
///
/// НА ЯКИЙ УРОК ПОВЕРТАТИСЬ. Уроки вже лежать у знімку для віджетів
/// (App Group), тож рахувати їх удруге не треба. Правило одне: перший
/// урок, який **починається пізніше** за відбій. Відбій посеред третього
/// уроку означає четвертий, відбій на перерві — той, що зараз почнеться.
final class Alerts {
  static let shared = Alerts()

  /// Ідентифікатор фонової задачі; той самий має бути в `Info.plist`.
  static let taskId = "app.dzvinka.alerts"

  /// Власний префікс сповіщень: той, що в `Notifications`, щоразу
  /// зчищається під час синхронізації розкладу, і нагадування про
  /// повернення до класу зникало б разом із ним.
  ///
  /// За ним же `NotificationPresenter` відрізняє тривогу від нагадування
  /// про урок — показувати їх однаково не можна.
  static let notificationPrefix = "dzvinka-alert:"
  private let prefix = Alerts.notificationPrefix

  private let log = OSLog(subsystem: "app.dzvinka", category: "alerts")
  private let center = UNUserNotificationCenter.current()
  private let defaults = SharedStore.defaults

  private var timer: Timer?

  private init() {}

  // MARK: - Налаштування

  private struct Settings {
    var enabled = false
    var url = ""
    var region = ""
    var onStart = true
    var onEnd = true
    var backToClass = true
    /// Показувати тривогу живою активністю.
    var live = true

    var workable: Bool { enabled && !url.isEmpty && !region.isEmpty }
  }

  private var settings: Settings {
    get {
      guard
        let data = defaults?.data(forKey: SharedStore.alertSettingsKey),
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else { return Settings() }

      return Settings(
        enabled: raw["enabled"] as? Bool ?? false,
        url: raw["url"] as? String ?? "",
        region: raw["region"] as? String ?? "",
        onStart: raw["onStart"] as? Bool ?? true,
        onEnd: raw["onEnd"] as? Bool ?? true,
        backToClass: raw["backToClass"] as? Bool ?? true,
        live: raw["live"] as? Bool ?? true
      )
    }
  }

  func store(settings raw: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(raw),
          let data = try? JSONSerialization.data(withJSONObject: raw)
    else { return }
    defaults?.set(data, forKey: SharedStore.alertSettingsKey)
    // Вимкнули — прибираємо тривогу з екрана блокування одразу, а не
    // тоді, коли вона закінчиться десь там.
    if !settings.workable {
      LiveActivityController.shared.setAlert(level: AlertLevel.none, note: "")
      stopWatching()
      return
    }

    // Дозвіл питаємо саме тут: нагадування про уроки людина могла й не
    // вмикати, а тривогу ввімкнула — і без дозволу вона не пролунала б
    // жодного разу, мовчки.
    center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    startWatching()
  }

  /// Останній відомий рівень — щоб побачити саме зміну, а не стан.
  /// Пише його `LiveActivityController`: сховище одне, правда одна.
  private var lastLevel: Int {
    defaults?.integer(forKey: SharedStore.alertLevelKey) ?? AlertLevel.none
  }

  // MARK: - Життєвий цикл

  func register() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskId, using: nil) { task in
      guard let task = task as? BGAppRefreshTask else { return }
      self.handle(task)
    }
  }

  /// Застосунок на екрані — питаємо самі, раз на хвилину.
  func startWatching() {
    guard settings.workable else { return }
    stopWatching()
    check()
    let timer = Timer(timeInterval: 60, repeats: true) { [weak self] _ in self?.check() }
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
  }

  func stopWatching() {
    timer?.invalidate()
    timer = nil
  }

  /// Застосунок згорнули — просимо систему розбудити нас, коли зможе.
  func scheduleBackground() {
    guard settings.workable else { return }
    let request = BGAppRefreshTaskRequest(identifier: Self.taskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      os_log("bg submit failed %{public}@", log: log, type: .info, error.localizedDescription)
    }
  }

  private func handle(_ task: BGAppRefreshTask) {
    // Наступне прохання ставимо одразу: задача виконується раз, і без
    // цього рядка вона б виконалась саме один раз за весь час життя.
    scheduleBackground()

    let work = Task {
      await fetchAndReact()
      task.setTaskCompleted(success: true)
    }
    task.expirationHandler = { work.cancel() }
  }

  private func check() {
    Task { await fetchAndReact() }
  }

  // MARK: - Опитування

  private func fetchAndReact() async {
    let settings = self.settings
    guard settings.workable, let url = URL(string: settings.url) else { return }

    var request = URLRequest(url: url)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.timeoutInterval = 15

    guard
      let (data, response) = try? await URLSession.shared.data(for: request),
      (response as? HTTPURLResponse)?.statusCode == 200,
      let feed = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      feed["v"] as? Int == 1
    else { return }

    let regions = feed["regions"] as? [String: Any] ?? [:]
    let entry = regions[settings.region] as? [String: Any]
    // Рівня може не бути: поле нове, а тривога — стара. Тоді це звичайна
    // повітряна тривога, і мовчати про неї не можна.
    let level = entry == nil ? AlertLevel.none : (entry?["level"] as? Int ?? AlertLevel.yellow)
    // Більшість тривог оголошують по районах. Сказати «тривога в області»,
    // коли гуде в одному районі, — привчити не вірити застосунку.
    let where_ = entry?["scope"] as? String == "part" ? entry?["where"] as? String : nil

    await react(to: level, place: where_, settings: settings)
  }

  @MainActor
  private func react(to level: Int, place: String?, settings: Settings) {
    let was = lastLevel
    guard level != was else { return }

    // Жива активність тривоги вмикається окремо від уроку: урок там
    // показують заради зручності, а тривогу — заради безпеки. Але
    // записати новий рівень треба в будь-якому разі — саме по ньому ми
    // й бачимо зміну наступного разу.
    LiveActivityController.shared.setAlert(
      level: level,
      note: level > 0 ? detail(level, place) : "",
      show: settings.live
    )

    if level > was {
      // І початок тривоги, і підвищення рівня — однаково подія: жовтий,
      // що став червоним, означає, що в укриття треба вже всім.
      guard settings.onStart else { return }
      notify(
        id: "start:\(level)",
        title: AlertLevel.title(level),
        body: detail(level, place)
      )
      return
    }

    if level == AlertLevel.none {
      if settings.onEnd || settings.backToClass { announceAllClear(settings) }
      return
    }

    // Червоний змінився на жовтий — загроза лишилась, але вже інша.
    if settings.onStart {
      notify(id: "down:\(level)", title: AlertLevel.title(level), body: detail(level, place))
    }
  }

  /// «Ракетна небезпека — в укриття · Калуський район». Район дописуємо
  /// лише тоді, коли тривога справді не по всій області.
  private func detail(_ level: Int, _ place: String?) -> String {
    guard let place, !place.isEmpty else { return AlertLevel.detail(level) }
    return "\(AlertLevel.detail(level)) · \(place)"
  }

  // MARK: - Відбій

  private func announceAllClear(_ settings: Settings) {
    let next = nextLesson()

    if settings.onEnd {
      let body: String
      if let next {
        body = "Повертаємось на \(next.n) урок о \(Self.time(next.start)) — \(next.title)"
      } else {
        body = "Уроків сьогодні вже немає"
      }
      notify(id: "end", title: "Відбій тривоги", body: body)
    }

    guard settings.backToClass, let next else { return }

    // Нагадування «час на урок» має сенс лише тоді, коли до уроку ще є
    // час. Якщо він починається за три хвилини, про це щойно сказали.
    let lead = 3
    guard let when = Self.date(minute: next.start - lead), when.timeIntervalSinceNow > 120 else {
      return
    }

    let room = next.room.isEmpty ? "" : " · каб. \(next.room)"
    notify(
      id: "back",
      title: "Час на урок",
      body: "\(next.n) урок — \(next.title)\(room), о \(Self.time(next.start))",
      at: when
    )
  }

  // MARK: - Уроки зі знімка

  private struct Lesson {
    let n: Int
    let start: Int
    let title: String
    let room: String
  }

  /**
   * Перший урок, який починається пізніше за цю хвилину.
   *
   * Гуртки пропускаємо: з укриття повертаються на уроки, а секція — це
   * вже не школа.
   */
  private func nextLesson(after minute: Int = Alerts.minuteNow()) -> Lesson? {
    guard
      let data = defaults?.data(forKey: SharedStore.widgetSnapshotKey),
      let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }

    // Знімок пишеться, коли застосунок відкритий, тож його «сьогодні»
    // може виявитись учорашнім. Але в ньому лежить і тиждень уперед —
    // звідти й беремо потрібний день. Без цього відбій наступного ранку
    // впевнено повідомляв би, що уроків уже немає.
    let today = Self.todayKey()
    let rows: [[String: Any]]
    if snapshot["date"] as? String == today {
      rows = snapshot["lessons"] as? [[String: Any]] ?? []
    } else if
      let days = snapshot["days"] as? [[String: Any]],
      let day = days.first(where: { $0["date"] as? String == today })
    {
      rows = day["lessons"] as? [[String: Any]] ?? []
    } else {
      return nil
    }

    for row in rows {
      guard
        row["isClub"] as? Bool != true,
        let start = row["start"] as? Int,
        start > minute
      else { continue }
      return Lesson(
        n: row["n"] as? Int ?? 0,
        start: start,
        title: row["title"] as? String ?? "Урок",
        room: row["room"] as? String ?? ""
      )
    }
    return nil
  }

  // MARK: - Сповіщення

  private func notify(id: String, title: String, body: String, at date: Date? = nil) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    // Тривога пробивається крізь «Не турбувати» й режими зосередження —
    // рівно той випадок, заради якого цей рівень і існує.
    content.interruptionLevel = .timeSensitive

    let trigger: UNNotificationTrigger?
    if let date {
      trigger = UNTimeIntervalNotificationTrigger(
        timeInterval: max(1, date.timeIntervalSinceNow),
        repeats: false
      )
    } else {
      trigger = nil
    }

    center.add(
      UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger)
    ) { error in
      if let error {
        os_log("alert notify failed %{public}@", log: self.log, type: .error, error.localizedDescription)
      }
    }
  }

  // MARK: - Київський час

  private static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Kyiv") ?? .current
    return calendar
  }

  private static func minuteNow() -> Int {
    let parts = calendar.dateComponents([.hour, .minute], from: Date())
    return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
  }

  private static func todayKey() -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: Date())
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  private static func date(minute: Int) -> Date? {
    calendar.date(
      bySettingHour: max(0, minute) / 60,
      minute: max(0, minute) % 60,
      second: 0,
      of: Date()
    )
  }

  private static func time(_ minute: Int) -> String {
    String(format: "%02d:%02d", minute / 60, minute % 60)
  }
}

/// Місток: веб каже, за яким регіоном стежити і про що сповіщати.
final class AlertsBridge: NSObject, WKScriptMessageHandler {
  static let channel = "alerts"

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      let body = message.body as? [String: Any],
      body["type"] as? String == "alerts"
    else { return }

    Alerts.shared.store(settings: body)
  }
}
