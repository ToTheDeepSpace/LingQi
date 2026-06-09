const { request } = require('../../utils/api');

Page({
  data: {
    type: 'all',
    items: [],
    loading: false,
    error: '',
    typeText: { red: '红榜', black: '黑榜', white: '白榜' }
  },

  onShow() {
    this.load();
  },

  setType(event) {
    const type = event.currentTarget.dataset.type || 'all';
    this.setData({ type });
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const qs = this.data.type === 'all' ? '' : `?type=${this.data.type}`;
      const items = await request(`/lc/rankings${qs}`);
      this.setData({ items: items || [] });
    } catch (error) {
      this.setData({ error: error.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
