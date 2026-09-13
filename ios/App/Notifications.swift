import Foundation
import OSLog
import UserNotifications
import WebKit

/// Локальні сповіщення, які планує веб-застосунок.
///
/// Розклад, гуртки й домашка вже зібрані у вебі з урахуванням профілів,
/// груп і парності тижнів. Нативна оболонка тут лише просить дозвіл
/// iOS і ставить календарні тригери.
final class Notifications: NSObject, WKScriptMessageHandler {
  static let channel = "notifications"

  private let center = UNUserNotificationCenter.current()
  private let prefix = "dzvinka:"
  private let log = OSLog(subsystem: "app.dzvinka", category: "notifications")

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      let body = message.body as? [String: Any],
      body["type"] as? String == "sync"
    else { return }

    let items = (body["items"] as? [[String: Any]] ?? []).compactMap(NotificationItem.init)
    sync(items)
  }

  private func sync(_ items: [NotificationItem]) {
    if items.isEmpty {
      center.getPendingNotificationRequests { requests in
        let ids = requests.map(\.identifier).filter { $0.hasPrefix(self.prefix) }
        self.center.removePendingNotificationRequests(withIdentifiers: ids)
      }
      return
    }

    center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, error in
      guard let self else { return }

      if let error {
        os_log("authorization error %{public}@", log: self.log, type: .error, error.localizedDescription)
        return
      }
      guard granted else {
        os_log("authorization denied", log: self.log, type: .info)
        return
      }

      self.replacePending(with: items)
    }
  }

  private func replacePending(with items: [NotificationItem]) {
    center.getPendingNotificationRequests { [weak self] requests in
      guard let self else { return }

      let oldIds = requests.map(\.identifier).filter { $0.hasPrefix(self.prefix) }
      self.center.removePendingNotificationRequests(withIdentifiers: oldIds)

      for item in items {
        let content = UNMutableNotificationContent()
        content.title = item.title
        content.body = item.body
        content.sound = .default

        var date = DateComponents()
        date.calendar = Calendar(identifier: .gregorian)
        date.timeZone = TimeZone(identifier: "Europe/Kyiv")
        date.year = item.year
        date.month = item.month
        date.day = item.day
        date.hour = item.hour
        date.minute = item.minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: false)
        let request = UNNotificationRequest(
          identifier: self.prefix + item.id,
          content: content,
          trigger: trigger
        )

        self.center.add(request) { error in
          if let error {
            os_log("schedule error %{public}@", log: self.log, type: .error, error.localizedDescription)
          }
        }
      }

      os_log("synced %{public}d notifications", log: self.log, type: .info, items.count)
    }
  }
}

private struct NotificationItem {
  let id: String
  let title: String
  let body: String
  let year: Int
  let month: Int
  let day: Int
  let hour: Int
  let minute: Int

  init?(raw: [String: Any]) {
    guard
      let id = raw["id"] as? String,
      let title = raw["title"] as? String,
      let body = raw["body"] as? String,
      let year = raw["year"] as? Int,
      let month = raw["month"] as? Int,
      let day = raw["day"] as? Int,
      let hour = raw["hour"] as? Int,
      let minute = raw["minute"] as? Int,
      (1...12).contains(month),
      (1...31).contains(day),
      (0...23).contains(hour),
      (0...59).contains(minute)
    else { return nil }

    self.id = id
    self.title = title
    self.body = body
    self.year = year
    self.month = month
    self.day = day
    self.hour = hour
    self.minute = minute
  }
}
