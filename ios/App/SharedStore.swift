import Foundation

enum SharedStore {
  static let appGroup = "group.app.dzvinka.schedule"
  static let widgetSnapshotKey = "widgetSnapshot"
  /// За чим стежити у фоні: регіон, адреса й перемикачі тривоги.
  static let alertSettingsKey = "alertSettings"
  /// Останній відомий рівень тривоги — щоб бачити зміну, а не стан.
  static let alertLevelKey = "alertLevel"
  /// Підпис до нього: «Ракетна небезпека — в укриття · Калуський район».
  static let alertNoteKey = "alertNote"

  static var defaults: UserDefaults? {
    UserDefaults(suiteName: appGroup)
  }
}
