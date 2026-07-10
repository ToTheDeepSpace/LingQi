import { Link } from 'react-router-dom';
import type React from 'react';
import BrandLogo from '../components/BrandLogo';

const classes = [
  { icon: '🎭', role: 'DM 评分', sub: 'DM RATINGS', desc: '带本节奏、演绎表现、控场能力、沟通边界和复盘反馈，都应该留下可追溯的口碑。', accent: '#a78bfa' },
  { icon: '📍', role: '城市与店铺', sub: 'CITY / STORE', desc: '按城市、店铺和剧本线索查卡司评价，找到真实发生过的体验记录。', accent: '#38bdf8' },
  { icon: '🧾', role: '红黑榜事件', sub: 'EVENT RECORDS', desc: '红黑榜承接具体事件，先记录事实、凭证和回应，再沉淀为卡司评分的一部分。', accent: '#e879f9' },
];

const features = [
  { icon: '🔎', title: '查卡司口碑', desc: '先从 DM 开始，逐步沉淀 NPC、场控等沉浸式娱乐参与者的评分与评价。' },
  { icon: '🧭', title: '按城市和店铺看', desc: '同一个 DM 在不同城市、不同店铺、不同剧本里的表现，可以被放回真实场景里理解。' },
  { icon: '🛡️', title: '评价要有治理', desc: '评分、事件、回应和举报都进入审核机制，平台记录口碑，不做脱离证据的审判。' },
];

const steps = [
  { n: '01', title: '搜索 DM / 店铺', desc: '从城市、店铺、剧本或名字进入，找到你关心的卡司口碑。' },
  { n: '02', title: '查看评分和事件', desc: '评分看长期口碑，红黑榜看具体事件，相关方回应一起保留。' },
  { n: '03', title: '留下真实记录', desc: '写清楚发生了什么、在哪里发生、为什么推荐或避雷。' },
];

const trustRules = [
  { n: '01', title: '真实体验', desc: '评价要来自实际开本、实际接触或具体事件，不写空泛标签。' },
  { n: '02', title: '可追溯上下文', desc: '尽量记录城市、店铺、剧本、时间和角色关系，让后来的玩家能判断参考价值。' },
  { n: '03', title: '允许回应和修正', desc: '相关方可以回应，记录也可以随时间更新，口碑不是一次性判决。' },
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
const homeReputationPrimaryLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 28px',
  borderRadius: 10,
  background: 'linear-gradient(135deg, #c0392b 0%, #a93226 100%)',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '0.94rem',
  boxShadow: '0 4px 20px rgba(192,57,43,0.26)',
};
const homeReputationGhostLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 18px',
  borderRadius: 10,
  border: '1px solid rgba(192,57,43,0.22)',
  background: '#fffdf8',
  color: '#a93226',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '0.9rem',
};

export default function Home() {
  return (
    <div style={{ backgroundColor: C, color: INK }}>

      {/* ───────────── HERO ───────────── */}
      <section className="home-hero">

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(217,168,87,0.18) 0%, rgba(85,135,186,0.08) 42%, transparent 72%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 50% 40%, rgba(255,255,255,0.72) 0%, transparent 100%)', pointerEvents: 'none' }} />

        <div className="home-hero-inner">

          <h1 className="sr-only">剧幕录</h1>
          <BrandLogo variant="lockup" className="home-brand-lockup" />

          <div className="home-hero-badge">
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD }} />
            沉浸式娱乐 · 卡司评分榜
          </div>

          <p className="home-hero-lead">
            致力于成为沉浸式娱乐领域最可信的卡司评分榜
          </p>
          <p className="home-hero-subcopy">
            从 DM 开始，查各地各店口碑，记录每一次真实开本体验。
          </p>

          <div className="home-entry-grid">
            <Link to="/dm-wall" className="btn-gold home-entry-link">
              查卡司评分
            </Link>
            <Link to="/rankings/new" className="btn-glass home-entry-link">
              记录一次口碑
            </Link>
            <Link to="/rankings" className="home-entry-link home-entry-red">
              红黑榜事件
            </Link>
            <Link to="/reputation/city" className="home-entry-link home-entry-blue">
              城市口碑
            </Link>
          </div>

          <p className="home-hero-note">
            注册即用 · 发布内容人工审核 · 具体事件沉淀为长期口碑
          </p>
        </div>
      </section>

      {/* ───────────── 可信口碑怎么来 ───────────── */}
      <section style={{ backgroundColor: '#f8fbff', padding: '4rem 1.25rem 5rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(39,83,137,0.62)', marginBottom: 12 }}>可信口碑</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.7rem, 4vw, 2.5rem)', marginBottom: 16, color: INK }}>评分不是一句好坏</h2>
            <p style={{ color: MUTED, lineHeight: 1.9, fontSize: '1rem', maxWidth: 680, margin: '0 auto' }}>
              剧幕录要记录的是可被后来者参考的真实体验：谁带的本，发生在哪里，为什么推荐，为什么避雷，相关方有没有回应。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {trustRules.map(({ n, title, desc }) => (
              <article key={n} style={{ background: '#fff', border: '1px solid rgba(39,83,137,0.14)', borderRadius: 16, padding: '22px 20px', boxShadow: '0 14px 32px rgba(31,41,55,0.05)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(238,246,255,0.95)', color: '#275389', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem', marginBottom: 14 }}>{n}</div>
                <h3 style={{ margin: '0 0 9px', color: INK, fontSize: '1rem', fontWeight: 800 }}>{title}</h3>
                <p style={{ margin: 0, color: 'rgba(71,85,105,0.74)', lineHeight: 1.75, fontSize: '0.86rem' }}>{desc}</p>
              </article>
            ))}
          </div>

          <p style={{ margin: '22px auto 0', maxWidth: 760, color: 'rgba(71,85,105,0.72)', fontSize: '0.92rem', lineHeight: 1.85, textAlign: 'center' }}>
            评分榜看长期趋势，红黑榜承接具体事件。两者放在一起，才有机会把群聊里的碎片口碑沉淀成行业可查的档案。
          </p>
        </div>
      </section>

      {/* ───────────── 这里能查什么 ───────────── */}
      <section style={{ backgroundColor: C, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.7)', marginBottom: 12 }}>评分对象</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>卡司评分榜，先从 DM 开始</h2>
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

      {/* ───────────── 为什么选剧幕录 ───────────── */}
      <section style={{ padding: '5rem 1.25rem', background: `linear-gradient(180deg, ${C} 0%, ${WARM_BG} 18%, #eef6ff 68%, ${C} 100%)` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.65)', marginBottom: 12 }}>为什么选择剧幕录</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16, color: WARM_TEXT }}>把零散口碑沉淀成评分榜</h2>
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

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c0392b', marginBottom: 12 }}>事件记录 · 口碑沉淀</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>红黑榜事件榜</h2>
          <div className="gold-line" style={{ margin: '0 auto 48px' }} />

          <p style={{ fontSize: '1rem', color: MUTED, lineHeight: 1.85, maxWidth: 600, margin: '0 auto 36px' }}>
            先记录玩家遇到的具体事件，再沉淀成卡司档案、店家档案、城市口碑和对象档案。<br />
            每条公开记录都经过人工审核，黑榜公开期结束后，也可以去标识化沉淀为共性问题和社交礼仪。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[              
              { icon: '🏪', label: '店家事件', desc: '店面环境、服务质量、管理水平' },
              { icon: '🥡', label: '外卖榜', desc: '出餐速度、包装份量、踩雷记录' },
              { icon: '🎭', label: '玩家事件', desc: '素质、迟到率、历史评价' },
              { icon: '🎬', label: '卡司档案 / 店家档案', desc: 'DM 与店家的未认证档案' },
              { icon: '🌙', label: '城市榜单', desc: '打榜值、口碑值、打榜人数' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ padding: '22px 16px', borderRadius: 14, border: '1px solid rgba(192,57,43,0.18)', background: 'linear-gradient(180deg, rgba(254,242,242,0.9), rgba(255,255,255,0.92))', textAlign: 'center', boxShadow: '0 10px 28px rgba(31,41,55,0.05)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '0.92rem', color: INK, marginBottom: 6 }}>{label}</h3>
                <p style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.68)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/rankings" style={homeReputationPrimaryLink}>
              进入事件榜
            </Link>
            <Link to="/dm-wall" style={homeReputationGhostLink}>卡司评分 / 店家</Link>
            <Link to="/reputation/city" style={homeReputationGhostLink}>城市口碑</Link>
          </div>
        </div>
      </section>

      {/* ───────────── 三步留下口碑 ───────────── */}
      <section style={{ backgroundColor: C2, padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>

          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.7)', marginBottom: 12 }}>使用方式</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>三步，留下可查的口碑</h2>
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
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)', marginBottom: 16, lineHeight: 1.2 }}>让真实口碑有地方沉淀</h2>
          <p style={{ color: MUTED, fontSize: '1.05rem', marginBottom: 36, lineHeight: 1.8 }}>查卡司、看事件、写评价，从一次真实开本开始。</p>
          <Link to="/rankings/new" className="btn-gold" style={{ display: 'inline-block', padding: '14px 48px', fontSize: '1rem', fontWeight: 600 }}>
            记录一次口碑
          </Link>
        </div>
      </section>

    </div>
  );
}
