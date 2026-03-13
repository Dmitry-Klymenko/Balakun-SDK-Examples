import SwiftUI

struct ConnectionStatusLineView: View {
    let state: DemoConnectionState
    let isBootstrapping: Bool
    let isStreaming: Bool

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(state.tint)
                .frame(width: 9, height: 9)

            Text(state.label)
                .font(.footnote.weight(.semibold))

            if isBootstrapping {
                ProgressView()
                    .controlSize(.small)
            }

            Spacer()

            if isStreaming {
                Text("Receiving response…")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(.vertical, 1)
    }
}

private extension DemoConnectionState {
    var tint: Color {
        switch self {
        case .online:
            return .green
        case .reconnecting:
            return .orange
        case .offline:
            return .red
        }
    }
}

#Preview("Online") {
    ConnectionStatusLineView(state: .online, isBootstrapping: false, isStreaming: false)
        .padding()
}

#Preview("Reconnecting") {
    ConnectionStatusLineView(state: .reconnecting, isBootstrapping: true, isStreaming: false)
        .padding()
}

#Preview("Streaming") {
    ConnectionStatusLineView(state: .online, isBootstrapping: false, isStreaming: true)
        .padding()
}
