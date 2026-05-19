import { Link } from 'react-router-dom';
import { useState } from 'react';

const roles = [
  { icon: '🎭', title: '卡司 / DM', desc: '展示档期和作品，让玩家找到你' },
  { icon: '⭐', title: 'Coser', desc: '接委托、经营粉丝、展示正片' },
  { icon: '📸', title: '摄影师', desc: '展示作品集、接受约拍委托' },
  { icon: '💄', title: '妆造师', desc: '让妆造作品被更多人看见' },
];

const steps = [
  { n: '01', icon: '🏠', title: '创建主页', desc: '手机号注册，填写个人资料，上传作品集' },
  { n: '02', icon: '⚡', title: '设置服务与档期', desc: '标出你可接的服务类型、价格范围和可约时间' },
  { n: '03', icon: '🚀', title: '分享给粉丝', desc: '把主页链接分享到微信、小红书、B站' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="bg-cream">
      {/* =============================================== */}
      {/* HERO — 深色渐变 + 金色光泽 */}
      {/* =============================================== */}
      <section className="relative overflow-hidden bg-hero-dark">
        {/* 装饰：金色圆点纹理 */}
        <div className="absolute inset-0 opacity-[0.04] bg-dot-pattern" />

        {/* 装饰：大圆弧光晕 */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-gradient-to-bl from-gold-500/8 via-gold-400/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-ink-600/20 via-ink-500/5 to-transparent blur-3xl" />

        {/* 装饰圈 */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full border border-gold-400/8" />
        <div className="absolute -bottom-32 -left-32 w-[350px] h-[350px] rounded-full border border-gold-400/5" />

        <div className="relative px-6 sm:px-12 lg:px-20 xl:px-28 pt-36 sm:pt-44 lg:pt-52 pb-32 sm:pb-40">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-14">
              <div className="max-w-[860px]">
                {/* 小标签 */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-xs text-gold-300/80 mb-8 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-shimmer" />
                  创作者专属主页平台
                </div>

                <h1 className="font-serif text-[3rem] sm:text-[4.5rem] lg:text-[5.5rem] xl:text-[6.5rem] font-black leading-[1.05] tracking-tight text-white fade-in-up">
                  让每个把纸片人
                  <br />
                  <span className="gradient-text">带到现实的人</span>
                  <br />
                  都被看见
                </h1>

                <p className="text-white/45 text-lg sm:text-xl lg:text-2xl mt-8 max-w-[600px] leading-relaxed fade-in-up delay-200">
                  灵契是泛二次元创作者的专属主页平台。
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 fade-in-up delay-400">
              <Link to="/explore"
                className="btn-gold text-center px-10 py-4 text-base font-medium shadow-lg shadow-gold-500/25">
                发现创作者
              </Link>
              <Link to="/login"
                className="btn-glass text-center px-10 py-4 text-base">
                免费创建主页
              </Link>
            </div>

            {/* 底部数据展示 */}
            <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 fade-in-up delay-500">
              {[
                { value: '卡司/DM', label: '演绎者' },
                { value: 'Coser', label: '角色扮演者' },
                { value: '摄影师', label: '视觉创作者' },
                { value: '妆造师', label: '造型艺术家' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-gold-400/80 text-sm font-medium">{item.value}</div>
                  <div className="text-white/25 text-xs mt-1.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部渐变过渡 */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-cream to-transparent" />
      </section>

      {/* =============================================== */}
      {/* FEATURES — 角色卡片 (玻璃态) */}
      {/* =============================================== */}
      <section className="bg-section-light px-6 sm:px-12 lg:px-20 xl:px-28 py-28 lg:py-36">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-gold-500 tracking-[0.2em] uppercase fade-in-up">
              适合这样的你
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-ink-800 mt-4 fade-in-up delay-100">
              无论你是卡司、Coser、摄影师还是妆造师
            </h2>
            <div className="gold-line mx-auto mt-6" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {roles.map(({ icon, title, desc }, i) => (
              <div key={title}
                className="glass-card glass-card-hover rounded-[1.25rem] p-7 text-center"
                style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
              >
                <div className="text-5xl mb-5">{icon}</div>
                <h3 className="text-lg font-bold text-ink-800 mb-2.5">{title}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* STEPS — 三列流程 (玻璃态) */}
      {/* =============================================== */}
      <section className="relative bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 sm:px-12 lg:px-20 xl:px-28 py-28 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-dot-pattern" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-gold-400/5 to-transparent blur-3xl" />

        <div className="relative max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-gold-400 tracking-[0.2em] uppercase">三步开始</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white mt-4">
              创建你的灵契主页
            </h2>
            <div className="gold-line mx-auto mt-6 opacity-50" />
          </div>

          <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
            {steps.map(({ n, icon, title, desc }, i) => (
              <div key={n} className="text-center relative">
                {i < 2 && (
                  <div className="hidden sm:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-gold-400/30 to-gold-400/10" />
                )}
                <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5 shadow-lg shadow-gold-500/20">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5">{title}</h3>
                <p className="text-sm text-ink-200/70 leading-relaxed max-w-[240px] mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* DIFFERENTIATOR — 差异化特点 (参考剧掌柜) */}
      {/* =============================================== */}
      <section className="px-6 sm:px-12 lg:px-20 xl:px-28 py-28 lg:py-36">
        <div className="max-w-[1200px] mx-auto">
          <div className="bg-gradient-to-br from-ink-900/5 via-ink-800/3 to-gold-100/50 rounded-[2rem] p-10 lg:p-14 border border-gold-200/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-gradient-to-bl from-gold-200/20 to-transparent blur-2xl" />

            <div className="relative">
              <div className="text-center mb-14">
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink-800">不只是个人主页</h2>
                <div className="gold-line mx-auto mt-4" />
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { icon: '🎯', title: '创作者经济', desc: '卡司展示作品、接委托、管理档期，让才华变成收入' },
                  { icon: '🔗', title: '与剧掌柜打通', desc: '档期自动同步、粉丝约期直达排班系统，生态联动' },
                  { icon: '💎', title: '粉丝连接', desc: '粉丝发现喜欢的创作者、预约档期、建立直接联系' },
                ].map((item, i) => (
                  <div key={item.title} className="text-center fade-in-up" style={{ animationDelay: `${i * 0.15}s` }}>
                    <div className="text-4xl mb-4">{item.icon}</div>
                    <h3 className="text-lg font-bold text-ink-800 mb-2.5">{item.title}</h3>
                    <p className="text-sm text-ink-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* CTA — 深色底终极召唤 */}
      {/* =============================================== */}
      <section className="bg-hero-dark relative overflow-hidden px-6 sm:px-12 lg:px-20 xl:px-28">
        <div className="absolute inset-0 opacity-[0.04] bg-dot-pattern" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-t from-gold-500/8 to-transparent blur-3xl" />

        <div className="relative max-w-[1000px] mx-auto py-32 lg:py-40 text-center">
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 fade-in-up">
            准备好被看见了吗？
          </h2>
          <p className="text-ink-200/60 text-lg sm:text-xl mb-12 max-w-md mx-auto fade-in-up delay-200">
            创建你的专属主页，让粉丝一键找到你
          </p>
          <Link to="/login"
            className="btn-gold inline-block px-14 py-4.5 text-lg font-medium shadow-xl shadow-gold-500/30 fade-in-up delay-400">
            立即免费创建
          </Link>
        </div>
      </section>

      {/* =============================================== */}
      {/* NEWSLETTER */}
      {/* =============================================== */}
      <section className="px-6 py-24 max-w-[480px] mx-auto text-center">
        <p className="text-xs font-semibold text-gold-500 tracking-[0.2em] uppercase mb-3">保持联系</p>
        <p className="text-sm text-ink-400 mb-6">订阅灵契更新，第一时间知道新功能上线</p>
        <div className="flex gap-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="输入你的邮箱"
            className="flex-1 px-5 py-3 input-enhanced rounded-[0.75rem] text-sm text-ink-700 placeholder:text-ink-300 bg-cream" />
          <button onClick={() => { if (email) setSubscribed(true); }}
            className="btn-dark px-7 py-3 text-sm rounded-[0.75rem] shrink-0">
            {subscribed ? '已订阅 ✓' : '订阅'}
          </button>
        </div>
        {subscribed && <p className="text-sm text-gold-600 mt-4 fade-in-up">感谢订阅！新消息会发送到你的邮箱</p>}
      </section>

      {/* =============================================== */}
      {/* FOOTER */}
      {/* =============================================== */}
      <footer className="border-t border-gold-200/30 bg-cream px-6 sm:px-12 lg:px-20 xl:px-28 py-10">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-300">
          <span className="font-serif font-bold gradient-text text-lg">灵契</span>
          <span>让每个把纸片人带到现实的人都被看见</span>
        </div>
      </footer>
    </div>
  );
}
