import OSLog
import StoreKit
import UIKit
import WebKit

/// Вікно «оцініть застосунок».
///
/// Коли саме питати, вирішує веб (`src/lib/review.ts`): він знає,
/// скільки днів застосунком користуються і чи закінчився вже навчальний
/// день. Оболонці лишається знайти активну сцену й попросити систему.
///
/// Показати вікно ми не можемо — тільки попросити. iOS вирішує сама й
/// показує його не частіше трьох разів на рік; дізнатись, показала вона
/// його чи ні, не можна навмисне, щоб на цьому не будували воронок.
final class Review: NSObject, WKScriptMessageHandler {
  static let channel = "review"

  private let log = OSLog(subsystem: "app.dzvinka", category: "review")

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard message.body as? String == "ask" else { return }

    guard
      let scene = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive })
    else {
      os_log("no active scene", log: log, type: .info)
      return
    }

    if #available(iOS 18.0, *) {
      AppStore.requestReview(in: scene)
    } else {
      SKStoreReviewController.requestReview(in: scene)
    }
    os_log("review requested", log: log, type: .info)
  }
}
