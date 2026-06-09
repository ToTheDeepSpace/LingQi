const { getAuth, setAuth, clearAuth, request } = require('../../utils/api');

Page({
  data: {
    auth: null,
    displayName: '',
    loading: false,
    error: ''
  },

  onShow() {
    this.setData({ auth: getAuth() });
  },

  onNameInput(event) {
    this.setData({ displayName: event.detail.value || '' });
  },

  login() {
    if (!this.data.displayName.trim()) {
      this.setData({ error: '请先填写一个昵称' });
      return;
    }
    this.setData({ loading: true, error: '' });
    wx.login({
      success: async (result) => {
        try {
          if (!result.code) throw new Error('微信登录 code 获取失败');
          const auth = await request('/lc/miniapp/auth/wechat', {
            method: 'POST',
            data: {
              code: result.code,
              displayName: this.data.displayName.trim()
            }
          });
          setAuth(auth);
          this.setData({ auth, displayName: '', error: '' });
        } catch (error) {
          this.setData({ error: error.message || '微信登录失败' });
        } finally {
          this.setData({ loading: false });
        }
      },
      fail: () => {
        this.setData({ loading: false, error: '微信登录失败' });
      }
    });
  },

  logout() {
    clearAuth();
    this.setData({ auth: null });
  }
});
