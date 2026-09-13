import SwiftUI
import WebKit

/// WKWebView із застосунком усередині.
struct WebHost: UIViewRepresentable {
  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    config.setURLSchemeHandler(LocalAssetHandler(), forURLScheme: LocalAssets.scheme)
    // Відео-підказок у застосунку немає, але якщо колись будуть — хай
    // не вилітають на весь екран посеред розкладу.
    config.allowsInlineMediaPlayback = true

    // Веб має знати, що він у застосунку: тоді він не пропонує «додати на
    // початковий екран» і не чіпає service worker — оновлення тут приходять
    // із App Store, а розклад підтягується паком (див. lib/packUpdate.ts).
    let flag = WKUserScript(
      source: "window.__native = { platform: 'ios' };",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    config.userContentController.addUserScript(flag)
    config.userContentController.add(context.coordinator.haptics, name: Haptics.channel)
    config.userContentController.add(context.coordinator.notifications, name: Notifications.channel)

    let view = WKWebView(frame: .zero, configuration: config)
    view.navigationDelegate = context.coordinator
    view.uiDelegate = context.coordinator
    view.allowsBackForwardNavigationGestures = false
    // Сторінка сама керує прокруткою; гумовий відскок цілої сторінки
    // в застосунку виглядає як помилка.
    view.scrollView.bounces = false
    view.scrollView.contentInsetAdjustmentBehavior = .never
    view.isOpaque = false
    view.backgroundColor = .clear
    view.scrollView.backgroundColor = .clear

    view.load(URLRequest(url: LocalAssets.origin.appendingPathComponent("index.html")))

    // Внутрішня вʼю зʼявляється не одразу після створення WKWebView, тож
    // чіпляємось після того, як UIKit добудує ієрархію.
    DispatchQueue.main.async { KeyboardBar.hide(in: view) }

    return view
  }

  func updateUIView(_ view: WKWebView, context: Context) {}

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    let haptics = Haptics()
    let notifications = Notifications()

    /// Усе, що не наш застосунок, відкриваємо системою: підручники з
    /// хмари, телефони вчителів, пошта. Усередині вікна їм не місце —
    /// звідти немає ані «назад», ані рядка адреси.
    func webView(
      _ webView: WKWebView,
      decidePolicyFor action: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let url = action.request.url else {
        decisionHandler(.cancel)
        return
      }
      if url.scheme == LocalAssets.scheme {
        decisionHandler(.allow)
        return
      }
      decisionHandler(.cancel)
      if UIApplication.shared.canOpenURL(url) {
        UIApplication.shared.open(url)
      }
    }

    /*
     * Діалоги JavaScript.
     *
     * WKWebView не показує `alert`/`confirm` сам: якщо UI-делегат їх не
     * реалізує, панель просто не з'являється, а `confirm()` миттєво
     * повертає `false`. У браузері на цьому тримається підтвердження
     * видалення гуртка й профілю — тобто без цих трьох методів кнопки
     * «прибрати» в застосунку мовчки нічого не робили б.
     */
    private func topController(_ webView: WKWebView) -> UIViewController? {
      var responder: UIResponder? = webView
      while let next = responder?.next {
        if let controller = next as? UIViewController { return controller }
        responder = next
      }
      return nil
    }

    private func present(_ alert: UIAlertController, from webView: WKWebView, fallback: () -> Void) {
      guard let controller = topController(webView) else {
        fallback()
        return
      }
      controller.present(alert, animated: true)
    }

    func webView(
      _ webView: WKWebView,
      runJavaScriptAlertPanelWithMessage message: String,
      initiatedByFrame frame: WKFrameInfo,
      completionHandler: @escaping () -> Void
    ) {
      let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Гаразд", style: .default) { _ in completionHandler() })
      present(alert, from: webView, fallback: completionHandler)
    }

    func webView(
      _ webView: WKWebView,
      runJavaScriptConfirmPanelWithMessage message: String,
      initiatedByFrame frame: WKFrameInfo,
      completionHandler: @escaping (Bool) -> Void
    ) {
      let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Скасувати", style: .cancel) { _ in completionHandler(false) })
      // Підтверджують тут завжди видалення, тож і кнопка червона.
      alert.addAction(UIAlertAction(title: "Прибрати", style: .destructive) { _ in completionHandler(true) })
      present(alert, from: webView) { completionHandler(false) }
    }

    func webView(
      _ webView: WKWebView,
      runJavaScriptTextInputPanelWithPrompt prompt: String,
      defaultText: String?,
      initiatedByFrame frame: WKFrameInfo,
      completionHandler: @escaping (String?) -> Void
    ) {
      let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
      alert.addTextField { $0.text = defaultText }
      alert.addAction(UIAlertAction(title: "Скасувати", style: .cancel) { _ in completionHandler(nil) })
      alert.addAction(UIAlertAction(title: "Гаразд", style: .default) { _ in
        completionHandler(alert.textFields?.first?.text)
      })
      present(alert, from: webView) { completionHandler(nil) }
    }

    /// `target="_blank"` не створює вікна — віддаємо системі.
    func webView(
      _ webView: WKWebView,
      createWebViewWith configuration: WKWebViewConfiguration,
      for action: WKNavigationAction,
      windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
      if let url = action.request.url, UIApplication.shared.canOpenURL(url) {
        UIApplication.shared.open(url)
      }
      return nil
    }
  }
}
