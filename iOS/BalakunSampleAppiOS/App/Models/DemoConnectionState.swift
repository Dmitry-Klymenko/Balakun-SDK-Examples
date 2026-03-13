import Foundation

enum DemoConnectionState: String {
    case online
    case reconnecting
    case offline

    var label: String {
        switch self {
        case .online:
            return "Online"
        case .reconnecting:
            return "Reconnecting…"
        case .offline:
            return "Offline"
        }
    }
}
