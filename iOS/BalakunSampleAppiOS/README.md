# Balakun Sample App (iOS + macOS)

Native SwiftUI sample app demonstrating `BalakunMobileSDK` integration on:
- iPhone and iPad (`TARGETED_DEVICE_FAMILY=1,2`)
- Native macOS app (Apple Silicon compatible)

## Dependency Source

This sample resolves SDK dependency from GitHub via SPM:

- `https://github.com/Dmitry-Klymenko/Balakun-SDK.git`
- branch: `main`

## Get Embed Token

Request access at [waybeam.ai/balakun](https://waybeam.ai/balakun).
After submitting the form, your embed token is provided for integration.

## Configure Token (not committed)

1. `Config/BalakunSDKConfig.xcconfig`
- tracked in git
- shared defaults
- includes local overrides via `#include? "LocalSecrets.xcconfig"`

2. `Config/LocalSecrets.xcconfig`
- not tracked in git
- tenant-specific values and embed token

Create `Config/LocalSecrets.xcconfig` from example:

```bash
cp Config/LocalSecrets.xcconfig.example Config/LocalSecrets.xcconfig
```

Then edit `Config/LocalSecrets.xcconfig`:

```xcconfig
BALAKUN_TENANT_ID = <your-tenant-id>
BALAKUN_PARENT_ORIGIN = https:$(BALAKUN_SLASH)$(BALAKUN_SLASH)<your-parent-origin-host>
BALAKUN_PARENT_PAGE_PATH = /app
BALAKUN_EMBED_TOKEN = <your-embed-token>
BALAKUN_LOG_RAW_SSE_EVENTS = NO
BALAKUN_LOG_ANALYTICS_SIGNALS = NO
```

Important:
- Do not edit `LocalSecrets.xcconfig.example` for runtime use. The app reads `LocalSecrets.xcconfig`.
- In `.xcconfig`, raw `https://...` is parsed incorrectly because `//` starts a comment.

## Logging Behavior

The sample app logs plain-text chat payloads in Xcode console by default:
- outgoing user query: `[BalakunSampleApp] [chat.query] ...`
- final assistant response text: `[BalakunSampleApp] [chat.response] ...`
- partial assistant response on cancel/failure: `[BalakunSampleApp] [chat.response.partial] ...`

To additionally log normalized SSE events as they arrive, enable:

```xcconfig
BALAKUN_LOG_RAW_SSE_EVENTS = YES
```

Raw event lines are printed as:
- `[BalakunSampleApp] [sse.raw] <BalakunStreamEvent debug payload>`

Analytics signal logging is controlled separately:

```xcconfig
BALAKUN_LOG_ANALYTICS_SIGNALS = YES
```

Analytics lines are printed as:
- `[BalakunSampleApp] [analytics] <event + metrics>`

## Runtime Behavior

- The app auto-bootstraps the SDK on first screen appearance.
- There is no manual connect form in UI.
- Connection state is shown under the chat timeline as one line: `Online`, `Offline`, or `Reconnecting…`.
- When offline, sending a message triggers automatic reconnect attempt.

## Project Structure

The sample keeps a small, explicit structure:
- `App/ContentView.swift`: screen composition and wiring.
- `App/DemoViewModel.swift`: SDK bootstrap, stream handling, and UI state.
- `App/Components/*`: focused SwiftUI components (timeline, composer, status).
- `App/Services/*`: parsing/logging/TTS helpers used by the view model.
- `App/Models/*`: lightweight app-specific models.
- `App/SampleAppConfiguration.swift`: runtime config from xcconfig/Info.plist.

## Build

```bash
cd /Volumes/Work/Projects/Balakun-SDK-Examples/iOS/BalakunSampleAppiOS
xcodegen generate
xcodebuild -project BalakunSampleAppiOS.xcodeproj -scheme BalakunSampleAppiOS -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -project BalakunSampleAppiOS.xcodeproj -scheme BalakunSampleAppMac -destination 'platform=macOS,arch=arm64' CODE_SIGNING_ALLOWED=NO build
```

## Troubleshooting: HTTP 403

`403 Forbidden` during startup/bootstrap means backend auth policy rejected the request.
Most common causes:
- `BALAKUN_TENANT_ID` does not match token tenant.
- `BALAKUN_PARENT_ORIGIN` does not match token origin.
- Token was rotated/invalidated on server (or registry enforces a different current token).

The sample app prints diagnostics in Xcode console with prefix:
- `[BalakunSampleApp]`
