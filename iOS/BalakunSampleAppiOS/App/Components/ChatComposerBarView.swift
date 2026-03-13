import SwiftUI

struct ChatComposerBarView: View {
    @Binding var text: String
    let isBusy: Bool
    let isSendDisabled: Bool
    let connectionState: DemoConnectionState
    let isBootstrapping: Bool
    let isStreaming: Bool
    let onSend: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                composerTextField

                Button(action: onSend) {
                    if isBusy {
                        ProgressView()
                            .progressViewStyle(.circular)
                    } else {
                        Text("Send")
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isSendDisabled)
            }

            ConnectionStatusLineView(
                state: connectionState,
                isBootstrapping: isBootstrapping,
                isStreaming: isStreaming
            )
            .padding(.horizontal, 2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var composerTextField: some View {
        TextField("Ask something", text: $text, axis: .vertical)
            .platformComposerAutocorrection()
            .lineLimit(1...4)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(.regularMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .onSubmit(onSend)
    }
}

private extension View {
    @ViewBuilder
    func platformComposerAutocorrection() -> some View {
        #if os(iOS)
        autocorrectionDisabled(false)
        #else
        self
        #endif
    }
}

#Preview("Idle") {
    ChatComposerBarView(
        text: .constant(""),
        isBusy: false,
        isSendDisabled: true,
        connectionState: .online,
        isBootstrapping: false,
        isStreaming: false,
        onSend: {}
    )
    .padding()
}

#Preview("Busy") {
    ChatComposerBarView(
        text: .constant("What can you do?"),
        isBusy: true,
        isSendDisabled: true,
        connectionState: .reconnecting,
        isBootstrapping: true,
        isStreaming: true,
        onSend: {}
    )
    .padding()
}
