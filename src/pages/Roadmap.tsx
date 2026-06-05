import { Link } from 'react-router-dom';
import type React from 'react';

const BG = '#fffdf8';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const roadmapItems = [
  {
    label: '01',
    title: 'AI 发帖安全检查',
    text: '先做事实表述、隐私打码、证据完整度和情绪化措辞提醒，降低发布风险，不替用户下结论。',
  },
  {
    label: '02',
    title: 'AI 审核摘要',
    text: '给审核员整理事件要素、证据类型、重复记录和潜在攻击风险，最终处置仍由人工审核确认。',
  },
  {
    label: '03',
    title: '共性问题沉淀',
    text: '不只看单条黑榜。等记录规模足够后，按迟到、失约、隐私边界、沟通误会、服务落差等类型做匿名化归纳。',
  },
  {
    label: '04',
    title: '礼仪与社交指南',
    text: '把高频问题整理成剧本杀礼仪、线下社交礼仪和避坑建议，让公开记录最终服务于更好的相处方式。',
  },
  {
    label: '05',
    title: '阶段性投票榜单',
    text: '规划定期开放投票，例如最喜欢的角色、年度剧本、最佳亡夫、最佳陪伴瞬间等，用轻松榜单沉淀正向记忆。',
  },
];

export default function Roadmap() {
  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ background: 'linear-gradient(135deg, #fffaf2 0%, #eef6ff 100%)', borderBottom: '1px solid rgba(217,168,87,0.18)', padding: '56px 20px 42px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <Link to="/rankings" style={{ color: '#275389', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>返回红黑白榜</Link>
          <p style={{ margin: '24px 0 8px', color: '#92400e', fontSize: 13, fontWeight: 900, letterSpacing: 0 }}>灵契发展预期</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 950, fontSize: 'clamp(2rem, 5vw, 3.1rem)', lineHeight: 1.15 }}>
            AI 先做辅助，不做裁判
          </h1>
          <p style={{ margin: '16px 0 0', color: MUTED, lineHeight: 1.8, fontSize: '1rem', maxWidth: 760 }}>
            当前优先验证真实发布、人工审核、相关方回应、带成本投票、拼车与剧本库共建。AI、信息聚合和阶段投票会在商业模式与数据规模验证后逐步开放，模型优先选择大陆可采购、低成本、中文语境更稳定的方案。
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '30px 20px 82px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14 }}>
          {roadmapItems.map((item) => (
            <article key={item.label} style={roadmapCardStyle}>
              <div style={numberStyle}>{item.label}</div>
              <h2 style={{ margin: '0 0 8px', color: INK, fontSize: 17 }}>{item.title}</h2>
              <p style={{ margin: 0, color: MUTED, lineHeight: 1.68, fontSize: 14 }}>{item.text}</p>
            </article>
          ))}
        </div>

        <section style={{ marginTop: 18, borderRadius: 16, border: '1px solid #fde68a', background: '#fff', padding: 20, boxShadow: '0 10px 26px rgba(146,64,14,0.06)' }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 900 }}>记录不浪费，公开要克制</h2>
          <p style={{ margin: 0, color: MUTED, lineHeight: 1.8 }}>
            黑榜 30 天公开期不是删除记录，而是把“持续公开挂人”和“长期行业学习”分开：公开期结束后，必要记录仍可用于争议处理和安全审计，后续也会优先做去标识化的共性问题总结。
          </p>
        </section>

        <section style={{ marginTop: 18, borderRadius: 16, border: '1px solid rgba(39,83,137,0.16)', background: 'linear-gradient(135deg, rgba(239,246,255,0.92), rgba(255,250,242,0.86))', padding: 20 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 900 }}>反馈与合作</h2>
          <p style={{ margin: 0, color: MUTED, lineHeight: 1.8 }}>
            欢迎沉浸式娱乐从业者、店家、DM、委托师、玩家和技术合作者提供样本、规则建议与功能反馈。
          </p>
        </section>
      </section>
    </main>
  );
}

const roadmapCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #f1e3c3',
  borderRadius: 12,
  padding: 18,
  boxShadow: '0 10px 24px rgba(146,64,14,0.07)',
};

const numberStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  backgroundColor: '#fef3c7',
  color: '#92400e',
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 12,
};
