/*
 * Waybeam JS API QA Stub
 *
 * Small browser helper for checking a host page's Waybeam JavaScript API integration.
 * It does not load or render the real Waybeam widget.
 *
 * Wrong shapes are intentionally loud: console.error first, then throw.
 * Use this only for local QA, staging checks, and integrator troubleshooting.
 */
(function installWaybeamQaStub(window) {
  'use strict';

  var PREFIX = '[Waybeam QA Stub]';

  var existing = isObject(window.waybeam) ? window.waybeam : {};
  var queued = Array.isArray(existing._q) ? existing._q.slice() : [];

  var state = {
    config: {},
    customer: {},
    customerProvided: null,
    basketGet: null,
    basketAdd: null,
    addCandidates: [],
    getTimer: null,
    addTimer: null,
    calls: { configure: 0, get: 0, add: 0, customerProvided: 0 },
    lastBasket: null,
  };

  var qa = merge(
    {
      getIntervalMs: 10000,
      autoStartGetPolling: true,
      autoAddIntervalMs: 0,
      exposeDebugApi: true,
    },
    isPlainObject(window.WAYBEAM_QA_STUB) ? window.WAYBEAM_QA_STUB : {}
  );

  validateQaConfig(qa);

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function merge(base, patch) {
    var out = {};
    Object.keys(base || {}).forEach(function (key) { out[key] = base[key]; });
    Object.keys(patch || {}).forEach(function (key) {
      var value = patch[key];
      if (value !== undefined) out[key] = value;
    });
    return out;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.slice();
    if (!isPlainObject(value)) return value;
    var out = {};
    Object.keys(value).forEach(function (key) { out[key] = clone(value[key]); });
    return out;
  }

  /** Log a clear protocol error and stop the current QA action. */
  function fail(code, message, details) {
    if (window.console && typeof window.console.error === 'function') {
      window.console.error(PREFIX + ' ' + code + ': ' + message, details || '');
    }
    var error = new Error(PREFIX + ' ' + code + ': ' + message);
    error.code = code;
    error.details = details || null;
    throw error;
  }

  function log(message, details) {
    if (window.console && typeof window.console.log === 'function') {
      window.console.log(PREFIX + ' ' + message, details || '');
    }
  }

  function optionalText(value, field, maxLength) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') fail('INVALID_FIELD', field + ' must be a string', { field: field, value: value });
    var trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length > maxLength) fail('INVALID_FIELD', field + ' is too long', { field: field, maxLength: maxLength });
    return trimmed;
  }

  function requiredText(value, field, maxLength) {
    var text = optionalText(value, field, maxLength);
    if (!text) fail('MISSING_FIELD', field + ' is required', { field: field });
    return text;
  }

  function normalQuantity(value, field) {
    if (value === undefined || value === null || value === '') return 1;
    var numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      fail('INVALID_FIELD', field + ' must be a positive number', { field: field, value: value });
    }
    return Math.floor(numberValue);
  }

  /** Validate host-supplied customer context. Email and phone are intentionally blocked here. */
  function validateCustomer(customer) {
    if (customer === undefined) return {};
    if (!isPlainObject(customer)) fail('INVALID_CUSTOMER', 'customer must be an object', { customer: customer });

    if (customer.userEmail !== undefined) {
      fail('INVALID_CUSTOMER', 'customer.userEmail must not be supplied by the host page', { field: 'customer.userEmail' });
    }
    if (customer.userPhone !== undefined) {
      fail('INVALID_CUSTOMER', 'customer.userPhone must not be supplied by the host page', { field: 'customer.userPhone' });
    }

    var out = {};
    var userId = optionalText(customer.userId, 'customer.userId', 128);
    var userName = optionalText(customer.userName, 'customer.userName', 128);
    if (userId) out.userId = userId;
    if (userName) out.userName = userName;

    if (customer.previousPurchases !== undefined) {
      if (!Array.isArray(customer.previousPurchases)) {
        fail('INVALID_CUSTOMER', 'customer.previousPurchases must be an array', { previousPurchases: customer.previousPurchases });
      }
      if (customer.previousPurchases.length > 10) {
        fail('INVALID_CUSTOMER', 'customer.previousPurchases must contain no more than 10 entries', { count: customer.previousPurchases.length });
      }
      out.previousPurchases = customer.previousPurchases.slice();
    }

    return out;
  }

  /** Validate details passed from Waybeam back to the host callback. */
  function validateCustomerProvidedPayload(payload) {
    if (payload === undefined) return {};
    if (!isPlainObject(payload)) fail('INVALID_CUSTOMER_PROVIDED', 'customerProvided payload must be an object', { payload: payload });

    var out = {};
    var userName = optionalText(payload.userName, 'userName', 128);
    var userEmail = optionalText(payload.userEmail, 'userEmail', 256);
    var userPhone = optionalText(payload.userPhone, 'userPhone', 64);
    if (userName) out.userName = userName;
    if (userEmail) out.userEmail = userEmail;
    if (userPhone) out.userPhone = userPhone;
    return out;
  }

  /** Validate one basket line used by basket.get, basket.add, and addCandidates. */
  function validateBasketLine(item, fieldPrefix) {
    if (!isPlainObject(item)) fail('INVALID_BASKET_ITEM', fieldPrefix + ' must be an object', { item: item });
    return {
      productUrl: requiredText(item.productUrl, fieldPrefix + '.productUrl', 2048),
      productId: optionalText(item.productId, fieldPrefix + '.productId', 120),
      variantId: requiredText(item.variantId, fieldPrefix + '.variantId', 120),
      variantKey: requiredText(item.variantKey, fieldPrefix + '.variantKey', 180),
      quantity: normalQuantity(item.quantity, fieldPrefix + '.quantity'),
    };
  }

  /** Validate basket.get output, including itemCount matching item quantities. */
  function validateBasketGetResult(result) {
    if (!isPlainObject(result)) fail('INVALID_BASKET_GET_RESULT', 'basket.get must return an object', { result: result });
    if (!Array.isArray(result.items)) fail('INVALID_BASKET_GET_RESULT', 'basket.get result.items must be an array', { result: result });

    var items = result.items.map(function (item, index) {
      return validateBasketLine(item, 'items[' + index + ']');
    });

    var itemCount = Number(result.itemCount);
    if (!Number.isInteger(itemCount) || itemCount < 0) {
      fail('INVALID_BASKET_GET_RESULT', 'basket.get result.itemCount must be a non-negative integer', { itemCount: result.itemCount });
    }

    var expectedItemCount = items.reduce(function (total, item) {
      return total + item.quantity;
    }, 0);

    if (itemCount !== expectedItemCount) {
      fail('INVALID_BASKET_GET_RESULT', 'basket.get result.itemCount must match items: sum of quantity, defaulting missing quantity to 1', {
        itemCount: itemCount,
        expectedItemCount: expectedItemCount,
        items: items,
      });
    }

    return {
      currency: requiredText(result.currency, 'currency', 12),
      itemCount: itemCount,
      items: items,
    };
  }

  function validateBasketAddInput(input) {
    return validateBasketLine(input, 'basket.add input');
  }

  function validateBasketAddResult(result) {
    if (!isPlainObject(result)) fail('INVALID_BASKET_ADD_RESULT', 'basket.add must return an object', { result: result });
    if (typeof result.ok !== 'boolean') fail('INVALID_BASKET_ADD_RESULT', 'basket.add result.ok must be boolean', { result: result });
    return result;
  }

  function validateAddCandidates(candidates) {
    if (!Array.isArray(candidates)) fail('INVALID_ADD_CANDIDATES', 'addCandidates must be an array', { addCandidates: candidates });
    return candidates.map(function (candidate, index) {
      return validateBasketLine(candidate, 'addCandidates[' + index + ']');
    });
  }

  function validateQaConfig(value) {
    if (value === undefined) return;
    if (!isPlainObject(value)) fail('INVALID_QA_CONFIG', 'qa must be an object', { qa: value });

    ['getIntervalMs', 'autoAddIntervalMs'].forEach(function (field) {
      if (value[field] === undefined) return;
      if (!Number.isFinite(Number(value[field])) || Number(value[field]) < 0) {
        fail('INVALID_QA_CONFIG', 'qa.' + field + ' must be a non-negative number', { value: value[field] });
      }
    });

    ['autoStartGetPolling', 'exposeDebugApi'].forEach(function (field) {
      if (value[field] !== undefined && typeof value[field] !== 'boolean') {
        fail('INVALID_QA_CONFIG', 'qa.' + field + ' must be boolean', { value: value[field] });
      }
    });
  }

  /** Validate one window.waybeam.configure(...) patch before applying it. */
  function validateConfigurePatch(patch) {
    if (!isPlainObject(patch)) fail('INVALID_CONFIGURE_PATCH', 'window.waybeam.configure(patch) expects an object', { patch: patch });
    if (patch.customer !== undefined) validateCustomer(patch.customer);
    if (patch.customerProvided !== undefined && typeof patch.customerProvided !== 'function') {
      fail('INVALID_CONFIGURE_PATCH', 'customerProvided must be a function', { customerProvided: patch.customerProvided });
    }
    if (patch.basket !== undefined) {
      if (!isPlainObject(patch.basket)) fail('INVALID_CONFIGURE_PATCH', 'basket must be an object', { basket: patch.basket });
      if (patch.basket.get !== undefined && typeof patch.basket.get !== 'function') fail('INVALID_CONFIGURE_PATCH', 'basket.get must be a function', { get: patch.basket.get });
      if (patch.basket.add !== undefined && typeof patch.basket.add !== 'function') fail('INVALID_CONFIGURE_PATCH', 'basket.add must be a function', { add: patch.basket.add });
    }
    if (patch.addCandidates !== undefined) validateAddCandidates(patch.addCandidates);
    validateQaConfig(patch.qa);
  }

  function applyConfig() {
    state.customer = validateCustomer(state.config.customer);
    state.customerProvided = typeof state.config.customerProvided === 'function' ? state.config.customerProvided : null;
    state.basketGet = state.config.basket && typeof state.config.basket.get === 'function' ? state.config.basket.get : null;
    state.basketAdd = state.config.basket && typeof state.config.basket.add === 'function' ? state.config.basket.add : null;
    state.addCandidates = state.config.addCandidates ? validateAddCandidates(state.config.addCandidates) : state.addCandidates;
    if (state.config.qa) qa = merge(qa, state.config.qa);
  }

  function configure(patch) {
    state.calls.configure += 1;
    validateConfigurePatch(patch);
    state.config = merge(state.config, patch);
    applyConfig();
    restartTimers();
    log('configured', snapshot());
  }

  function identifyUser(customer) {
    configure({ customer: customer });
  }

  function configuredCandidates() {
    if (state.addCandidates.length > 0) return state.addCandidates.slice();
    if (Array.isArray(window.WAYBEAM_QA_ADD_CANDIDATES)) return validateAddCandidates(window.WAYBEAM_QA_ADD_CANDIDATES);
    return [];
  }

  function randomCandidate() {
    var list = configuredCandidates();
    if (list.length === 0) {
      fail('MISSING_ADD_CANDIDATES', 'No add candidates configured. Set window.WAYBEAM_QA_ADD_CANDIDATES or configure({ addCandidates }).');
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  async function getBasket() {
    state.calls.get += 1;
    if (typeof state.basketGet !== 'function') fail('MISSING_HANDLER', 'basket.get is not configured');
    var result = validateBasketGetResult(await state.basketGet());
    state.lastBasket = result;
    log('basket.get result', result);
    return result;
  }

  async function addToBasket(input) {
    state.calls.add += 1;
    if (typeof state.basketAdd !== 'function') fail('MISSING_HANDLER', 'basket.add is not configured');
    var request = validateBasketAddInput(input || randomCandidate());
    log('basket.add input', request);
    var result = validateBasketAddResult(await state.basketAdd(request));
    log('basket.add result', result);
    return result;
  }

  async function customerProvided(payload) {
    state.calls.customerProvided += 1;
    if (typeof state.customerProvided !== 'function') fail('MISSING_HANDLER', 'customerProvided is not configured');
    var result = await state.customerProvided(validateCustomerProvidedPayload(payload));
    if (result !== undefined && (!isPlainObject(result) || result.ok !== true)) {
      fail('INVALID_CUSTOMER_PROVIDED_RESULT', 'customerProvided should return { ok: true } when it returns a value', { result: result });
    }
    log('customerProvided result', result);
    return result;
  }

  function startGetPolling() {
    stopGetPolling();
    if (!state.basketGet) return;
    if (!qa.getIntervalMs) return;
    state.getTimer = window.setInterval(function () {
      getBasket().catch(function () {});
    }, Number(qa.getIntervalMs));
    log('basket.get polling started every ' + qa.getIntervalMs + 'ms');
  }

  function stopGetPolling() {
    if (state.getTimer) window.clearInterval(state.getTimer);
    state.getTimer = null;
  }

  function startAutoAdd() {
    stopAutoAdd();
    if (!state.basketAdd) return;
    if (!qa.autoAddIntervalMs) return;
    state.addTimer = window.setInterval(function () {
      addToBasket().catch(function () {});
    }, Number(qa.autoAddIntervalMs));
    log('automatic basket.add started every ' + qa.autoAddIntervalMs + 'ms');
  }

  function stopAutoAdd() {
    if (state.addTimer) window.clearInterval(state.addTimer);
    state.addTimer = null;
  }

  function restartTimers() {
    stopGetPolling();
    stopAutoAdd();
    if (qa.autoStartGetPolling !== false) startGetPolling();
    startAutoAdd();
  }

  function snapshot() {
    return {
      hasBasketGet: typeof state.basketGet === 'function',
      hasBasketAdd: typeof state.basketAdd === 'function',
      hasCustomerProvided: typeof state.customerProvided === 'function',
      addCandidateCount: configuredCandidates().length,
      getPolling: Boolean(state.getTimer),
      autoAdd: Boolean(state.addTimer),
      customer: clone(state.customer),
      calls: clone(state.calls),
      lastBasket: clone(state.lastBasket),
    };
  }

  function replayQueuedCalls() {
    queued.forEach(function (entry, index) {
      if (Array.isArray(entry) && entry[0] === 'configure') return configure(entry[1]);
      if (Array.isArray(entry) && entry[0] === 'identifyUser') return identifyUser(entry[1]);
      if (isPlainObject(entry) && entry.type === 'configure') return configure(entry.config || entry.patch);
      if (isPlainObject(entry) && entry.type === 'identifyUser') return identifyUser(entry.customer);
      fail('INVALID_QUEUE_ENTRY', 'Unsupported pre-load queue entry', { index: index, entry: entry });
    });
  }

  existing.configure = configure;
  existing.identifyUser = identifyUser;
  existing._q = [];
  existing.qaStub = {
    state: snapshot,
    get: getBasket,
    add: addToBasket,
    addRandom: function () { return addToBasket(); },
    customerProvided: customerProvided,
    candidates: configuredCandidates,
    startGetPolling: startGetPolling,
    stopGetPolling: stopGetPolling,
    startAutoAdd: startAutoAdd,
    stopAutoAdd: stopAutoAdd,
  };

  window.waybeam = existing;
  if (qa.exposeDebugApi !== false) window.waybeamQaStub = existing.qaStub;

  replayQueuedCalls();
  restartTimers();
  log('installed. Try window.waybeamQaStub.state(), .get(), .addRandom(), .add(input).', snapshot());
})(window);
