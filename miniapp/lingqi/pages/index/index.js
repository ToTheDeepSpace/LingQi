Page({
  goRankings() { wx.switchTab({ url: '/pages/rankings/rankings' }); },
  goCarpools() { wx.switchTab({ url: '/pages/carpools/carpools' }); },
  goCommissions() { wx.switchTab({ url: '/pages/commissions/commissions' }); },
  goMine() { wx.switchTab({ url: '/pages/mine/mine' }); }
});
