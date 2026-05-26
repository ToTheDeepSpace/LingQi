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
  { n: '02', title: '寻找你的灵契师', desc: '浏览大厅，查看作品与口碑，找到那个能将角色真实带来的人' },
  { n: '03', title: '见证一次降临', desc: '与灵契师、摄影师、妆造师一起，完成这场跨越次元的相遇' },
];

const C = '#0F1117';
const C2 = '#1A1D27';
const GOLD = '#d9a857';
const WARM_BG = '#F5F3EE';
const WARM_TEXT = '#1a1d27';
const WARM_SUB = '#5a5d67';

export default function Home() {
  return (
    <div style={{ backgroundColor: C, color: '#fff' }}>

      {/* ───────────── HERO ───────────── */}
      <section style={{ minHeight: '100svh', backgroundColor: C, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '6rem 1.25rem 4rem' }}>

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(201,146,46,0.15) 0%, rgba(107,63,160,0.06) 40%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 50% 40%, rgba(255,255,255,0.04) 0%, transparent 100%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 700, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,146,46,0.25)', color: 'rgba(217,168,87,0.8)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 36 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD }} />
            灵契师与委托人的连接之所
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(2.2rem, 9vw, 5rem)', lineHeight: 1.1, letterSpacing: 0, marginBottom: 24, textAlign: 'center' }}>
            让虚拟人<br />
            短暂降临现实<br />
            <span className="gradient-text-gold">此之谓灵契</span>
          </h1>

          <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', color: 'rgba(245,243,238,0.85)', lineHeight: 1.8, marginBottom: 12, textAlign: 'center', maxWidth: 560 }}>
            灵契师，是与虚拟人签订契约的人：让角色借由自己附身片刻，陪委托人走过一段真实时间。
          </p>
          <p style={{ fontSize: 'clamp(0.85rem, 2vw, 1rem)', color: 'rgba(245,243,238,0.72)', lineHeight: 1.8, marginBottom: 36, textAlign: 'center', maxWidth: 560 }}>
            灵契，是这份契约，也是这场降临。这里会成为委托人寻找灵契师时首先想到的地方。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 360 }}>
            <Link to="/explore" className="btn-gold" style={{ width: '100%', display: 'block', padding: '14px 32px', textAlign: 'center', fontSize: '1rem', fontWeight: 600, letterSpacing: '0.03em' }}>
              ⚔ 寻觅灵契师
            </Link>
            <Link to="/login" className="btn-glass" style={{ width: '100%', display: 'block', padding: '14px 32px', textAlign: 'center', fontSize: '1rem' }}>
              我是灵契师，免费入驻
            </Link>
          </div>

          <p style={{ marginTop: 24, fontSize: 11, letterSpacing: '0.08em', color: 'rgba(245,243,238,0.55)', textAlign: 'center' }}>
            注册即用 · 发布内容人工审核 · 口碑长期沉淀
          </p>
        </div>
      </section>

      {/* ───────────── 大厅里有谁 ───────────── */}
      <section style={{ backgroundColor: C, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.7)', marginBottom: 12 }}>大厅告示板</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>大厅里有谁</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {classes.map(({ icon, role, sub, desc, accent }) => (
              <div key={role} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 20px', textAlign: 'center', transition: 'transform 0.2s, box-shadow 0.2s', borderTop: `3px solid ${accent}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${accent}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{role}</h3>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, opacity: 0.7, marginBottom: 10 }}>{sub}</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(245,243,238,0.72)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 为什么选灵契（暖色段） ───────────── */}
      <section style={{ backgroundColor: WARM_BG, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(146,95,24,0.7)', marginBottom: 12 }}>为什么选择灵契</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16, color: WARM_TEXT }}>不只是个人主页</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
            {features.map(({ icon, title, desc }) => (
              <div key={title} style={{ textAlign: 'center' }}>
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

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c0392b', marginBottom: 12 }}>口碑基础设施</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>红黑榜</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <p style={{ fontSize: '1rem', color: 'rgba(245,243,238,0.78)', lineHeight: 1.85, maxWidth: 600, margin: '0 auto 36px' }}>
            店、灵契师、玩家——三类红黑榜，用真金白银投票。<br />
            每条评价都经过人工审核，实名发布带星标。不是有钱就能删帖。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[
              { icon: '🏪', label: '店家榜', desc: '店面环境、服务质量、管理水平' },
              { icon: '🌙', label: '灵契师榜', desc: '还原度、陪伴体验、专业程度' },
              { icon: '🎭', label: '玩家榜', desc: '素质、迟到率、历史评价' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ padding: '22px 16px', borderRadius: 14, border: '1px solid rgba(192,57,43,0.18)', background: 'linear-gradient(180deg, rgba(192,57,43,0.08), rgba(255,255,255,0.03))', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', marginBottom: 6 }}>{label}</h3>
                <p style={{ fontSize: '0.78rem', color: 'rgba(245,243,238,0.62)', lineHeight: 1.6 }}>{desc}</p>
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
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: `0 4px 20px rgba(201,146,46,0.3)` }}>{n}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'rgba(245,243,238,0.68)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CTA ───────────── */}
      <section style={{ padding: '5rem 1.25rem', background: `linear-gradient(135deg, ${C2} 0%, ${C} 50%, ${C2} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(201,146,46,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)', marginBottom: 16, lineHeight: 1.2 }}>开始你的灵契之旅</h2>
          <p style={{ color: 'rgba(245,243,238,0.72)', fontSize: '1.05rem', marginBottom: 36, lineHeight: 1.8 }}>无论你是委托人，还是灵契师——这里都为这场契约留好了入口。</p>
          <Link to="/explore" className="btn-gold" style={{ display: 'inline-block', padding: '14px 48px', fontSize: '1rem', fontWeight: 600 }}>
            进入灵契大厅
          </Link>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer style={{ backgroundColor: C, borderTop: '1px solid rgba(201,146,46,0.1)', padding: '2.5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', color: 'rgba(245,243,238,0.6)', fontSize: '0.875rem' }}>
          <span className="gradient-text-gold" style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem' }}>灵契</span>
          <span>与虚拟人签订契约，让其借由灵契师短暂附身并降临现实，此之谓灵契</span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/explore" style={{ color: 'rgba(245,243,238,0.65)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,243,238,0.65)')}>进入大厅</Link>
            <Link to="/commissions" style={{ color: 'rgba(245,243,238,0.65)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,243,238,0.65)')}>委托需求</Link>
            <Link to="/rankings" style={{ color: 'rgba(245,243,238,0.65)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,243,238,0.65)')}>红黑榜</Link>
            <Link to="/login" style={{ color: 'rgba(245,243,238,0.65)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,243,238,0.65)')}>入驻</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}