import ObjectiveC
import UIKit
import WebKit

/*
 * Прибирає панель «↑ ↓ Готово» над клавіатурою.
 *
 * НАВІЩО. Ця панель — річ із Safari: вона потрібна, щоб ходити між полями
 * довгої веб-форми. У нас полів рівно одне на екран, ходити нема куди, —
 * а панель усе одно висить, з'їдає рядок над клавіатурою й одразу видає,
 * що всередині веб. Жоден рідний застосунок такого не показує.
 *
 * ЯК. Публічного способу немає: `inputAccessoryView` належить не
 * WKWebView, а його внутрішньому WKContentView, до якого API не пускає.
 * Тому робимо те саме, що й усі, — підміняємо цей метод на льоту:
 * створюємо підклас WKContentView і перевикликаємо ним уже створену вʼю.
 *
 * ЧОМУ ЦЕ БЕЗПЕЧНО. Якщо Apple колись перейменує внутрішній клас, ми
 * просто нічого не знайдемо й вийдемо: повернеться панель, і більше
 * нічого. Ані впасти, ані зіпсувати щось це не може.
 */
enum KeyboardBar {
  static func hide(in webView: WKWebView) {
    // Прапорця «вже зробили» тут навмисно немає: підміна тримається на
    // конкретному екземплярі вʼю, тож якщо SwiftUI колись перестворить
    // WKWebView, новому теж треба її дати. Повторний виклик дешевий —
    // підклас створюється один раз і далі береться готовим.
    guard let target = contentView(of: webView) else { return }
    guard NSStringFromClass(type(of: target)).hasSuffix(suffix) == false else { return }

    let original: AnyClass = type(of: target)
    let name = "\(NSStringFromClass(original))\(suffix)"

    let subclass: AnyClass
    if let existing = NSClassFromString(name) {
      subclass = existing
    } else {
      guard let created = objc_allocateClassPair(original, name, 0) else { return }
      let selector = #selector(getter: UIResponder.inputAccessoryView)
      // Заміна повертає nil — саме те, що робить панель відсутньою.
      let replacement: @convention(block) (AnyObject) -> UIView? = { _ in nil }
      if let method = class_getInstanceMethod(UIResponder.self, selector) {
        class_addMethod(
          created,
          selector,
          imp_implementationWithBlock(replacement),
          method_getTypeEncoding(method)
        )
      }
      objc_registerClassPair(created)
      subclass = created
    }

    object_setClass(target, subclass)
  }

  private static let suffix = "_NoAccessory"

  /// Внутрішня вʼю, якій насправді належить клавіатура.
  private static func contentView(of webView: WKWebView) -> UIView? {
    webView.scrollView.subviews.first { view in
      NSStringFromClass(type(of: view)).contains("ContentView")
    }
  }
}
