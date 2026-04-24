/*
 * Waybeam JS API QA Stub
 *
 * Browser-only QA helper for validating a host page's Waybeam public JS API integration.
 * It does not render a widget and must not be shipped on production pages.
 */
(function installWaybeamQaStub(window) {
  'use strict';

  var VERSION = '0.2.1';
  var PREFIX = '[Waybeam QA Stub]';
  var DEFAULT_QA = {
    getIntervalMs: 10000,
    autoStartGetPolling: true,
    autoAddIntervalMs: 0,
    exposeDebugApi: true,
  };

  var existingApi = isObject(window.waybeam) ? window.waybeam : {};
  var queuedCalls = Array.isArray(existingApi._q) ? existingApi._q.slice() : [];
  var externalQa = isPlainObject(window.WAYBEAM_QA_STUB) ? window.WAYBEAM_QA_STUB : {};

  var state = {
    config: {},
    qa: assign(assign({}, DEFAULT_QA), externalQa),
    customer: {},
    customerProvided: null,
    basket: { get: null, add: null },
    getTimer: null,
    addTimer: null,
    lastBasket: null,
    errors: [],
    calls: { configure: 0, identifyUser: 0, get: 0, add: 0, customerProvided: 0 },
  };

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function assign(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      target[key] = source[key];
    });
    return target;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.slice();
    if (!isPlainObject(value)) return value;
    return Object.keys(value).reduce(function (out, key) {
      out[key] = clone(value[key]);
      return out;
    }, {});
  }

  function mergeConfig(base, patch) {
    var out = isPlainObject(base) ? clone(base) : {};
    Object.keys(patch || {}).forEach(function (key) {
      var value = patch[key];
      if (value === undefined) return;
      out[key] = isPlainObject(value) ? mergeConfig(out[key], value) : clone(value);
    });
    return out;
  }

  function error(code, message, details) {
    var payload = { code: code, message: message, details: details || null };
    state.errors.push(payload);
    if (window.console && typeof window.console.error === 'function') {
      window.console.error(PREFIX + ' ' + code + ': ' + message, details || '');
    }
    return payload;
  }

  function fail(code, message, details) {
    var payload = error(code, message, details);
    var exception = new Error(PREFIX + ' ' + code + ': ' + message);
    exception.code = code;
    exception.details = payload.details;
    throw exception;
  }

  function log(message, details) {
    if (window.console && typeof window.console.log === 'function') {
      window.console.log(PREFIX + ' ' + message, details === undefined ? '' : details);
    }
  }

  function optionalString(value, field, maxLength) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') fail('INVALID_FIELD', field + ' must be a string', { field: field, value: value });
    var trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length > maxLength) fail('INVALID_FIELD', field + ' is too long', { field: field, maxLength: maxLength });
    return trimmed;
  }

  function requiredString(value, field, maxLength) {
    var result = optionalString(value, field, maxLength);
    if (!result) fail('MISSING_REQUIRED_FIELD', field + ' is required', { field: field });
    return result;
  }

  function quantity(value) {
    if (value === undefined || value === null || value === '') return 1;
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      fail('INVALID_FIELD', 'quantity must be a positive number when supplied', { quantity: value });
    }
    return Math.floor(parsed);
  }

  function validateNoSensitiveCustomerFields(customer) {
    if (!isPlainObject(customer)) return;
    if (Object.prototype.hasOwnProperty.call(customer, 'userEmail')) {
      fail('SENSITIVE_CUSTOMER_FIELD', 'customer.userEmail must not be supplied by the host page', { field: 'customer.userEmail' });
    }
    if (Object.prototype.hasOwnProperty.call(customer, 'userPhone')) {
      fail('SENSITIVE_CUSTOMER_FIELD', 'customer.userPhone must not be supplied by the host page', { field: 'customer.userPhone' });
    }
  }

  function validateCustomer(customer) {
    if (customer === undefined) return {};
    if (!isPlainObject(customer)) fail('INVALID_CUSTOMER', 'customer must be an object', { customer: customer });
    validateNoSensitiveCustomerFields(customer);

    var out = {};
    var userId = optionalString(customer.userId, 'customer.userId', 128);
    var userName = optionalString(customer.userName, 'customer.userName', 128);
    if (userId) out.userId = userId;
    if (userName) out.userName = userName;

    if (customer.previousPurchases !== undefined) {
      if (!Array.isArray(customer.previousPurchases)) {
        fail('INVALID_CUSTOMER', 'customer.previousPurchases must be an array', { previousPurchases: customer.previousPurchases });
      }
      if (customer.previousPurchases.length > 10) {
        fail('INVALID_CUSTOMER', 'customer.previousPurchases must contain at most 10 entries', { count: customer.previousPurchases.length });
      }
      out.previousPurchases = customer.previousPurchases.slice();
    }

    return out;
  }

  function validateCustomerProvidedPayload(payload) {
    if (payload === undefined) return {};
    if (!isPlainObject(payload)) fail('INVALID_CUSTOMER_PROVIDED', 'customerProvided payload must be an object', { payload: payload });
    var out = {};
    var userName = optionalString(payload.userName, 'userName', 128);
    var userEmail = optionalString(payload.userEmail, 'userEmail', 256);
    var userPhone = optionalString(payload.userPhone, 'userPhone', 64);
    if (userName) out.userName = userName;
    if (userEmail) out.userEmail = userEmail;
    if (userPhone) out.userPhone = userPhone;
    return out;
  }

  function validateBasketItem(item, index) {
    if (!isPlainObject(item)) fail('INVALID_BASKET_ITEM', 'basket.items[' + index + '] must be an object', { item: item });
    return {
      productUrl: requiredString(item.productUrl, 'items[' + index + '].productUrl', 2048),
      productId: optionalString(item.productId, 'items[' + index + '].productId', 120),
      variantId: requiredString(item.variantId, 'items[' + index + '].variantId', 120),
      variantKey: requiredString(item.variantKey, 'items[' + index + '].variantKey', 180),
      quantity: quantity(item.quantity),
    };
  }

  function validateBasketGetResult(result) {
    if (!isPlainObject(result)) fail('INVALID_BASKET_GET_RESULT', 'basket.get must resolve to an object', { result: result });
    if (!Array.isArray(result.items)) fail('INVALID_BASKET_GET_RESULT', 'basket.get result.items must be an array', { result: result });

    var items = result.items.map(validateBasketItem);
    var itemCount = Number(result.itemCount);
    if (!Number.isFinite(itemCount) || itemCount < 0) {
      fail('INVALID_BASKET_GET_RESULT', 'basket.get result.itemCount must be a non-negative number', { itemCount: result.itemCount });
    }

    return {
      currency: requiredString(result.currency, 'currency', 12),
      itemCount: Math.floor(itemCount),
      items: items,
    };
  }

  function validateBasketAddInput(input) {
    if (!isPlainObject(input)) fail('INVALID_BASKET_ADD_INPUT', 'basket.add input must be an object', { input: input });
    return {
      productUrl: requiredString(input.productUrl, 'productUrl', 2048),
      productId: optionalString(input.productId, 'productId', 120),
      variantId: requiredString(input.variantId, 'variantId', 120),
      variantKey: requiredString(input.variantKey, 'variantKey', 180),
      quantity: quantity(input.quantity),
    };
  }

  function validateBasketAddResult(result) {
    if (!isPlainObject(result)) fail('INVALID_BASKET_ADD_RESULT', 'basket.add must resolve to an object', { result: result });
    if (typeof result.ok !== 'boolean') fail('INVALID_BASKET_ADD_RESULT', 'basket.add result.ok must be boolean', { result: result });
    return result;
  }

  function validateQaConfig(qa) {
    if (qa === undefined) return;
    if (!isPlainObject(qa)) fail('INVALID_QA_CONFIG', 'qa must be an object', { qa: qa });
    ['getIntervalMs', 'autoAddIntervalMs'].forEach(function (field) {
      if (qa[field] === undefined) return;
      var numberValue = Number(qa[field]);
      if (!Number.isFinite(numberValue) || numberValue < 0) fail('INVALID_QA_CONFIG', 'qa.' + field + ' must be a non-negative number', { value: qa[field] });
    });
    if (qa.autoStartGetPolling !== undefined && typeof qa.autoStartGetPolling !== 'boolean') {
      fail('INVALID_QA_CONFIG', 'qa.autoStartGetPolling must be boolean', { value: qa.autoStartGetPolling });
    }
  }

  function validateConfiguration(config) {
    if (!isPlainObject(config)) fail('INVALID_CONFIGURE_PATCH', 'configure(patch) requires a plain object', { patch: config });

    if (config.customer !== undefined) validateCustomer(config.customer);
    if (config.customerProvided !== undefined && typeof config.customerProvided !== 'function') {
      fail('INVALID_CUSTOMER_PROVIDED', 'customerProvided must be a function when supplied', { customerProvided: config.customerProvided });
    }
    if (config.basket !== undefined) {
      if (!isPlainObject(config.basket)) fail('INVALID_BASKET_CONFIG', 'basket must be an object', { basket: config.basket });
      if (config.basket.get !== undefined && typeof config.basket.get !== 'function') {
        fail('INVALID_BASKET_CONFIG', 'basket.get must be a function when supplied', { get: config.basket.get });
      }
      if (config.basket.add !== undefined && typeof config.basket.add !== 'function') {
        fail('INVALID_BASKET_CONFIG', 'basket.add must be a function when supplied', { add: config.basket.add });
      }
    }
    if (config.addCandidates !== undefined) validateAddCandidates(config.addCandidates);
    validateQaConfig(config.qa);
  }

  function validateAddCandidates(candidates) {
    if (!Array.isArray(candidates)) fail('INVALID_ADD_CANDIDATES', 'addCandidates must be an array', { addCandidates: candidates });
    return candidates.map(validateBasketAddInput);
  }

  function applyConfiguration() {
    var config = state.config;
    state.customer = validateCustomer(config.customer);
    state.customerProvided = typeof config.customerProvided === 'function' ? config.customerProvided : null;

    var basket = isPlainObject(config.basket) ? config.basket : {};
    state.basket.get = typeof basket.get === 'function' ? basket.get : null;
    state.basket.add = typeof basket.add === 'function' ? basket.add : null;

    if (config.qa !== undefined) state.qa = assign(assign({}, state.qa), config.qa);
    if (config.addCandidates !== undefined) state.addCandidates = validateAddCandidates(config.addCandidates);
  }

  function configure(patch) {
    state.calls.configure += 1;
    validateConfiguration(patch);
    state.config = mergeConfig(state.config, patch);
    applyConfiguration();
    restartTimers();
    log('configured', publicState());
  }

  function identifyUser(customer) {
    state.calls.identifyUser += 1;
    configure({ customer: customer });
  }

  function candidates() {
    if (Array.isArray(state.addCandidates)) return state.addCandidates.slice();
    if (Array.isArray(window.WAYBEAM_QA_ADD_CANDIDATES)) return validateAddCandidates(window.WAYBEAM_QA_ADD_CANDIDATES);
    return [];
  }

  function randomCandidate() {
    var list = candidates();
    if (list.length === 0) fail('MISSING_ADD_CANDIDATES', 'No valid add candidates configured', { expected: 'window.WAYBEAM_QA_ADD_CANDIDATES or configure({ addCandidates })' });
    return list[Math.floor(Math.random() * list.length)];
  }

  function requireHandler(name, handler) {
    if (typeof handler !== 'function') fail('MISSING_HANDLER', name + ' is not configured', { handler: name });
  }

  async function callBasketGet() {
    state.calls.get += 1;
    requireHandler('basket.get', state.basket.get);
    try {
      var result = validateBasketGetResult(await state.basket.get());
      state.lastBasket = result;
      log('basket.get result', result);
      return result;
    } catch (exception) {
      if (!exception || !exception.code) error('BASKET_GET_FAILED', 'basket.get failed', exception);
      throw exception;
    }
  }

  async function callBasketAdd(input) {
    state.calls.add += 1;
    requireHandler('basket.add', state.basket.add);
    var normalizedInput = validateBasketAddInput(input || randomCandidate());
    try {
      log('basket.add input', normalizedInput);
      var result = validateBasketAddResult(await state.basket.add(normalizedInput));
      log('basket.add result', result);
      return result;
    } catch (exception) {
      if (!exception || !exception.code) error('BASKET_ADD_FAILED', 'basket.add failed', exception);
      throw exception;
    }
  }

  async function callCustomerProvided(payload) {
    state.calls.customerProvided += 1;
    requireHandler('customerProvided', state.customerProvided);
    var cleanPayload = validateCustomerProvidedPayload(payload);
    try {
      var result = await state.customerProvided(cleanPayload);
      if (result !== undefined && (!isPlainObject(result) || result.ok !== true)) {
        fail('INVALID_CUSTOMER_PROVIDED_RESULT', 'customerProvided should resolve to { ok: true } when returning a value', { result: result });
      }
      log('customerProvided result', result);
      return result;
    } catch (exception) {
      if (!exception || !exception.code) error('CUSTOMER_PROVIDED_FAILED', 'customerProvided failed', exception);
      throw exception;
    }
  }

  function startGetPolling() {
    stopGetPolling();
    var interval = Number(state.qa.getIntervalMs);
    if (!Number.isFinite(interval) || interval <= 0) return;
    state.getTimer = window.setInterval(function () {
      callBasketGet().catch(function () {});
    }, interval);
    log('basket.get polling started every ' + interval + 'ms');
  }

  function stopGetPolling() {
    if (state.getTimer) window.clearInterval(state.getTimer);
    state.getTimer = null;
  }

  function startAutoAdd() {
    stopAutoAdd();
    var interval = Number(state.qa.autoAddIntervalMs || 0);
    if (!Number.isFinite(interval) || interval <= 0) return;
    state.addTimer = window.setInterval(function () {
      callBasketAdd().catch(function () {});
    }, interval);
    log('automatic basket.add started every ' + interval + 'ms');
  }

  function stopAutoAdd() {
    if (state.addTimer) window.clearInterval(state.addTimer);
    state.addTimer = null;
  }

  function restartTimers() {
    if (state.qa.autoStartGetPolling === false) stopGetPolling();
    else startGetPolling();
    startAutoAdd();
  }

  function publicState() {
    return {
      version: VERSION,
      hasBasketGet: typeof state.basket.get === 'function',
      hasBasketAdd: typeof state.basket.add === 'function',
      hasCustomerProvided: typeof state.customerProvided === 'function',
      customer: clone(state.customer),
      addCandidateCount: candidates().length,
      getPolling: Boolean(state.getTimer),
      autoAdd: Boolean(state.addTimer),
      calls: clone(state.calls),
      errors: state.errors.slice(),
      lastBasket: clone(state.lastBasket),
    };
  }

  function replayQueuedCalls() {
    queuedCalls.forEach(function (entry, index) {
      if (Array.isArray(entry)) {
        if (entry[0] === 'configure') return configure(entry[1]);
        if (entry[0] === 'identifyUser') return identifyUser(entry[1]);
      }
      if (isPlainObject(entry)) {
        if (entry.type === 'configure') return configure(entry.config || entry.patch);
        if (entry.type === 'identifyUser') return identifyUser(entry.customer);
      }
      fail('INVALID_QUEUE_ENTRY', 'Unsupported pre-load queue entry', { index: index, entry: entry });
    });
  }

  existingApi.configure = configure;
  existingApi.identifyUser = identifyUser;
  existingApi._q = [];
  existingApi.qaStub = {
    state: publicState,
    get: callBasketGet,
    add: callBasketAdd,
    addRandom: function () { return callBasketAdd(); },
    customerProvided: callCustomerProvided,
    candidates: candidates,
    startGetPolling: startGetPolling,
    stopGetPolling: stopGetPolling,
    startAutoAdd: startAutoAdd,
    stopAutoAdd: stopAutoAdd,
  };

  window.waybeam = existingApi;
  if (state.qa.exposeDebugApi !== false) window.waybeamQaStub = existingApi.qaStub;

  replayQueuedCalls();
  restartTimers();
  log('installed. Try window.waybeamQaStub.state(), .get(), .addRandom(), .add(input).', publicState());
})(window);
