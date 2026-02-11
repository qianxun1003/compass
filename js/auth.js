/**
 * 认证工具：Token、登录校验、API 请求头
 * 所有需要登录的页面在加载时调用 requireAuth()，未登录则跳转 login.html
 */
(function(global) {
    var TOKEN_KEY = 'token';
    var USER_KEY = 'user';

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

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    /**
     * 要求已登录；未登录则跳转到 login.html，并保存当前 URL 到 returnUrl 以便登录后返回
     */
    function requireAuth() {
        if (!getToken()) {
            var returnUrl = window.location.pathname + window.location.search;
            if (returnUrl && returnUrl !== '/' && returnUrl !== '/index.html') {
                try { sessionStorage.setItem('returnUrl', returnUrl); } catch (e) {}
            }
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * 获取 API 请求的 headers（包含 Authorization: Bearer <token>）
     */
    function authHeaders(extra) {
        var h = { 'Content-Type': 'application/json' };
        var t = getToken();
        if (t) h['Authorization'] = 'Bearer ' + t;
        if (extra) {
            for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
        }
        return h;
    }

    /**
     * API 根路径。同源（例如 http://localhost:3000 或 Render 部署域）时为空字符串；
     * 用 file:// 打开页面或非 3000 端口时返回 http://localhost:3000，便于本地测试。
     */
    function getApiBase() {
        if (typeof window === 'undefined' || !window.location) return '';
        var p = window.location.protocol, h = window.location.hostname, port = window.location.port || (p === 'https:' ? '443' : '80');
        if (p === 'file:') return 'http://localhost:3000';
        if (h === 'localhost' && port !== '3000') return 'http://localhost:3000';
        return '';
    }

    global.Auth = {
        getToken: getToken,
        setToken: setToken,
        setUser: setUser,
        getUser: getUser,
        clearToken: clearToken,
        requireAuth: requireAuth,
        authHeaders: authHeaders,
        getApiBase: getApiBase
    };
})(typeof window !== 'undefined' ? window : this);
