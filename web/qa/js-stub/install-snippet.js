// Paste into DevTools on the host website. Replace example values with real basket data.
(function () {
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
        // ADD YOUR IMPLEMENTATION HERE, OR UNCOMMENT/KEEP THE DEFAULT HARDCODED RESPONSE BELOW.
        console.log('[Host test] basket.get');
        alert('Insert here your own implementation to read basket content'); 
        // return myAsyncBasketReadFunction(); <= you need to create and define it
        // or uncomment below default
        // return { currency: 'AUD', itemCount: 0, items: [] };
      },
      async add(input) {
        // ADD YOUR IMPLEMENTATION HERE, OR UNCOMMENT/KEEP THE DEFAULT HARDCODED RESPONSE BELOW.
        console.log('[Host test] basket.add', input);
        alert('Insert here your own implementation to add a product variant to the basket'); 
        return { ok: true };
      },
    },
  });

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/Dmitry-Klymenko/Balakun-SDK-Examples@main/web/qa/js-stub/waybeam-js-stub.js';
  script.async = true;
  script.onload = () => console.log('[Waybeam QA Stub] loaded');
  script.onerror = () => console.error('[Waybeam QA Stub] failed to load');
  document.head.appendChild(script);
}());
