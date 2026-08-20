/* api.js — talks to the PHP backend under /api.
   Identity (sign-up, sign-in, password) lives on the server. Orders and points
   are still per-device until the loyalty rules are settled. */
(function (CC) {
  'use strict';

  var TOKEN_KEY = 'cc.v2.token';

  /* Relative, so the same build works on codeconceptcafe.com, on a staging
     copy, and in a subfolder without a rebuild. */
  function base() {
    var path = location.pathname.replace(/[^\/]*$/, '');
    return path + 'api/';
  }

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode */ }
  }

  /**
   * Resolves with the parsed body on success.
   * Rejects with { error, message, status, ... } — always shaped, never raw.
   */
  function request(route, body, method) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    var opts = {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'Accept': 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var t = token();
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;

    return fetch(base() + route, opts)
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!data) {
            // Almost always the API folder missing, or PHP returning HTML.
            throw { error: 'bad_response', status: res.status,
                    message: 'The server did not answer properly. Try again in a moment.' };
          }
          if (!res.ok || data.ok === false) {
            throw {
              error: data.error || 'request_failed',
              message: data.message || 'Something went wrong.',
              status: res.status,
              retry_after: data.retry_after,
              attempts_left: data.attempts_left
            };
          }
          return data;
        });
      })
      .catch(function (e) {
        if (e && e.error) throw e;
        throw {
          error: e && e.name === 'AbortError' ? 'timeout' : 'offline',
          message: e && e.name === 'AbortError'
            ? 'That took too long. Check your connection and try again.'
            : 'No connection to the server. Check your internet and try again.'
        };
      })
      .then(function (v) { clearTimeout(timer); return v; },
            function (e) { clearTimeout(timer); throw e; });
  }

  CC.Api = {
    token: token,
    setToken: setToken,
    signedIn: function () { return !!token(); },

    health:      function () { return request('health', null, 'GET'); },
    requestCode: function (phone, purpose) { return request('otp/request', { phone: phone, purpose: purpose || 'signup' }); },
    verifyCode:  function (phone, code, purpose) { return request('otp/verify', { phone: phone, code: code, purpose: purpose || 'signup' }); },

    createAccount: function (phone, ticket, name, password) {
      return request('account/create', { phone: phone, ticket: ticket, name: name, password: password })
        .then(function (d) { setToken(d.token); return d; });
    },
    login: function (phone, password) {
      return request('account/login', { phone: phone, password: password })
        .then(function (d) { setToken(d.token); return d; });
    },
    resetPassword: function (phone, ticket, password) {
      return request('account/reset', { phone: phone, ticket: ticket, password: password })
        .then(function (d) { setToken(d.token); return d; });
    },
    me:     function () { return request('account/me', null, 'GET'); },
    logout: function () {
      var p = token() ? request('account/logout', {}) : Promise.resolve({ ok: true });
      return p.catch(function () { return { ok: true }; })
              .then(function (r) { setToken(''); return r; });
    }
  };
})(window.CC = window.CC || {});
