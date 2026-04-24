# Waybeam JS API QA Stub

A small browser-only QA helper for testing Waybeam public JavaScript API integration without loading the real widget.

It installs `window.waybeam` with the same public integration shape used by the real loader:

```js
window.waybeam = window.waybeam || {
  _q: [],
  configure(patch) { this._q.push(['configure', patch]); },
};
```

## What it tests

- pre-load `configure(...)` queue replay
- post-load `configure(...)` updates
- `customer` config
- optional `customerProvided(...)` callback
- `basket.get()` polling
- `basket.add(...)` using predefined product variant candidates
- snake_case compatibility for common basket fields, for QA convenience

This is not a widget and does not render UI.

## Paste into browser console

Open the target website, then paste the contents of:

```text
web/qa/js-stub/install-snippet.js
```

Before running, replace `window.WAYBEAM_QA_ADD_CANDIDATES` with real product variants from the target site.

Required fields per candidate:

```js
{
  productUrl: 'https://example.com/product/example-1',
  productId: 'example-product-1',
  variantId: 'example-variant-1',
  variantKey: 'example-product-1:example-variant-1',
  quantity: 1,
}
```

## Hosted script usage

GitHub repositories do not serve JavaScript with ideal production CDN headers directly from `github.com` raw URLs.

Use jsDelivr over this public repository:

```html
<script src="https://cdn.jsdelivr.net/gh/Dmitry-Klymenko/Balakun-SDK-Examples@main/web/qa/js-stub/waybeam-js-stub.js"></script>
```

For immutable QA runs, prefer pinning to a commit SHA instead of `@main`.

## Useful console commands

```js
waybeamQaStub.state();       // current QA state
waybeamQaStub.get();         // manually call configured basket.get
waybeamQaStub.addRandom();   // call configured basket.add with random candidate
waybeamQaStub.add({          // call configured basket.add with explicit input
  productUrl: 'https://example.com/product/example-1',
  productId: 'example-product-1',
  variantId: 'example-variant-1',
  variantKey: 'example-product-1:example-variant-1',
  quantity: 1,
});
waybeamQaStub.stopGetPolling();
waybeamQaStub.startGetPolling();
```

## Auto-add safety

`autoAddIntervalMs` defaults to `0`, so the stub does not repeatedly add products unless explicitly enabled.

```js
window.waybeam.configure({
  qa: {
    getIntervalMs: 10000,
    autoStartGetPolling: true,
    autoAddIntervalMs: 0,
  },
});
```

Only enable automatic add on safe staging environments.

## Notes for integrators

- Do not install this on production pages.
- Do not pass customer email or phone through `customer`; those are callback outputs only.
- Replace example basket handlers with the host site's real basket API calls.
- The real Waybeam widget may also perform iframe/postMessage behaviour; this stub intentionally focuses on host-page public JS API integration only.
