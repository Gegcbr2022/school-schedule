import SwiftUI

/// Рідна оболонка «Дзвінки».
///
/// Увесь застосунок — той самий веб-застосунок, що й на сайті, зібраний
/// у теку `ios/Web` і запакований усередину. Він не тягнеться з мережі:
/// відкрився — і працює, хоч у літаку, хоч у підвалі.
///
/// Оболонка робить рівно чотири речі, яких веб сам не вміє:
/// віддає файли з пакета під сталим походженням (див. `LocalAssets`),
/// відкриває зовнішні посилання в Safari, повідомляє вебу, що він
/// усередині застосунку, і тримає тло під статусбаром у колір теми.
@main
struct DzvinkaApp: App {
  var body: some Scene {
    WindowGroup {
      RootView()
        // Веб малює власне тло від краю до краю; SwiftUI під ним не потрібен.
        .ignoresSafeArea()
        .statusBarHidden(false)
    }
  }
}

private struct RootView: View {
  var body: some View {
    WebHost()
      .background(Color(.sRGB, red: 0.949, green: 0.953, blue: 0.965, opacity: 1))
  }
}
