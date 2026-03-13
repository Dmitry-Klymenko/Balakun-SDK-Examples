import Foundation
import BalakunMobileSDK
#if canImport(AVFoundation)
import AVFoundation
#endif

final class SimpleTTSService {
    func speakTag(_ payload: BalakunTagEvent) -> Bool {
        guard payload.tag.caseInsensitiveCompare("speak") == .orderedSame,
              let content = payload.content?.trimmingCharacters(in: .whitespacesAndNewlines),
              !content.isEmpty else {
            return false
        }
        speakText(content)
        return true
    }

    func speakResponse(_ rawResponse: String) -> Bool {
        guard rawResponse.range(of: "<speak", options: [.caseInsensitive]) != nil else {
            return false
        }

        let parsed = BalakunVoiceTagParser.parseMessageContent(
            rawResponse,
            audioTagProcessingEnabled: true
        )
        let textToSpeak = parsed.displayMarkdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !textToSpeak.isEmpty else {
            return false
        }

        speakText(textToSpeak)
        return true
    }

    private func speakText(_ text: String) {
        #if canImport(AVFoundation)
        SpeechDispatcher.shared.speak(text)
#endif
        SimpleAppLogger.log(text, category: .tts)
    }
}

#if canImport(AVFoundation)
private final class SpeechDispatcher: @unchecked Sendable {
    static let shared = SpeechDispatcher()

    private var speechSynthesizer: AVSpeechSynthesizer?

    private init() {}

    func speak(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let synthesizer = self.speechSynthesizer ?? AVSpeechSynthesizer()
            self.speechSynthesizer = synthesizer

            synthesizer.stopSpeaking(at: .immediate)

            let utterance = AVSpeechUtterance(string: text)
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate
            synthesizer.speak(utterance)
        }
    }
}
#endif
