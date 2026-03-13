import Foundation
import BalakunMobileSDK

enum SimpleAppLogger {
    enum Category: String {
        case app
        case chat
        case stream
        case analytics
        case products
        case tts
    }

    private static let prefix = "[BalakunSampleApp]"

    static func log(_ message: String, category: Category = .app) {
        print("\(prefix) [\(category.rawValue)] \(message)")
    }

    static func stream(_ event: BalakunStreamEvent) {
        log(String(reflecting: event), category: .stream)
    }

    static func analytics(_ signal: BalakunAnalyticsSignal) {
        log("\(signal.event) \(signal.metrics)", category: .analytics)
    }
}
