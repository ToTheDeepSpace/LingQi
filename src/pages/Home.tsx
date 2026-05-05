import { Link } from 'react-router-dom';
import { useState } from 'react';

const roles = [
  { icon: 'M7 20h10M12 4v16M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7', title: '卡司 / DM', desc: '展示档期和作品，让玩家找到你' },
  { icon: 'M12 2l3 7h7l-5.5 4L18 21l-6-4.5L6 21l1.5-8L2 9h7z', title: 'Coser', desc: '接委托、经营粉丝、展示正片' },
  { icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-1l-2-3H8L6 5H5a2 2 0 00-2 2z M15 13a3 3 0 11-6 0 3 3 0 016 0z', title: '摄影师', desc: '展示作品集、接受约拍委托' },
  { icon: 'M20 14l-6 6M3 10l6-6M9 4h6M9 20h6M4 9v6M20 15v-6', title: '妆造师', desc: '让妆造作品被更多人看见' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="bg-cream">
      {/* =============================================== */}
      {/* HERO — 深色底 + 金色游水渐变标题 */}
      {/* =============================================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700">
        {/* 装饰：金色圆点纹理 */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #d9a857 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        {/* 装饰：大圆弧 */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full border border-gold-400/10" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full border border-gold-400/5" />

        <div className="relative px-6 sm:px-12 lg:px-20 xl:px-28 pt-32 sm:pt-40 lg:pt-48 pb-28 sm:pb-36">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14">
              <div className="max-w-[800px]">
                <div className="w-12 h-[2px] bg-gold-400 mb-8" />
                <h1 className="font-serif text-[2.8rem] sm:text-[4rem] lg:text-[5.5rem] xl:text-[6.5rem] font-black leading-[1.05] tracking-tight text-white">
                  让每个把纸片人
                  <br />
                  <span className="text-gold-water">带到现实的人</span>
                  <br />
                  都被看见
                </h1>
              </div>
              <p className="text-white/50 text-base sm:text-lg lg:text-xl max-w-[360px] leading-relaxed shrink-0">
                灵契是泛二次元创作者的专属主页平台。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/explore"
                className="text-center px-8 py-3.5 bg-gold-500 text-white text-base font-medium rounded-[0.75rem] hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20">
                发现创作者
              </Link>
              <Link to="/login"
                className="text-center px-8 py-3.5 border border-white/20 text-white/80 text-base font-medium rounded-[0.75rem] hover:border-white/40 hover:text-white transition-colors">
                免费创建主页
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* FEATURES — 浅底 + 角色卡片 */}
      {/* =============================================== */}
      <section className="bg-cream px-6 sm:px-12 lg:px-20 xl:px-28 py-24 lg:py-32">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-16">
            <p className="text-xs font-semibold text-gold-500 tracking-[0.2em] uppercase">适合这样的你</p>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink-800 mt-3 max-w-[600px]">
              无论你是卡司、Coser、摄影师还是妆造师
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {roles.map(({ icon, title, desc }, i) => (
              <div key={title}
                className="group relative bg-warm-white rounded-[1rem] p-6 sm:p-7 border border-gold-200/30 transition-all duration-300 hover:border-gold-300/60 hover:shadow-elevated"
                style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-[0.75rem] bg-gold-50 flex items-center justify-center mb-5 group-hover:bg-gold-100 transition-colors">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold-600">
                    <path d={icon} />
                  </svg>
                </div>
                <div className="text-base font-semibold text-ink-800 mb-2">{title}</div>
                <div className="text-sm text-ink-400 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* STEPS — 三列流程 */}
      {/* =============================================== */}
      <section className="bg-ink-50/60 px-6 sm:px-12 lg:px-20 xl:px-28 py-24 lg:py-32">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-gold-500 tracking-[0.2em] uppercase">三步开始</p>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink-800 mt-3">
              创建你的灵契主页
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
            {[
              { n: '01', title: '创建主页', desc: '手机号注册，填写个人资料，上传作品集' },
              { n: '02', title: '设置服务与档期', desc: '标出你可接的服务类型、价格范围和可约时间' },
              { n: '03', title: '分享给粉丝', desc: '把主页链接分享到微信、小红书、B站' },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className="text-center relative">
                {i < 2 && <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-px bg-gold-300/30" />}
                <div className="relative z-10 w-16 h-16 rounded-full bg-gold-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-5 font-serif shadow-md">
                  {n}
                </div>
                <div className="text-base font-semibold text-ink-800 mb-2">{title}</div>
                <div className="text-sm text-ink-400 leading-relaxed max-w-[240px] mx-auto">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =============================================== */}
      {/* CTA — 深色底 */}
      {/* =============================================== */}
      <section className="bg-ink-900 relative overflow-hidden px-6 sm:px-12 lg:px-20 xl:px-28">
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle, #d9a857 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative max-w-[1000px] mx-auto py-24 lg:py-32 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-gold-300 mb-5">准备好被看见了吗？</h2>
          <p className="text-ink-300/70 text-base sm:text-lg mb-10 max-w-sm mx-auto">创建你的专属主页，让粉丝一键找到你</p>
          <Link to="/login"
            className="inline-block px-12 py-4 bg-gold-500 text-white text-base font-medium rounded-[0.75rem] hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20">
            立即免费创建
          </Link>
        </div>
      </section>

      {/* =============================================== */}
      {/* NEWSLETTER */}
      {/* =============================================== */}
      <section className="px-6 py-20 max-w-[480px] mx-auto text-center">
        <p className="text-xs font-semibold text-gold-500 tracking-[0.2em] uppercase mb-3">保持联系</p>
        <p className="text-sm text-ink-400 mb-6">订阅灵契更新，第一时间知道新功能上线</p>
        <div className="flex gap-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="输入你的邮箱"
            className="flex-1 px-5 py-3 border border-gold-200 rounded-[0.75rem] text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 bg-cream" />
          <button onClick={() => { if (email) setSubscribed(true); }}
            className="px-6 py-3 bg-ink-800 text-warm-white text-sm font-medium rounded-[0.75rem] hover:bg-ink-700 transition-colors shrink-0">
            {subscribed ? '已订阅 ✓' : '订阅'}
          </button>
        </div>
        {subscribed && <p className="text-sm text-gold-600 mt-3">感谢订阅！新消息会发送到你的邮箱</p>}
      </section>

      {/* =============================================== */}
      {/* FOOTER */}
      {/* =============================================== */}
      <footer className="border-t border-gold-200/30 px-6 sm:px-12 lg:px-20 xl:px-28 py-8">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-300">
          <span className="font-serif font-bold text-gold-500 text-base">灵契</span>
          <span>让每个把纸片人带到现实的人都被看见</span>
        </div>
      </footer>
    </div>
  );
}
