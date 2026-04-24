// Waybeam JS API QA Stub - paste into browser DevTools console on the host website.
// Edit WAYBEAM_QA_ADD_CANDIDATES first so basket.add can test real variants from the host catalogue.

window.WAYBEAM_QA_ADD_CANDIDATES = [
  {
    productUrl: 'https://example.com/product/example-1',
    productId: 'example-product-1',
    variantId: 'example-variant-1',
    variantKey: 'example-product-1:example-variant-1',
    quantity: 1,
  },
];

// Safe pre-init shape, same pattern expected by the real Waybeam loader.
window.waybeam = window.waybeam || {
  _q: [],
  configure(patch) {
    this._q.push(['configure', patch]);
  },
};

// Example host integration. Replace these handlers with the site's real basket API calls.
window.waybeam.configure({
  customer: {
    userId: 'qa-user-123',
    userName: 'QA User',
  },
  async customerProvided({ userName, userEmail, userPhone }) {
    console.log('[Host test] customerProvided received', { userName, userEmail, userPhone });
    return { ok: true };
  },
  basket: {
    async get() {
      console.log('[Host test] basket.get called');
      return {
        currency: 'AUD',
        itemCount: 0,
        items: [],
      };
    },
    async add({ productUrl, productId, variantId, variantKey, quantity }) {
      console.log('[Host test] basket.add called', { productUrl, productId, variantId, variantKey, quantity });
      return { ok: true };
    },
  },
  qa: {
    getIntervalMs: 10000,
    autoStartGetPolling: true,
    autoAddIntervalMs: 0,
  },
});

(function loadWaybeamQaStub() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/Dmitry-Klymenko/Balakun-SDK-Examples@main/web/qa/js-stub/waybeam-js-stub.js';
  script.async = true;
  script.onload = () => console.log('[Waybeam QA Stub] loaded. Try: waybeamQaStub.state(), waybeamQaStub.get(), waybeamQaStub.addRandom()');
  script.onerror = () => console.error('[Waybeam QA Stub] failed to load');
  document.head.appendChild(script);
})();
