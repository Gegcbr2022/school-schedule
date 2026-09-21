// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "DzvinkaWatchModel",
  platforms: [.macOS(.v13)],
  products: [.library(name: "DzvinkaWatchModel", targets: ["DzvinkaWatchModel"])],
  targets: [
    .target(
      name: "DzvinkaWatchModel",
      path: "Watch",
      exclude: ["DzvinkaWatchApp.swift", "WatchHome.swift", "WatchScheduleView.swift", "WatchStore.swift", "Assets.xcassets"],
      sources: ["WatchSnapshot.swift"]
    ),
    .testTarget(
      name: "DzvinkaWatchModelTests",
      dependencies: ["DzvinkaWatchModel"],
      path: "WatchModelTests"
    ),
  ]
)
