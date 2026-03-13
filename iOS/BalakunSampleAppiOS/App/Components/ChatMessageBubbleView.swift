import SwiftUI

struct ChatMessageBubbleView: View {
    private enum Layout {
        static let sideInset: CGFloat = 28
        static let horizontalPadding: CGFloat = 12
        static let verticalPadding: CGFloat = 9
        static let cornerRadius: CGFloat = 14
    }

    let message: DemoMessage

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let isUser = message.role == .user

        HStack {
            if isUser {
                Spacer(minLength: Layout.sideInset)
            }

            Text(message.text)
                .font(.body)
                .foregroundStyle(isUser ? Color.white : .primary)
                .padding(.horizontal, Layout.horizontalPadding)
                .padding(.vertical, Layout.verticalPadding)
                .background(
                    isUser ? Color.accentColor : BalakunTheme.assistantBubble(for: colorScheme),
                    in: RoundedRectangle(cornerRadius: Layout.cornerRadius, style: .continuous)
                )
                .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(isUser ? "User message" : "Assistant message")
                .accessibilityValue(message.text)

            if !isUser {
                Spacer(minLength: Layout.sideInset)
            }
        }
    }
}

#Preview("User Message") {
    ChatMessageBubbleView(message: DemoMessage(role: .user, text: "Show me available plans."))
        .padding()
}

#Preview("Assistant Message") {
    ChatMessageBubbleView(
        message: DemoMessage(role: .assistant, text: "Here are the available plans and pricing details.")
    )
    .padding()
}
