import Foundation
import OSLog
import UIKit

/// Розклад, який прийшов файлом.
///
/// НАВІЩО. Поділитися налаштованим розкладом можна двома шляхами:
/// посиланням (його розбирає сам веб, бо вантаж лежить у частині адреси
/// після `#`) і файлом `.dzvinka` — через AirDrop, повідомлення або
/// «Файли». Другий шлях і потрібен цьому класу: систему цікавить не
/// сторінка, а застосунок, який уміє відкрити такий файл.
///
/// ЩО РОБИМО. Читаємо файл, перевіряємо, що це схоже на наш вантаж, і
/// віддаємо його вебу — розбирає й показує все одно він
/// (`src/lib/share.ts`). Дублювати тут перевірки означало б завести
/// другу правду про формат.
enum OpenFile {
  private static let log = OSLog(subsystem: "app.dzvinka", category: "open")

  /// Більший файл — це не розклад, а щось інше з тим самим суфіксом.
  private static let maxBytes = 256 * 1024

  static func handle(_ url: URL) {
    guard url.isFileURL else { return }

    // Файл прилітає в пісочницю застосунку, але доступ до нього треба
    // відкрити явно — інакше читання мовчки поверне порожнечу.
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }

    guard
      let data = try? Data(contentsOf: url),
      data.count <= maxBytes,
      let text = String(data: data, encoding: .utf8)
    else {
      os_log("не прочитався %{public}@", log: log, type: .error, url.lastPathComponent)
      return
    }

    // Веб чекає той самий base64url, що й у посиланні, — так обидва
    // шляхи сходяться в одному місці.
    deliver(base64url(of: text))
  }

  private static func base64url(of text: String) -> String {
    Data(text.utf8)
      .base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  /**
   * Передати вебу. Якщо сторінка ще не готова — чекаємо й пробуємо
   * знову: застосунок цілком міг щойно запуститися саме через цей файл,
   * і тоді на момент відкриття малювати ще нема чого.
   */
  private static func deliver(_ code: String, attempt: Int = 0) {
    guard let view = WebHost.current else {
      if attempt < 20 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
          deliver(code, attempt: attempt + 1)
        }
      }
      return
    }

    let escaped = code.replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "'", with: "\\'")
    view.evaluateJavaScript("window.__dzvinkaImport && window.__dzvinkaImport('\(escaped)')") { _, error in
      // Сторінка могла ще не встигнути повісити обробник — пробуємо ще.
      if error != nil, attempt < 20 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
          deliver(code, attempt: attempt + 1)
        }
      }
    }
  }
}
