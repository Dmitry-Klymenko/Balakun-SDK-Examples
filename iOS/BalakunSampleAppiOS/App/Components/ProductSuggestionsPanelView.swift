import Foundation
import SwiftUI
import BalakunMobileSDK

struct ProductSuggestionsPanelView: View {
    let event: BalakunProductsEvent

    private var titleText: String {
        event.title?.trimmedNonEmpty ?? "Products"
    }

    private var topItems: [BalakunProductItem] {
        Array(event.items.prefix(5))
    }

    private var subtitleText: String? {
        event.subtitle?.trimmedNonEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titleText)
                .font(.headline)

            if let subtitleText {
                Text(subtitleText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            ForEach(topItems.indices, id: \.self) { index in
                let item = topItems[index]
                HStack(alignment: .top, spacing: 10) {
                    ProductThumbnailView(imageURL: primaryImageURL(for: item))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                        if let url = item.url?.trimmedNonEmpty {
                            Text(url)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        }
        .padding(BalakunTheme.sectionPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .balakunCard()
    }

    private func primaryImageURL(for item: BalakunProductItem) -> URL? {
        (item.images ?? [])
            .lazy
            .compactMap { $0.trimmedNonEmpty }
            .compactMap(URL.init(string:))
            .first
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private struct ProductThumbnailView: View {
    let imageURL: URL?

    var body: some View {
        Group {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 34, height: 34)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.secondary.opacity(0.25), lineWidth: 0.5)
        )
    }

    private var placeholder: some View {
        ZStack {
            Color.secondary.opacity(0.14)
            Image(systemName: "photo")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }
}
