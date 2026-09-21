import Foundation
import OSLog
import WebKit
import WidgetKit

/// Передає виджетам короткий знімок дня, уже зібраний веб-застосунком.
final class Widgets: NSObject, WKScriptMessageHandler {
  static let channel = "widgets"

  private let log = OSLog(subsystem: "app.dzvinka", category: "widgets")

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      let body = message.body as? [String: Any],
      body["type"] as? String == "snapshot",
      JSONSerialization.isValidJSONObject(body)
    else { return }

    do {
      let data = try JSONSerialization.data(withJSONObject: body)
      SharedStore.defaults?.set(data, forKey: SharedStore.widgetSnapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
      WatchSync.shared.sendLatest()
      os_log("widget snapshot synced", log: log, type: .info)
    } catch {
      os_log("widget snapshot error %{public}@", log: log, type: .error, error.localizedDescription)
    }
  }
}
