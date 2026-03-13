import SwiftUI

enum BalakunTheme {
    static let cornerRadius: CGFloat = 20
    static let sectionSpacing: CGFloat = 12
    static let sectionPadding: CGFloat = 12
    static let maxContentWidth: CGFloat = 760

    static func backgroundGradient(for colorScheme: ColorScheme) -> LinearGradient {
        if colorScheme == .dark {
            return LinearGradient(
                colors: [
                    Color(red: 0.10, green: 0.10, blue: 0.12),
                    Color(red: 0.08, green: 0.09, blue: 0.11)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        return LinearGradient(
            colors: [
                Color(red: 0.97, green: 0.98, blue: 1.0),
                Color(red: 0.94, green: 0.95, blue: 0.98),
                Color(red: 0.92, green: 0.94, blue: 0.97)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    static func assistantBubble(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color.white.opacity(0.12) : Color(red: 0.93, green: 0.94, blue: 0.97)
    }

}

private struct BalakunCardModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: BalakunTheme.cornerRadius, style: .continuous)
                    .fill(colorScheme == .dark ? Color.white.opacity(0.08) : Color.white.opacity(0.84))
            )
            .overlay(
                RoundedRectangle(cornerRadius: BalakunTheme.cornerRadius, style: .continuous)
                    .stroke(colorScheme == .dark ? Color.white.opacity(0.14) : Color.black.opacity(0.05), lineWidth: 1)
            )
            .shadow(
                color: colorScheme == .dark ? Color.black.opacity(0.22) : Color.black.opacity(0.06),
                radius: 10,
                y: 4
            )
    }
}

extension View {
    func balakunCard() -> some View {
        modifier(BalakunCardModifier())
    }
}
