/*
 * Waybeam JS API QA Stub
 *
 * Purpose:
 * - Helps host-site developers test Waybeam public JS API integration without loading the real widget.
 * - Installs window.waybeam with configure(...) and identifyUser(...).
 * - Replays pre-load queued calls compatible with:
 *   window.waybeam = window.waybeam || { _q: [], configure(patch) { this._q.push(['configure', patch]); } };
 * - Periodically calls the configured basket.get handler and logs the result.
 * - Can call the configured basket.add handler using preconfigured random product variants.
 *
 * This is a QA/dev helper only. Do not ship it on production pages.
 */
(function installWaybeamQaStub(global) {
  'use strict';

  var DEFAULTS = {
    getIntervalMs: 10000,
    autoStartGetPolling: true,
    autoAddIntervalMs: 0,
    logPrefix: '[Waybeam QA Stub]',
    exposeDebugApi: true,
    maxPreviousPurchases: 100,
  };

  var existing = isRecord(global.waybeam) ? global.waybeam : {};
  var queued = Array.isArray(existing._q) ? existing._q.slice() : [];
  var existingQaConfig = isRecord(global.WAYBEAM_QA_STUB) ? global.WAYBEAM_QA_STUB : {};

  var state = {
    config: {},
    customer: {},
    basketHandlers: { get: null, add: null },
    customerProvided: null,
    qa: merge(DEFAULTS, existingQaConfig),
    getTimer: null,
    addTimer: null,
    lastBasket: null,
    callCounts: { configure: 0, identifyUser: 0, get: 0, add: 0, customerProvided: 0 },
  };

  function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function copyOwn(input) {
    var out = {};
    if (!isRecord(input)) return out;
    Object.keys(input).forEach(function (key) { out[key] = input[key]; });
    return out;
  }

  function mergeValue(currentValue, patchValue) {
    if (patchValue === undefined) return currentValue;
    if (isPlainObject(patchValue)) {
      return merge(isPlainObject(currentValue) ? currentValue : {}, patchValue);
    }
    if (Array.isArray(patchValue)) return patchValue.slice();
    return patchValue;
  }

  function merge(currentConfig, patchConfig) {
    var base = isPlainObject(currentConfig) ? copyOwn(currentConfig) : {};
    if (!isPlainObject(patchConfig)) return base;
    Object.keys(patchConfig).forEach(function (key) {
      base[key] = mergeValue(base[key], patchConfig[key]);
    });
    return base;
  }

  function trimString(value, maxLen) {
    if (value == null) return '';
    var trimmed = String(value).trim();
    if (!trimmed) return '';
    return maxLen > 0 && trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
  }

  function normalizeQuantity(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  function normalizeCustomer(customer) {
    if (!isRecord(customer)) return {};
    var out = {};
    var userId = trimString(customer.userId, 128);
    var userName = trimString(customer.userName, 128);
    if (userId) out.userId = userId;
    if (userName) out.userName = userName;
    if (Array.isArray(customer.previousPurchases)) {
      out.previousPurchases = customer.previousPurchases.slice(0, state.qa.maxPreviousPurchases || DEFAULTS.maxPreviousPurchases);
    }
    return out;
  }

  function normalizeAddInput(input) {
    var source = isRecord(input) ? input : {};
    return {
      productUrl: trimString(source.productUrl || source.product_url || source.url, 2048),
      productId: trimString(source.productId || source.product_id || source.id, 120),
      variantId: trimString(source.variantId || source.variant_id, 120),
      variantKey: trimString(source.variantKey || source.variant_key, 180),
      quantity: normalizeQuantity(source.quantity),
    };
  }

  function normalizeBasketResult(result) {
    if (!isRecord(result)) return result;
    var items = Array.isArray(result.items) ? result.items : [];
    var inferredCount = items.reduce(function (total, item) {
      return total + normalizeQuantity(isRecord(item) ? item.quantity : 1);
    }, 0);
    return merge(result, {
      currency: trimString(result.currency, 12) || undefined,
      itemCount: Number.isFinite(Number(result.itemCount)) ? Number(result.itemCount) : inferredCount,
      items: items,
    });
  }

  function applyConfiguredIntegration() {
    var cfg = isPlainObject(state.config) ? state.config : {};
    state.customer = normalizeCustomer(cfg.customer);

    var basket = isPlainObject(cfg.basket) ? cfg.basket : {};
    state.basketHandlers.get = typeof basket.get === 'function' ? basket.get : null;
    state.basketHandlers.add = typeof basket.add === 'function' ? basket.add : null;
    state.customerProvided = typeof cfg.customerProvided === 'function' ? cfg.customerProvided : null;

    if (isPlainObject(cfg.qa)) {
      state.qa = merge(state.qa, cfg.qa);
    }
    if (Array.isArray(cfg.addCandidates)) {
      state.qa.addCandidates = cfg.addCandidates.slice();
    }
  }

  function log(level, message, data) {
    var prefix = state.qa.logPrefix || DEFAULTS.logPrefix;
    var consoleRef = global.console || {};
    var fn = consoleRef[level] || consoleRef.log;
    if (typeof fn !== 'function') return;
    if (data !== undefined) fn.call(consoleRef, prefix + ' ' + message, data);
    else fn.call(consoleRef, prefix + ' ' + message);
  }

  function configure(patch) {
    state.callCounts.configure += 1;
    if (!isPlainObject(patch)) {
      log('warn', 'configure ignored: patch must be a plain object', patch);
      return;
    }
    state.config = merge(state.config, patch);
    applyConfiguredIntegration();
    log('info', 'configured', publicState());
    restartTimers();
  }

  function identifyUser(customer) {
    state.callCounts.identifyUser += 1;
    configure({ customer: customer });
  }

  async function callBasketGet() {
    state.callCounts.get += 1;
    if (typeof state.basketHandlers.get !== 'function') {
      var missing = { ok: false, error: 'basket_get_not_configured' };
      log('warn', 'basket.get not configured', missing);
      return missing;
    }
    try {
      var result = normalizeBasketResult(await state.basketHandlers.get());
      state.lastBasket = result;
      log('info', 'basket.get result', result);
      return result;
    } catch (error) {
      var failed = { ok: false, error: 'basket_get_failed', message: error && error.message ? error.message : String(error) };
      log('error', 'basket.get failed', failed);
      return failed;
    }
  }

  function getAddCandidates() {
    var candidates = [];
    if (Array.isArray(state.qa.addCandidates)) candidates = state.qa.addCandidates;
    else if (Array.isArray(global.WAYBEAM_QA_ADD_CANDIDATES)) candidates = global.WAYBEAM_QA_ADD_CANDIDATES;
    return candidates.map(normalizeAddInput).filter(function (item) {
      return item.productUrl && item.variantId && item.variantKey;
    });
  }

  function pickRandomCandidate() {
    var candidates = getAddCandidates();
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async function callBasketAdd(input) {
    state.callCounts.add += 1;
    if (typeof state.basketHandlers.add !== 'function') {
      var missing = { ok: false, error: 'basket_add_not_configured' };
      log('warn', 'basket.add not configured', missing);
      return missing;
    }
    var normalized = normalizeAddInput(input || pickRandomCandidate());
    if (!normalized.productUrl || !normalized.variantId || !normalized.variantKey) {
      var invalid = { ok: false, error: 'basket_add_candidate_missing', required: ['productUrl', 'variantId', 'variantKey'] };
      log('warn', 'basket.add candidate missing/invalid', invalid);
      return invalid;
    }
    try {
      log('info', 'basket.add input', normalized);
      var result = await state.basketHandlers.add(normalized);
      var finalResult = isRecord(result) ? result : { ok: result === true };
      log(finalResult.ok === true ? 'info' : 'warn', 'basket.add result', finalResult);
      return finalResult;
    } catch (error) {
      var failed = { ok: false, error: 'basket_add_failed', message: error && error.message ? error.message : String(error) };
      log('error', 'basket.add failed', failed);
      return failed;
    }
  }

  async function callCustomerProvided(payload) {
    state.callCounts.customerProvided += 1;
    if (typeof state.customerProvided !== 'function') {
      log('warn', 'customerProvided not configured');
      return null;
    }
    try {
      var result = await state.customerProvided(isRecord(payload) ? payload : {});
      log('info', 'customerProvided result', result);
      return result;
    } catch (error) {
      log('error', 'customerProvided failed', error);
      return null;
    }
  }

  function startGetPolling() {
    stopGetPolling();
    var interval = Number(state.qa.getIntervalMs || DEFAULTS.getIntervalMs);
    if (!Number.isFinite(interval) || interval <= 0) return;
    state.getTimer = global.setInterval(callBasketGet, interval);
    log('info', 'basket.get polling started every ' + interval + 'ms');
  }

  function stopGetPolling() {
    if (state.getTimer) global.clearInterval(state.getTimer);
    state.getTimer = null;
  }

  function startAutoAdd() {
    stopAutoAdd();
    var interval = Number(state.qa.autoAddIntervalMs || 0);
    if (!Number.isFinite(interval) || interval <= 0) return;
    state.addTimer = global.setInterval(function () { callBasketAdd(); }, interval);
    log('warn', 'automatic basket.add started every ' + interval + 'ms');
  }

  function stopAutoAdd() {
    if (state.addTimer) global.clearInterval(state.addTimer);
    state.addTimer = null;
  }

  function restartTimers() {
    if (state.qa.autoStartGetPolling !== false) startGetPolling();
    else stopGetPolling();
    startAutoAdd();
  }

  function publicState() {
    return {
      hasBasketGet: typeof state.basketHandlers.get === 'function',
      hasBasketAdd: typeof state.basketHandlers.add === 'function',
      hasCustomerProvided: typeof state.customerProvided === 'function',
      customer: copyOwn(state.customer),
      addCandidateCount: getAddCandidates().length,
      getPolling: !!state.getTimer,
      autoAdd: !!state.addTimer,
      callCounts: copyOwn(state.callCounts),
      lastBasket: state.lastBasket,
    };
  }

  function replayQueuedCalls() {
    queued.forEach(function (entry) {
      if (Array.isArray(entry)) {
        if (entry[0] === 'configure') configure(entry[1]);
        if (entry[0] === 'identifyUser') identifyUser(entry[1]);
        return;
      }
      if (isRecord(entry)) {
        if (entry.type === 'configure') configure(entry.config || entry.patch);
        if (entry.type === 'identifyUser') identifyUser(entry.customer);
      }
    });
  }

  existing.configure = configure;
  existing.identifyUser = identifyUser;
  existing._q = [];
  existing.qaStub = {
    state: publicState,
    get: callBasketGet,
    addRandom: function () { return callBasketAdd(); },
    add: callBasketAdd,
    customerProvided: callCustomerProvided,
    startGetPolling: startGetPolling,
    stopGetPolling: stopGetPolling,
    startAutoAdd: startAutoAdd,
    stopAutoAdd: stopAutoAdd,
    candidates: getAddCandidates,
  };

  global.waybeam = existing;
  if (state.qa.exposeDebugApi !== false) global.waybeamQaStub = existing.qaStub;

  replayQueuedCalls();
  restartTimers();
  log('info', 'installed. Use window.waybeamQaStub.state(), .get(), .addRandom(), .add(input).', publicState());
})(window);
