import SwiftUI

struct ChatTimelinePanelView: View {
    let messages: [DemoMessage]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if messages.isEmpty {
                    ChatTimelineEmptyStateView()
                } else {
                    ForEach(messages) { message in
                        ChatMessageBubbleView(message: message)
                            .id(message.id)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
        }
        .scrollIndicators(.hidden)
        .frame(maxWidth: .infinity)
        .frame(minHeight: 360)
        .balakunCard()
    }
}

private struct ChatTimelineEmptyStateView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.title2)
                .foregroundStyle(.secondary)
                .padding(10)
                .background(.thinMaterial, in: Circle())

            Text("Start a conversation")
                .font(.headline)

            Text("Ask a question to get started.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 260)
        .padding(.vertical, 24)
    }
}

#Preview("Empty Timeline") {
    ChatTimelinePanelView(messages: [])
        .padding()
}

#Preview("Conversation Timeline") {
    ChatTimelinePanelView(
        messages: [
            DemoMessage(role: .user, text: "Hi"),
            DemoMessage(role: .assistant, text: "Hello. How can I help today?")
        ]
    )
    .padding()
}
