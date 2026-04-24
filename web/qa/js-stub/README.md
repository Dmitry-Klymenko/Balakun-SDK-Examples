# Waybeam JS API QA Stub

Browser-only QA helper for validating a host page's Waybeam public JavaScript API integration without loading the real widget.

It installs `window.waybeam` with the same public initialisation pattern required by the protocol:

```js
window.waybeam = window.waybeam || {
  _q: [],
  configure(patch) { this._q.push(['configure', patch]); },
};
```

This is not a widget and does not render UI.

## Add to page

```html
<script src="https://cdn.jsdelivr.net/gh/Dmitry-Klymenko/Balakun-SDK-Examples@main/web/qa/js-stub/waybeam-js-stub.js"></script>
```

## Test

Use `web/qa/js-stub/install-snippet.js`.

**Add your own basket.get implementation inside `basket.get()` in `install-snippet.js`.**

**Add your own basket.add implementation inside `basket.add(input)` in `install-snippet.js`.**

Then run:

```js
await waybeamQaStub.get();
await waybeamQaStub.add({
  productUrl: 'https://example.com/product/example-1',
  productId: 'example-product-1',
  variantId: 'example-variant-1',
  variantKey: 'example-product-1:example-variant-1',
  quantity: 1,
});
```

## What it validates

- pre-load `configure(...)` queue replay
- post-load `configure(...)` updates
- `customer.userId` and `customer.userName`
- rejects forbidden `customer.userEmail` and `customer.userPhone`
- `customer.previousPurchases` is an array with at most 10 entries
- optional `customerProvided({ userName, userEmail, userPhone })`
- `basket.get()` returns `{ currency, itemCount, items }`
- `itemCount` equals the sum of `items[].quantity`, with missing quantity counted as `1`
- each basket item uses documented camelCase fields: `{ productUrl, productId, variantId, variantKey, quantity }`
- `basket.add({ productUrl, productId, variantId, variantKey, quantity })`
- `basket.add` resolves to `{ ok: boolean }`

The stub intentionally fails fast. Invalid protocol shape causes `console.error(...)` and throws an exception.

## Paste into browser console

Open the target website, then paste the contents of:

```text
web/qa/js-stub/install-snippet.js
```

Before running, replace `window.WAYBEAM_QA_ADD_CANDIDATES` with real product variants from the target site.

## Useful console commands

```js
waybeamQaStub.state();
waybeamQaStub.get();
waybeamQaStub.addRandom();
waybeamQaStub.stopGetPolling();
waybeamQaStub.startGetPolling();
```

## Notes for integrators

- Do not install this on production pages.
- Do not pass customer email or phone through `customer`; those are callback outputs only.
- Use the documented camelCase field names. The QA stub does not accept snake_case aliases.
- Replace example basket handlers with the host site's real basket API calls.
- `cdn.jsdelivr.net` fetches from the public GitHub repo and caches the file. You do not publish to jsDelivr separately.
- For immutable QA runs, pin the jsDelivr URL to a commit SHA instead of `@main`.
