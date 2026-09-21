import SwiftUI

@main
struct DzvinkaWatchApp: App {
  @StateObject private var store = WatchStore()

  var body: some Scene {
    WindowGroup {
      #if DEBUG && targetEnvironment(simulator)
      if let date = ProcessInfo.processInfo.environment["DZVINKA_PREVIEW_DAY"] {
        NavigationStack {
          WatchScheduleView(store: store, initialDate: date)
        }
      } else {
        WatchHome(store: store)
      }
      #else
      WatchHome(store: store)
      #endif
    }
  }
}
