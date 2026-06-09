App({
  globalData: {
    apiBase: 'https://lingqi.jusichen.com/api'
  },

  onLaunch() {
    const auth = wx.getStorageSync('lc_auth');
    this.globalData.auth = auth || null;
  }
});
