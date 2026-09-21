import Foundation
import Combine
import OSLog
import WatchConnectivity

@MainActor
final class WatchStore: NSObject, ObservableObject {
  @Published private(set) var snapshot: WatchSnapshot?
  @Published private(set) var lastSynced: Date?
  @Published private(set) var syncMessage = ""
  @Published private(set) var isSyncing = false

  private let snapshotKey = "watchSnapshot"
  private let syncedKey = "watchSnapshotSyncedAt"
  private let decoder = JSONDecoder()
  private let log = Logger(subsystem: "app.dzvinka.schedule.watchkitapp", category: "sync")
  private var lastData: Data?
  private var requestID: UUID?
  private var lastRequest: Date?

  override init() {
    super.init()
    loadPersisted()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func refresh() {
    requestSnapshot(automatically: false)
  }

  func refreshAutomatically() {
    requestSnapshot(automatically: true)
  }

  private func requestSnapshot(automatically: Bool) {
    guard requestID == nil, WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      if !automatically { syncMessage = "Підключення до iPhone…" }
      return
    }
    guard session.isReachable else {
      if !automatically { syncMessage = "Відкрийте Дзвінку на iPhone поруч із годинником" }
      return
    }
    if automatically, let lastRequest, Date().timeIntervalSince(lastRequest) < 15 { return }

    let id = UUID()
    requestID = id
    lastRequest = Date()
    isSyncing = true
    syncMessage = "Оновлюємо розклад…"
    session.sendMessage(["request": "snapshot"], replyHandler: { [weak self] reply in
      let data = reply["snapshot"] as? Data
      Task { @MainActor in
        guard let self, self.finishRequest(id) else { return }
        if let data { self.consume(data) }
        else { self.syncMessage = "Спочатку відкрийте Дзвінку на iPhone" }
      }
    }, errorHandler: { [weak self] error in
      let code = (error as NSError).code
      Task { @MainActor in
        guard let self, self.finishRequest(id) else { return }
        self.log.error("Snapshot request failed: \(code)")
        self.syncMessage = "Не вдалося з’єднатися з iPhone. Спробуйте ще раз"
      }
    })
    DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
      guard let self, self.finishRequest(id) else { return }
      self.syncMessage = "iPhone не відповів. Спробуйте ще раз"
    }
  }

  private func finishRequest(_ id: UUID) -> Bool {
    guard requestID == id else { return false }
    requestID = nil
    isSyncing = false
    return true
  }

  private func loadPersisted() {
    let defaults = UserDefaults.standard
    guard let data = defaults.data(forKey: snapshotKey),
      let decoded = try? decoder.decode(WatchSnapshot.self, from: data)
    else { return }
    snapshot = decoded
    lastData = data
    lastSynced = defaults.object(forKey: syncedKey) as? Date
  }

  private func consume(_ data: Data) {
    if data == lastData {
      syncMessage = "Розклад актуальний"
      return
    }
    do {
      let decoded = try decoder.decode(WatchSnapshot.self, from: data)
      if let current = snapshot?.updatedAtDate, let incoming = decoded.updatedAtDate, incoming < current {
        log.debug("Ignored an older snapshot")
        syncMessage = "Збережено новіший розклад"
        return
      }
      snapshot = decoded
      lastData = data
      lastSynced = Date()
      UserDefaults.standard.set(data, forKey: snapshotKey)
      UserDefaults.standard.set(lastSynced, forKey: syncedKey)
      syncMessage = "Розклад оновлено"
    } catch {
      log.error("Could not decode schedule: \(String(describing: error), privacy: .private)")
      syncMessage = "Не вдалося прочитати розклад. Оновіть його з iPhone"
    }
  }
}

extension WatchStore: WCSessionDelegate {
  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    let data = session.receivedApplicationContext["snapshot"] as? Data
    let activated = activationState == .activated && error == nil
    Task { @MainActor [weak self] in
      guard let self else { return }
      guard activated else {
        self.syncMessage = "Не вдалося підключитися до iPhone"
        return
      }
      if let data { self.consume(data) }
      self.refreshAutomatically()
    }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    Task { @MainActor [weak self] in self?.refreshAutomatically() }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    guard let data = applicationContext["snapshot"] as? Data else { return }
    Task { @MainActor [weak self] in self?.consume(data) }
  }
}
