import UserNotifications

/// Що робити зі сповіщенням, коли застосунок саме відкритий.
///
/// ЧОМУ ЦЕ ВЗАГАЛІ ПОТРІБНО. За замовчуванням iOS не показує власні
/// сповіщення застосунку, поки той на екрані: вважається, що застосунок
/// і так усе покаже сам. Для нагадування про урок це правда — розклад
/// перед очима. Для повітряної тривоги — ні: людина може дивитись у
/// вівторок наступного тижня й не побачити, що почалась тривога. Без
/// цього класу банер у такий момент не з'явився б узагалі.
///
/// Заодно це єдиний спосіб перевірити сповіщення, не чекаючи справжньої
/// тривоги: перемкнули область на ту, де зараз гуде, — і банер прилетів
/// одразу, не згортаючи застосунок.
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NotificationPresenter()

  /// Ставити делегата треба до кінця запуску — пізніше система вже не
  /// спитає його про сповіщення, які прийшли дорогою.
  func install() {
    UNUserNotificationCenter.current().delegate = self
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if notification.request.identifier.hasPrefix(Alerts.notificationPrefix) {
      completionHandler([.banner, .sound, .list])
      return
    }

    // Нагадування про урок поверх розкладу, який людина саме читає, —
    // це банер про те, що вже на екрані. Лишаємо його в центрі
    // сповіщень: там воно знадобиться, поверх екрана — ні.
    completionHandler([.list])
  }
}
