import Foundation
import OSLog
import WatchConnectivity

final class WatchSync: NSObject, WCSessionDelegate {
  static let shared = WatchSync()

  private let log = OSLog(subsystem: "app.dzvinka", category: "watch")

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func sendLatest() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated,
      session.isPaired,
      session.isWatchAppInstalled,
      let data = SharedStore.defaults?.data(forKey: SharedStore.widgetSnapshotKey)
    else { return }

    do {
      try session.updateApplicationContext(["snapshot": data])
    } catch {
      os_log("watch sync error %{public}@", log: log, type: .error, error.localizedDescription)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else { return }
    DispatchQueue.main.async { self.sendLatest() }
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.sendLatest() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard message["request"] as? String == "snapshot",
      let data = SharedStore.defaults?.data(forKey: SharedStore.widgetSnapshotKey)
    else {
      replyHandler(["available": false])
      return
    }
    replyHandler(["snapshot": data])
  }
}
