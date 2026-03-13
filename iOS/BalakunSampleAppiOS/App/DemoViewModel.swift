import Foundation
import BalakunMobileSDK

@MainActor
final class DemoViewModel: ObservableObject {
    private static let productsText = "Product suggestions"

    @Published var userInput: String = ""
    @Published var timeline: [DemoMessage] = []
    @Published var connectionState: DemoConnectionState = .offline
    @Published var lastError: String?
    @Published var isStreaming: Bool = false
    @Published var isBootstrapping: Bool = false
    @Published var scrollAnchorID: UUID?
    @Published var latestProducts: BalakunProductsEvent?

    var isConnected: Bool { connectionState == .online }

    private let appConfig: SampleAppConfiguration
    private let sessionStore: BalakunUserDefaultsSessionStore
    private let embedToken: String
    private let ttsService: SimpleTTSService

    private var client: BalakunClient?
    private var didAttemptInitialBootstrap = false
    private var assistantResponseBuffer = ""
    private var didSpeak = false

    init(
        appConfig: SampleAppConfiguration = .load(),
        ttsService: SimpleTTSService = .init()
    ) {
        self.appConfig = appConfig
        embedToken = appConfig.defaultEmbedToken?.trimmed ?? ""
        sessionStore = BalakunUserDefaultsSessionStore(
            keyPrefix: "balakun.sample.ios.\(appConfig.tenantID)"
        )
        self.ttsService = ttsService
    }

    func start() async {
        guard !didAttemptInitialBootstrap else { return }
        didAttemptInitialBootstrap = true
        await connect()
    }

    func send() async {
        let query = userInput.trimmed
        guard !query.isEmpty, !isStreaming else {
            return
        }

        if !isConnected && !isBootstrapping {
            await connect()
        }

        guard let activeClient = client, isConnected else {
            return
        }

        let assistantID = startTurn(with: query)
        defer { isStreaming = false }

        let stream = await activeClient.sendMessage(query, context: runtimeContext())

        do {
            for try await event in stream {
                apply(event, assistantID: assistantID)
            }
            finishTurn(assistantID: assistantID)
            logResponse(isPartial: false)
        } catch {
            lastError = streamError(error)
            disconnect()
            finishTurn(assistantID: assistantID)
            logResponse(isPartial: true)
        }
    }

    private func connect() async {
        guard !isBootstrapping else {
            return
        }

        guard !embedToken.isEmpty else {
            disconnect()
            lastError = "Missing embed token in LocalSecrets.xcconfig"
            return
        }

        isBootstrapping = true
        connectionState = .reconnecting
        lastError = nil
        defer { isBootstrapping = false }

        let sdkClient = makeClient(embedToken: embedToken)

        do {
            _ = try await sdkClient.bootstrap()
            client = sdkClient
            connectionState = .online
        } catch {
            disconnect()
            lastError = bootstrapError(error)
        }
    }

    private func makeClient(embedToken: String) -> BalakunClient {
        let configuration = BalakunSDKConfiguration(
            baseURL: appConfig.baseURL,
            tenantID: appConfig.tenantID,
            parentOrigin: appConfig.parentOrigin,
            defaultParentPath: appConfig.parentPagePath,
            embedTokenProvider: { embedToken },
            analyticsHandler: { [logAnalytics = appConfig.logAnalyticsSignals] signal in
                guard logAnalytics else { return }
                SimpleAppLogger.analytics(signal)
            },
            sessionStore: sessionStore
        )

        return BalakunClient(configuration: configuration)
    }

    private func startTurn(with query: String) -> UUID {
        userInput = ""
        lastError = nil
        isStreaming = true
        assistantResponseBuffer = ""
        didSpeak = false
        latestProducts = nil

        timeline.append(DemoMessage(role: .user, text: query))
        let assistantID = UUID()
        timeline.append(DemoMessage(id: assistantID, role: .assistant, text: ""))
        scrollAnchorID = assistantID
        SimpleAppLogger.log("query=\(query)", category: .chat)
        return assistantID
    }

    private func apply(_ event: BalakunStreamEvent, assistantID: UUID) {
        if appConfig.logRawSSEEvents {
            SimpleAppLogger.stream(event)
        }

        switch event {
        case .answerDelta(let payload) where !payload.content.isEmpty:
            assistantResponseBuffer += payload.content
            updateAssistantMessage(assistantID: assistantID)

        case .answerDelta:
            return

        case .products(let payload):
            showProducts(payload)
            updateAssistantMessage(
                assistantID: assistantID,
                emptyText: Self.productsText
            )

        case .logEvent(let payload):
            logEvent(payload)

        case .tag(let payload):
            if ttsService.speakTag(payload) {
                didSpeak = true
            }

        case .done:
            finishTurn(assistantID: assistantID)

        case .error(let payload):
            lastError = payload.error

        default:
            return
        }
    }

    private func finishTurn(assistantID: UUID) {
        if !didSpeak {
            didSpeak = ttsService.speakResponse(assistantResponseBuffer)
        }

        updateAssistantMessage(
            assistantID: assistantID,
            emptyText: latestProducts == nil ? nil : Self.productsText
        )
    }

    private func updateAssistantMessage(assistantID: UUID, emptyText: String? = nil) {
        let output = AssistantTextRenderer.parse(assistantResponseBuffer)
        if let products = output.products {
            showProducts(products)
        }
        let text = output.text.isEmpty ? (emptyText ?? "") : output.text

        guard let index = timeline.firstIndex(where: { $0.id == assistantID }) else {
            return
        }

        timeline[index].text = text
        scrollAnchorID = assistantID
    }

    private func showProducts(_ payload: BalakunProductsEvent) {
        guard latestProducts != payload else { return }
        latestProducts = payload
        SimpleAppLogger.log(
            "action=\(payload.action) items=\(payload.items.count)\n\(payload.items)",
            category: .products
        )
    }

    private func logEvent(_ payload: BalakunLogEvent) {
        let properties = payload.properties.map(String.init(describing:)) ?? "{}"
        SimpleAppLogger.log(
            "name=\(payload.eventName) severity=\(payload.severity ?? "n/a") properties=\(properties)",
            category: .stream
        )
    }

    private func runtimeContext() -> BalakunRuntimeContext {
        BalakunRuntimeContext(
            screenName: "chat",
            pagePath: appConfig.parentPagePath,
            pageTitle: "Balakun Sample App",
            locale: Locale.current.identifier,
            device: {
                #if os(macOS)
                "macos"
                #else
                "ios"
                #endif
            }(),
            activeSection: "chat"
        )
    }

    private func bootstrapError(_ error: Error) -> String {
        if case let BalakunSDKError.httpError(status, body) = error {
            let bodyText = (body ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return bodyText.isEmpty ? "HTTP \(status)" : "HTTP \(status): \(bodyText)"
        }
        return error.localizedDescription
    }

    private func streamError(_ error: Error) -> String {
        error is CancellationError ? "Stream canceled" : error.localizedDescription
    }

    private func logResponse(isPartial: Bool) {
        let response = AssistantTextRenderer.parse(assistantResponseBuffer).text.trimmed
        guard !response.isEmpty else {
            return
        }
        let prefix = isPartial ? "response.partial" : "response"
        SimpleAppLogger.log("\(prefix): \(response)", category: .chat)
    }

    private func disconnect() {
        connectionState = .offline
        client = nil
        latestProducts = nil
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

#if DEBUG
extension DemoViewModel {
    static var conversationPreview: DemoViewModel {
        preview(
            connectionState: .online,
            timeline: [
                DemoMessage(role: .user, text: "Hi"),
                DemoMessage(role: .assistant, text: "Hello! What can I do for you today?")
            ]
        )
    }

    static var offlinePreview: DemoViewModel {
        preview(
            connectionState: .offline,
            lastError: "Network unavailable"
        )
    }

    private static func preview(
        connectionState: DemoConnectionState,
        timeline: [DemoMessage] = [],
        lastError: String? = nil
    ) -> DemoViewModel {
        let viewModel = DemoViewModel()
        viewModel.connectionState = connectionState
        viewModel.timeline = timeline
        viewModel.lastError = lastError
        return viewModel
    }
}
#endif
