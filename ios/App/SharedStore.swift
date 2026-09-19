import Foundation

enum SharedStore {
  static let appGroup = "group.app.dzvinka.schedule"
  static let widgetSnapshotKey = "widgetSnapshot"

  static var defaults: UserDefaults? {
    UserDefaults(suiteName: appGroup)
  }
}
