import os
import UIKit
import WebKit

/// Тактильна відповідь на дотик.
///
/// Веб сам такого не вміє: `navigator.vibrate` на iOS немає, та й це не те —
/// то вібромотор на весь телефон, а не Taptic Engine. Різниця відчутна:
/// правильний відгук на перемиканні дня — це коротке «клац» під пальцем,
/// від якого застосунок відчувається справжнім, а не сторінкою.
///
/// Веб шле сюди одне слово, більше нічого не знаючи про UIKit.
final class Haptics: NSObject, WKScriptMessageHandler {
  static let channel = "haptics"

  /// Генератори тримаємо живими: на щойно створеному перший відгук
  /// запізнюється, бо Taptic Engine доводиться будити.
  private let selection = UISelectionFeedbackGenerator()
  private let light = UIImpactFeedbackGenerator(style: .light)
  private let notice = UINotificationFeedbackGenerator()

  override init() {
    super.init()
    selection.prepare()
    light.prepare()
    notice.prepare()
  }

  func userContentController(
    _ controller: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard let kind = message.body as? String else { return }
    #if DEBUG
      // Симулятор Taptic Engine не має, тож переконатись, що місток
      // узагалі працює, можна лише так:
      //   xcrun simctl spawn booted log stream --predicate 'subsystem == "app.dzvinka"'
      os_log("haptic %{public}@", log: OSLog(subsystem: "app.dzvinka", category: "haptics"), type: .info, kind)
    #endif

    switch kind {
    // Вибір змінився: інший день, інша група, інший профіль. Найчастіший
    // і найтихіший відгук — саме він і робить перемикачі «залізними».
    case "selection":
      selection.selectionChanged()
      selection.prepare()

    // Щось відкрилось або закрилось.
    case "light":
      light.impactOccurred()
      light.prepare()

    // Записали домашку, зберегли нотатку.
    case "success":
      notice.notificationOccurred(.success)
      notice.prepare()

    // Прибрали гурток, видалили профіль.
    case "warning":
      notice.notificationOccurred(.warning)
      notice.prepare()

    default:
      break
    }
  }
}
