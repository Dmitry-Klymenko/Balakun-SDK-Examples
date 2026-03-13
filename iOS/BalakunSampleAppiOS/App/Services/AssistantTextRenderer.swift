import Foundation
import BalakunMobileSDK

enum AssistantTextRenderer {
    private static let decoder = JSONDecoder()

    struct Result {
        let text: String
        let products: BalakunProductsEvent?
    }

    static func parse(_ input: String) -> Result {
        let output = collect(from: input)
        let parsed = BalakunVoiceTagParser.parseMessageContent(
            output.text,
            audioTagProcessingEnabled: true
        )

        return Result(
            text: parsed.displayMarkdown.trimmingCharacters(in: .whitespacesAndNewlines),
            products: output.products
        )
    }

    private static func collect(from input: String) -> Result {
        let lines = input.components(separatedBy: .newlines)
        var visibleLines: [String] = []
        var products: BalakunProductsEvent?
        var index = 0

        while index < lines.count {
            if let block = readProducts(in: lines, from: index) {
                products = products ?? block.payload
                index = block.nextIndex
                continue
            }

            visibleLines.append(lines[index])
            index += 1
        }

        return Result(
            text: visibleLines.joined(separator: "\n"),
            products: products
        )
    }

    private static func readProducts(in lines: [String], from index: Int) -> Block? {
        let eventLine = lines[index].normalized
        if eventLine == "event: products" || eventLine == "event: present_product" {
            let block = readEventPayload(in: lines, from: index)
            return Block(
                nextIndex: block.nextIndex,
                payload: decodeProducts(from: block.payloadText)
            )
        }

        return readJSONProducts(in: lines, from: index, inlineData: nil)
    }

    private static func readEventPayload(in lines: [String], from index: Int) -> EventPayload {
        var payloadLines: [String] = []
        var cursor = index + 1
        var sawPayload = false

        while cursor < lines.count {
            let line = lines[cursor]
            let trimmed = line.trimmed
            let normalized = trimmed.lowercased()

            if trimmed.isEmpty {
                cursor += 1
                break
            }

            if normalized == "data:" {
                sawPayload = true
                cursor += 1
                continue
            }

            if normalized.hasPrefix("data:") {
                sawPayload = true
                payloadLines.append(String(line.droppingDataPrefix()).trimmed)
                cursor += 1
                continue
            }

            if normalized.hasPrefix("event:") {
                break
            }

            if !sawPayload, trimmed.first != "{" {
                return EventPayload(nextIndex: index + 1, payloadText: "")
            }

            sawPayload = true
            payloadLines.append(line)
            cursor += 1
        }

        return EventPayload(
            nextIndex: cursor,
            payloadText: payloadLines.joined(separator: "\n").trimmed
        )
    }

    private static func readJSONProducts(
        in lines: [String],
        from index: Int,
        inlineData: String?
    ) -> Block? {
        if let inlineData, let payload = decodeProducts(from: inlineData) {
            return Block(nextIndex: index, payload: payload)
        }

        guard index < lines.count else {
            return Block(nextIndex: lines.count, payload: nil)
        }

        guard let nextIndex = jsonBlockEnd(in: lines, from: index) else {
            let remainder = lines[index...].joined(separator: "\n").trimmed
            return looksLikeProductsJSON(remainder)
                ? Block(nextIndex: lines.count, payload: nil)
                : nil
        }

        guard let payload = decodeProducts(from: lines[index..<nextIndex].joined(separator: "\n")) else {
            return nil
        }
        return Block(nextIndex: nextIndex, payload: payload)
    }

    private static func jsonBlockEnd(in lines: [String], from index: Int) -> Int? {
        guard index < lines.count else {
            return nil
        }

        var collected: [String] = []

        for cursor in index..<lines.count {
            collected.append(lines[cursor])
            let candidate = collected.joined(separator: "\n").trimmed

            guard candidate.first == "{" else {
                return nil
            }

            if parsePayload(from: candidate) != nil {
                return cursor + 1
            }
        }

        return nil
    }

    private static func decodeProducts(from raw: String) -> BalakunProductsEvent? {
        guard let payload = parsePayload(from: raw), isProductsPayload(payload),
              let normalized = try? JSONSerialization.data(withJSONObject: payload) else {
            return nil
        }

        return try? decoder.decode(BalakunProductsEvent.self, from: normalized)
    }

    private static func parsePayload(from raw: String) -> [String: Any]? {
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return (object["data"] as? [String: Any]) ?? object
    }

    private static func isProductsPayload(_ payload: [String: Any]) -> Bool {
        let action = (payload["action"] as? String)?.normalized
        return action == "products" || action == "present_product" || payload["items"] != nil || payload["products"] != nil
    }

    private static func looksLikeProductsJSON(_ raw: String) -> Bool {
        let normalized = raw.normalized
        guard normalized.first == "{" else {
            return false
        }

        return normalized.contains("\"action\":\"products\"") ||
            normalized.contains("\"action\": \"products\"") ||
            normalized.contains("\"action\":\"present_product\"") ||
            normalized.contains("\"action\": \"present_product\"") ||
            normalized.contains("\"items\":") ||
            normalized.contains("\"products\":")
    }
}

private struct Block {
    let nextIndex: Int
    let payload: BalakunProductsEvent?
}

private struct EventPayload {
    let nextIndex: Int
    let payloadText: String
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var normalized: String {
        trimmed.lowercased()
    }

    func droppingDataPrefix() -> Substring {
        dropFirst(5)
    }
}
