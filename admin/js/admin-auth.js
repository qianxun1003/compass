/**
 * 管理员后台认证：独立 token/user 存储，避免与普通用户登录冲突
 */
(function (global) {
  var TOKEN_KEY = 'adminToken';
  var USER_KEY = 'adminUser';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function setUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearAdminAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function requireAdmin() {
    if (!getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  function authHeaders(extra) {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    if (extra) {
      for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
    }
    return h;
  }

  function getApiBase() {
    if (typeof window === 'undefined' || !window.location) return '';
    var p = window.location.protocol,
      h = window.location.hostname,
      port = window.location.port || (p === 'https:' ? '443' : '80');
    if (p === 'file:') return 'http://localhost:3000';
    if (h === 'localhost' && port !== '3000') return 'http://localhost:3000';
    return '';
  }

  global.AdminAuth = {
    getToken: getToken,
    setToken: setToken,
    setUser: setUser,
    getUser: getUser,
    clearAdminAuth: clearAdminAuth,
    requireAdmin: requireAdmin,
    authHeaders: authHeaders,
    getApiBase: getApiBase,
  };
})(typeof window !== 'undefined' ? window : this);
