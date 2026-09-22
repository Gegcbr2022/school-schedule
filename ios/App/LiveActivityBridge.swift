import Foundation
import WebKit

/// Місток до живої активності.
///
/// Веб уже знає, який урок іде, скільки до дзвінка і чий це розклад —
/// рахувати це вдруге на Swift означало б завести другу правду. Тому
/// сюди приходить готовий стан, а оболонка лише кладе його в
/// `ActivityKit`.
final class LiveActivityBridge: NSObject, WKScriptMessageHandler {
  static let channel = "live"

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      let body = message.body as? [String: Any],
      body["type"] as? String == "live"
    else { return }

    guard body["active"] as? Bool == true else {
      LiveActivityController.shared.hide()
      return
    }

    let state = DzvinkaActivity.ContentState(
      headline: body["headline"] as? String ?? "",
      subject: body["subject"] as? String ?? "",
      room: body["room"] as? String ?? "",
      next: body["next"] as? String ?? "",
      deadline: Self.date(body["deadline"]),
      since: Self.date(body["since"]),
      // Тривога живе окремо: її стан веде `Alerts`, і перетирати його
      // тим, що знає веб, не можна — у фоні веб мовчить, а тривога є.
      alert: AlertLevel.none,
      alertNote: "",
      profileName: body["profileName"] as? String ?? ""
    )

    LiveActivityController.shared.show(state: state, staleDate: Self.date(body["staleAfter"]))
  }

  /// Час приходить мілісекундами від епохи — так його бачить JavaScript.
  private static func date(_ raw: Any?) -> Date? {
    guard let ms = raw as? Double, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
  }
}
