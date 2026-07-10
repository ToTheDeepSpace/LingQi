const API_BASE = 'https://jumulu.jusichen.com/api';

function getAuth() {
  return wx.getStorageSync('lc_auth') || null;
}

function setAuth(auth) {
  wx.setStorageSync('lc_auth', auth);
}

function clearAuth() {
  wx.removeStorageSync('lc_auth');
}

function request(path, options = {}) {
  const auth = getAuth();
  const headers = Object.assign({
    'content-type': 'application/json'
  }, options.headers || {});
  if (auth && auth.token) headers.Authorization = `Bearer ${auth.token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: headers,
      success(res) {
        const body = res.data || {};
        if (body.success) resolve(body.data);
        else reject(new Error(body.error || `请求失败 ${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络错误'));
      }
    });
  });
}

function formatDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

module.exports = {
  API_BASE,
  getAuth,
  setAuth,
  clearAuth,
  request,
  formatDate
};
