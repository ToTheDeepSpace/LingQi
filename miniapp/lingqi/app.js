App({
  globalData: {
    apiBase: 'https://jumulu.jusichen.com/api'
  },

  onLaunch() {
    const auth = wx.getStorageSync('lc_auth');
    this.globalData.auth = auth || null;
  }
});
