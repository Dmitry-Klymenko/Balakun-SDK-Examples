// Paste into DevTools on the host website. Replace example values with real basket data.
window.WAYBEAM_QA_ADD_CANDIDATES = [{
  productUrl: 'https://example.com/product/example-1',
  productId: 'example-product-1',
  variantId: 'example-variant-1',
  variantKey: 'example-product-1:example-variant-1',
  quantity: 1,
}];

window.waybeam = window.waybeam || {
  _q: [],
  configure(patch) { this._q.push(['configure', patch]); },
};

window.waybeam.configure({
  customer: { userId: 'qa-user-123', userName: 'QA User' },
  async customerProvided(payload) {
    console.log('[Host test] customerProvided', payload);
    return { ok: true };
  },
  basket: {
    async get() {
      console.log('[Host test] basket.get');
      return { currency: 'AUD', itemCount: 0, items: [] };
    },
    async add(input) {
      console.log('[Host test] basket.add', input);
      return { ok: true };
    },
  },
});

const s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/gh/Dmitry-Klymenko/Balakun-SDK-Examples@main/web/qa/js-stub/waybeam-js-stub.js';
s.async = true;
s.onload = () => console.log('[Waybeam QA Stub] loaded');
s.onerror = () => console.error('[Waybeam QA Stub] failed to load');
document.head.appendChild(s);
