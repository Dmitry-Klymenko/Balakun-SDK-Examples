import SwiftUI

struct ContentView: View {
    @ObservedObject var viewModel: DemoViewModel

    @Environment(\.colorScheme) private var colorScheme
    @State private var showErrorAlert = false

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ZStack {
                    BalakunTheme.backgroundGradient(for: colorScheme)
                        .ignoresSafeArea()

                    mainContent
                    .frame(maxWidth: BalakunTheme.maxContentWidth, maxHeight: .infinity, alignment: .top)
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 10)
                }
                .onChange(of: viewModel.scrollAnchorID) { target in
                    guard let target else {
                        return
                    }
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(target, anchor: .bottom)
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                ChatComposerBarView(
                    text: $viewModel.userInput,
                    isBusy: isBusy,
                    isSendDisabled: sendDisabled,
                    connectionState: viewModel.connectionState,
                    isBootstrapping: viewModel.isBootstrapping,
                    isStreaming: viewModel.isStreaming,
                    onSend: {
                        Task {
                            await viewModel.send()
                        }
                    }
                )
                .background(.ultraThinMaterial)
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .alert("Error", isPresented: $showErrorAlert, presenting: viewModel.lastError) { _ in
                Button("OK", role: .cancel) { }
            } message: { errorText in
                Text(errorText)
            }
            .onChange(of: viewModel.lastError) { showErrorAlert = $0 != nil }
            .task {
                await viewModel.start()
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        VStack(spacing: BalakunTheme.sectionSpacing) {
            header
            ChatTimelinePanelView(messages: viewModel.timeline)

            if let products = viewModel.latestProducts {
                ProductSuggestionsPanelView(event: products)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Balakun")
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.8)
                .lineLimit(1)

            Text("Sample chat")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    private var sendDisabled: Bool {
        viewModel.userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy
    }

    private var isBusy: Bool {
        viewModel.isStreaming || viewModel.isBootstrapping
    }
}

#Preview("Conversation") {
    ContentView(viewModel: .conversationPreview)
}

#Preview("Offline") {
    ContentView(viewModel: .offlinePreview)
}
