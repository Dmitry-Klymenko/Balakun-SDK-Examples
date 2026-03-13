import Foundation

enum DemoMessageRole: Equatable {
    case user
    case assistant
}

struct DemoMessage: Identifiable {
    let id: UUID
    let role: DemoMessageRole
    var text: String

    init(id: UUID = UUID(), role: DemoMessageRole, text: String) {
        self.id = id
        self.role = role
        self.text = text
    }
}
