import SwiftUI

/// Рідна оболонка «Дзвінки».
///
/// Увесь застосунок — той самий веб-застосунок, що й на сайті, зібраний
/// у теку `ios/Web` і запакований усередину. Він не тягнеться з мережі:
/// відкрився — і працює, хоч у літаку, хоч у підвалі.
///
/// Оболонка робить те, чого веб сам не вміє: віддає файли з пакета під
/// сталим походженням (див. `LocalAssets`), відкриває зовнішні посилання
/// в Safari, повідомляє вебу, що він усередині застосунку, тримає тло під
/// статусбаром у колір теми, ставить сповіщення, годує віджети й
/// годинник — і стежить за повітряною тривогою тоді, коли застосунок
/// закритий і веб мовчить.
@main
struct DzvinkaApp: App {
  @Environment(\.scenePhase) private var scenePhase

  init() {
    WatchSync.shared.activate()
    // Реєструвати фонову задачу можна лише до кінця запуску застосунку —
    // пізніше система просто не знає такого ідентифікатора.
    Alerts.shared.register()
    // Те саме й про делегата сповіщень: поставлений пізніше, він не
    // почує те, що прийшло дорогою.
    NotificationPresenter.shared.install()
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        // Веб малює власне тло від краю до краю; SwiftUI під ним не потрібен.
        .ignoresSafeArea()
        .statusBarHidden(false)
        // Файл `.dzvinka` з AirDrop, «Файлів» чи повідомлення.
        .onOpenURL { OpenFile.handle($0) }
    }
    .onChange(of: scenePhase) { _, phase in
      switch phase {
        case .active:
          Alerts.shared.startWatching()
        case .background:
          // Поки застосунок на екрані, ми питаємо самі; згорнули —
          // просимо систему будити нас, коли вона зможе.
          Alerts.shared.stopWatching()
          Alerts.shared.scheduleBackground()
        default:
          break
      }
    }
  }
}

private struct RootView: View {
  var body: some View {
    WebHost()
      .background(Color(.sRGB, red: 0.949, green: 0.953, blue: 0.965, opacity: 1))
  }
}
