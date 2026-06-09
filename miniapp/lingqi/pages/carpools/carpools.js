const { request } = require('../../utils/api');

Page({
  data: {
    items: [],
    loading: false,
    error: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const items = await request('/lc/carpools');
      this.setData({ items: items || [] });
    } catch (error) {
      this.setData({ error: error.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
