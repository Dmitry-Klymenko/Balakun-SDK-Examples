import Foundation

struct SampleAppConfiguration {
    let tenantID: String
    let baseURL: URL
    let parentOrigin: URL
    let parentPagePath: String
    let defaultEmbedToken: String?
    let logRawSSEEvents: Bool
    let logAnalyticsSignals: Bool

    static func load(from bundle: Bundle = .main) -> SampleAppConfiguration {
        let defaults = SampleAppConfiguration(
            tenantID: "demo",
            baseURL: URL(string: "https://balakun.waybeam.ai")!,
            parentOrigin: URL(string: "https://mobile.example.com")!,
            parentPagePath: "/app",
            defaultEmbedToken: nil,
            logRawSSEEvents: false,
            logAnalyticsSignals: false
        )

        let tenantID = infoString("BALAKUN_TENANT_ID", bundle: bundle)?.nonEmpty ?? defaults.tenantID
        let baseURL = resolvedAbsoluteURL(
            forKey: "BALAKUN_BASE_URL",
            bundle: bundle,
            defaults: defaults.baseURL
        )
        let parentOrigin = resolvedAbsoluteURL(
            forKey: "BALAKUN_PARENT_ORIGIN",
            bundle: bundle,
            defaults: defaults.parentOrigin
        )
        let parentPagePath = resolveParentPagePath(bundle: bundle, defaults: defaults.parentPagePath)
        let defaultEmbedToken = infoString("BALAKUN_EMBED_TOKEN", bundle: bundle)?.nonEmpty
        let logRawSSEEvents = infoBool("BALAKUN_LOG_RAW_SSE_EVENTS", bundle: bundle, fallback: defaults.logRawSSEEvents)
        let logAnalyticsSignals = infoBool(
            "BALAKUN_LOG_ANALYTICS_SIGNALS",
            bundle: bundle,
            fallback: defaults.logAnalyticsSignals
        )

        return SampleAppConfiguration(
            tenantID: tenantID,
            baseURL: baseURL,
            parentOrigin: parentOrigin,
            parentPagePath: parentPagePath,
            defaultEmbedToken: defaultEmbedToken,
            logRawSSEEvents: logRawSSEEvents,
            logAnalyticsSignals: logAnalyticsSignals
        )
    }

    private static func resolveParentPagePath(bundle: Bundle, defaults: String) -> String {
        if let path = infoString("BALAKUN_PARENT_PAGE_PATH", bundle: bundle)?.nonEmpty {
            return normalizePath(path, defaults: defaults)
        }
        if let urlString = infoString("BALAKUN_PARENT_PAGE_URL", bundle: bundle)?.nonEmpty,
           let url = URL(string: urlString) {
            return normalizePath(url.path, defaults: defaults)
        }
        return normalizePath(defaults, defaults: defaults)
    }

    private static func normalizePath(_ value: String, defaults: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return defaults
        }

        var path = trimmed
        if !path.hasPrefix("/") {
            path = "/" + path
        }
        path = path.replacingOccurrences(of: "/{2,}", with: "/", options: .regularExpression)
        if path.count > 1 {
            path = path.replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        }
        return path
    }

    private static func infoString(_ key: String, bundle: Bundle) -> String? {
        guard let raw = bundle.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func infoBool(_ key: String, bundle: Bundle, fallback: Bool) -> Bool {
        guard let rawValue = infoString(key, bundle: bundle)?.lowercased() else {
            return fallback
        }

        switch rawValue {
        case "1", "true", "yes", "y", "on":
            return true
        case "0", "false", "no", "n", "off":
            return false
        default:
            return fallback
        }
    }

    private static func resolvedAbsoluteURL(forKey: String, bundle: Bundle, defaults: URL) -> URL {
        guard
            let rawValue = infoString(forKey, bundle: bundle),
            let parsed = URL(string: rawValue),
            let components = URLComponents(url: parsed, resolvingAgainstBaseURL: false),
            let scheme = components.scheme,
            !scheme.isEmpty,
            let host = components.host,
            !host.isEmpty
        else {
            return defaults
        }
        return parsed
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
