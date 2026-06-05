import { Link } from 'react-router-dom';

const classes = [
  { icon: '🌙', role: '灵契师',   sub: 'LINGQI-SHI',    desc: '与虚拟人签订契约，让其借由自身短暂降临现实。展示作品与口碑，让委托人一眼找到你。', accent: '#a78bfa' },
  { icon: '✨', role: '委托人',   sub: 'PATRON',         desc: '为一次陪伴、一场相遇、一个心愿发起委托，找到能够承接这份灵契的人。', accent: '#e879f9' },
  { icon: '🛠️', role: '配套服务', sub: 'SUPPORT GUILD',  desc: '让每一次灵契更完整的幕后力量：摄影师定格瞬间、妆造师雕琢形态、服装商提供华服、道具师定制专属道具。', accent: '#38bdf8' },
];

const features = [
  { icon: '🔮', title: '找到对的那个灵契师',   desc: '不再靠转发、靠缘分。按角色、风格、档期筛选，看口碑，直接预约。让委托从"到处问"变成"来这里找"。' },
  { icon: '🪪', title: '灵契师的全部，一个主页', desc: '作品集、开本记录、可约档期、联系方式——分享一个链接，就是你的完整名片。' },
  { icon: '🎭', title: '配套一站到位',          desc: '约定灵契师的同时，顺手预约摄影师、妆造师——好不容易委托了，何不一步到位。' },
];

const steps = [
  { n: '01', title: '描述你的委托', desc: '写下你想见到的角色、场景与情绪，让灵契师了解你的期待' },
  { n: '02', title: '寻找你的灵契师', desc: '浏览灵契师主页，查看作品与口碑，找到那个能将角色真实带来的人' },
  { n: '03', title: '见证一次降临', desc: '与灵契师、摄影师、妆造师一起，完成这场跨越次元的相遇' },
];

const playerPraise = [
  { n: '01', title: '愿意把时间交给故事', desc: '认真赴约、认真倾听、认真进入角色，本身就是一种很稀缺的温柔。' },
  { n: '02', title: '愿意照顾同桌体验', desc: '好的玩家不只是想赢，也会接住别人的表达、保护秘密、让每个人都有戏。' },
  { n: '03', title: '愿意在虚构里练习真实', desc: '我们在剧本里经历误会、选择、告别和和解，也会把这些带回现实生活。' },
];

const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const WARM_BG = '#f7efe3';
const WARM_CARD = '#fffaf2';
const WARM_TEXT = '#1f2937';
const WARM_SUB = 'rgba(71,85,105,0.72)';

export default function Home() {
  return (
    <div style={{ backgroundColor: C, color: INK }}>

      {/* ───────────── HERO ───────────── */}
      <section className="home-hero">

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(217,168,87,0.18) 0%, rgba(85,135,186,0.08) 42%, transparent 72%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 50% 40%, rgba(255,255,255,0.72) 0%, transparent 100%)', pointerEvents: 'none' }} />

        <div className="home-hero-inner">

          <div className="home-hero-badge">
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD }} />
            灵契师与委托人的连接之所
          </div>

          <h1 className="home-hero-title">
            让虚拟人<br />
            短暂降临现实<br />
            <span className="gradient-text-gold">此之谓灵契</span>
          </h1>

          <p className="home-hero-lead">
            灵契师，是与虚拟人签订契约的人：让角色借由自己附身片刻，陪委托人走过一段真实时间。
          </p>
          <p className="home-hero-subcopy">
            灵契，是这份契约，也是这场降临。这里会成为委托人寻找灵契师时首先想到的地方。
          </p>

          <div className="home-entry-grid">
            <Link to="/explore" className="btn-gold home-entry-link">
              浏览灵契师
            </Link>
            <Link to="/login" className="btn-glass home-entry-link">
              灵契师入驻
            </Link>
            <Link to="/rankings" className="home-entry-link home-entry-red">
              红黑榜口碑
            </Link>
            <Link to="/carpools" className="home-entry-link home-entry-blue">
              拼车区
            </Link>
          </div>

          <p className="home-hero-note">
            注册即用 · 发布内容人工审核 · 认真玩本的人值得被看见
          </p>
        </div>
      </section>

      {/* ───────────── 夸一夸来玩本的人 ───────────── */}
      <section style={{ backgroundColor: '#f8fbff', padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(39,83,137,0.62)', marginBottom: 12 }}>写给玩家</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.7rem, 4vw, 2.5rem)', marginBottom: 16, color: INK }}>认真玩本的人，值得被看见</h2>
            <p style={{ color: MUTED, lineHeight: 1.9, fontSize: '1rem', maxWidth: 680, margin: '0 auto' }}>
              能坐下来听一个故事、相信一次角色、照顾一桌人的情绪和节奏，这不是一件小事。通过剧本杀，我们认识别人，也认识更好的自己。这样的人值得被好好夸一夸。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {playerPraise.map(({ n, title, desc }) => (
              <article key={n} style={{ background: '#fff', border: '1px solid rgba(39,83,137,0.14)', borderRadius: 16, padding: '22px 20px', boxShadow: '0 14px 32px rgba(31,41,55,0.05)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(238,246,255,0.95)', color: '#275389', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem', marginBottom: 14 }}>{n}</div>
                <h3 style={{ margin: '0 0 9px', color: INK, fontSize: '1rem', fontWeight: 800 }}>{title}</h3>
                <p style={{ margin: 0, color: 'rgba(71,85,105,0.74)', lineHeight: 1.75, fontSize: '0.86rem' }}>{desc}</p>
              </article>
            ))}
          </div>

          <p style={{ margin: '22px auto 0', maxWidth: 760, color: 'rgba(71,85,105,0.72)', fontSize: '0.92rem', lineHeight: 1.85, textAlign: 'center' }}>
            灵契希望记录的不只是推荐和避坑，也包括玩家之间慢慢长出来的默契：守时、守密、有边界感、会沟通、愿意共情。这些礼仪从剧本杀开始，也可以回到所有真实社交里。
          </p>
        </div>
      </section>

      {/* ───────────── 这里能找到谁 ───────────── */}
      <section style={{ backgroundColor: C, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.7)', marginBottom: 12 }}>灵契师名片</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>这里能找到谁</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {classes.map(({ icon, role, sub, desc, accent }) => (
              <div key={role} style={{ backgroundColor: '#fff', border: '1px solid rgba(201,146,46,0.16)', borderRadius: 16, padding: '28px 20px', textAlign: 'center', transition: 'transform 0.2s, box-shadow 0.2s', borderTop: `3px solid ${accent}`, boxShadow: '0 12px 32px rgba(31,41,55,0.06)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${accent}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(31,41,55,0.06)'; }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', color: INK, marginBottom: 4 }}>{role}</h3>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, opacity: 0.7, marginBottom: 10 }}>{sub}</p>
                <p style={{ fontSize: '0.8rem', color: MUTED, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 为什么选灵契 ───────────── */}
      <section style={{ padding: '5rem 1.25rem', background: `linear-gradient(180deg, ${C} 0%, ${WARM_BG} 18%, #eef6ff 68%, ${C} 100%)` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.65)', marginBottom: 12 }}>为什么选择灵契</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16, color: WARM_TEXT }}>不只是个人主页</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
            {features.map(({ icon, title, desc }) => (
              <div key={title} style={{ textAlign: 'center', backgroundColor: WARM_CARD, borderRadius: 16, padding: '28px 20px', border: '1px solid rgba(201,146,46,0.16)', boxShadow: '0 14px 36px rgba(31,41,55,0.06)' }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', color: WARM_TEXT, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: '0.82rem', color: WARM_SUB, lineHeight: 1.8 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 红黑榜 ───────────── */}
      <section style={{ backgroundColor: C, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c0392b', marginBottom: 12 }}>一人一票 · 真实口碑</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>红黑榜</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <p style={{ fontSize: '1rem', color: MUTED, lineHeight: 1.85, maxWidth: 600, margin: '0 auto 36px' }}>
            店、灵契师、卡司、玩家、外卖——五类红黑榜，用真金白银投票。<br />
            每条评价都经过人工审核，实名发布带星标。黑榜公开期结束后，也可以去标识化沉淀为共性问题和社交礼仪。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[              
              { icon: '🏪', label: '店家榜', desc: '店面环境、服务质量、管理水平' },
              { icon: '🥡', label: '外卖榜', desc: '出餐速度、包装份量、踩雷记录' },
              { icon: '🎭', label: '玩家榜', desc: '素质、迟到率、历史评价' },
              { icon: '🎬', label: '卡司榜', desc: '带本水平、演绎能力、控场能力' },
              { icon: '🌙', label: '委托师榜', desc: '还原度、陪伴体验、专业程度' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ padding: '22px 16px', borderRadius: 14, border: '1px solid rgba(192,57,43,0.18)', background: 'linear-gradient(180deg, rgba(254,242,242,0.9), rgba(255,255,255,0.92))', textAlign: 'center', boxShadow: '0 10px 28px rgba(31,41,55,0.05)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.92rem', color: INK, marginBottom: 6 }}>{label}</h3>
                <p style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.68)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          <Link to="/rankings" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 10,
            background: 'linear-gradient(135deg, #c0392b 0%, #a93226 100%)',
            color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem',
            boxShadow: '0 4px 20px rgba(192,57,43,0.3)',
            transition: 'all 0.3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(192,57,43,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(192,57,43,0.3)'; }}>
            进入红黑榜
          </Link>
        </div>
      </section>

      {/* ───────────── 三步完成委托 ───────────── */}
      <section style={{ backgroundColor: C2, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.7)', marginBottom: 12 }}>委托流程</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>三步，完成你的委托</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
            {steps.map(({ n, title, desc }) => (
              <div key={n} style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: INK, fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: `0 4px 20px rgba(201,146,46,0.22)` }}>{n}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: INK, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: '0.8rem', color: MUTED, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CTA ───────────── */}
      <section style={{ padding: '5rem 1.25rem', background: `linear-gradient(135deg, #eef6ff 0%, ${C} 50%, #fff7ed 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(201,146,46,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)', marginBottom: 16, lineHeight: 1.2 }}>开始你的灵契之旅</h2>
          <p style={{ color: MUTED, fontSize: '1.05rem', marginBottom: 36, lineHeight: 1.8 }}>无论你是委托人，还是灵契师——这里都为这场契约留好了入口。</p>
          <Link to="/explore" className="btn-gold" style={{ display: 'inline-block', padding: '14px 48px', fontSize: '1rem', fontWeight: 600 }}>
            浏览灵契师
          </Link>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer style={{ backgroundColor: C, borderTop: '1px solid rgba(201,146,46,0.16)', padding: '2.5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', color: 'rgba(71,85,105,0.66)', fontSize: '0.875rem' }}>
          <span className="gradient-text-gold" style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem' }}>灵契</span>
          <span>与虚拟人签订契约，让其借由灵契师短暂附身并降临现实，此之谓灵契</span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/explore" style={{ color: 'rgba(39,83,137,0.78)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>浏览灵契师</Link>
            <Link to="/commissions" style={{ color: 'rgba(39,83,137,0.78)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>委托需求</Link>
            <Link to="/rankings" style={{ color: 'rgba(39,83,137,0.78)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>红黑榜</Link>
            <Link to="/login" style={{ color: 'rgba(39,83,137,0.78)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = GOLD)} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>入驻</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
