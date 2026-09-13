import Foundation
import WebKit

/// Віддає зібраний веб-застосунок із пакета за адресами `dzvinka://localhost/…`.
///
/// ЧОМУ НЕ `file://`. У WKWebView сторінка з `file://` не має сталого
/// походження: `localStorage` там або недоступний, або живе окремо для
/// кожного файла й може зникнути. А в `localStorage` у нас усе, що людина
/// налаштувала, — профілі, нотатки, домашка. Тому власна схема: у неї є
/// звичайне походження, і збережене лишається собою між запусками.
///
/// Схема навмисно не `http`/`https`: такі WKWebView перехоплювати не дає.
enum LocalAssets {
  static let scheme = "dzvinka"
  static let host = "localhost"
  static var origin: URL { URL(string: "\(scheme)://\(host)/")! }

  /// Тека з `index.html` усередині пакета застосунку.
  static var root: URL? { Bundle.main.url(forResource: "Web", withExtension: nil) }
}

final class LocalAssetHandler: NSObject, WKURLSchemeHandler {
  /// Типи, які реально трапляються у збірці Vite. Невідоме віддаємо
  /// двійковим — краще, ніж вгадати неправильно й зламати розбір.
  private static let types: [String: String] = [
    "html": "text/html; charset=utf-8",
    "js": "text/javascript; charset=utf-8",
    "mjs": "text/javascript; charset=utf-8",
    "css": "text/css; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "webmanifest": "application/manifest+json; charset=utf-8",
    "svg": "image/svg+xml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "ico": "image/x-icon",
    "woff2": "font/woff2",
    "woff": "font/woff",
    "ttf": "font/ttf",
    "txt": "text/plain; charset=utf-8",
    "pdf": "application/pdf",
  ]

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url, let root = LocalAssets.root else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }

    guard let file = resolve(url: url, root: root) else {
      // Глибоких посилань у застосунку немає, тож невідома адреса — це
      // помилка збірки, а не маршрут SPA. Мовчки підсовувати index.html
      // означало б ховати її до першого білого екрана.
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }

    do {
      let data = try Data(contentsOf: file)
      let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
      let response = HTTPURLResponse(
        url: url,
        statusCode: 200,
        httpVersion: "HTTP/1.1",
        headerFields: [
          "Content-Type": type,
          "Content-Length": String(data.count),
          // Файли лежать у пакеті й міняються лише з версією застосунку.
          "Cache-Control": "no-cache",
        ]
      )!
      task.didReceive(response)
      task.didReceive(data)
      task.didFinish()
    } catch {
      task.didFailWithError(error)
    }
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
    // Файли читаються синхронно й миттєво — скасовувати нема чого.
  }

  /// Адреса → файл у пакеті. `nil`, якщо файла немає або адреса
  /// намагається вибратись за межі теки.
  private func resolve(url: URL, root: URL) -> URL? {
    var path = url.path
    if path.isEmpty || path == "/" { path = "/index.html" }

    let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
    let base = root.standardizedFileURL

    // `..` у адресі не має виводити за межі пакета.
    guard file.path == base.path || file.path.hasPrefix(base.path + "/") else { return nil }
    guard FileManager.default.fileExists(atPath: file.path) else { return nil }
    return file
  }
}
