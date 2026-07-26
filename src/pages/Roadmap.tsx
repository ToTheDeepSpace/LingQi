import { Link } from 'react-router-dom';
import type React from 'react';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';

const INK = '#1f2937';
const MUTED = '#64748b';

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
    <JumuluPageFrame currentLabel="口碑路线图" maxWidth={1040}>
      <JumuluCompactHeader
        eyebrow="剧幕录发展预期"
        title="AI 先做辅助，不做裁判"
        description="当前先验证真实发布、人工审核、相关方回应、投票、拼车与剧本库共建。"
        aside={<Link to="/boundary-votes" style={jumuluSecondaryLinkStyle}>边界投票</Link>}
      />

      <div className="roadmap-item-grid">
        {roadmapItems.map((item) => (
          <article key={item.label} style={roadmapCardStyle}>
            <div style={numberStyle}>{item.label}</div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: '0 0 5px', color: INK, fontSize: 16 }}>{item.title}</h2>
              <p style={{ margin: 0, color: MUTED, lineHeight: 1.58, fontSize: 13 }}>{item.text}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="roadmap-note-grid">
        <section style={noteCardStyle}>
          <h2 style={noteTitleStyle}>记录不浪费，公开要克制</h2>
          <p style={noteTextStyle}>黑榜 30 天公开期结束后，必要记录仍用于争议处理和安全审计；行业总结优先去标识化。</p>
        </section>

        <section style={noteCardStyle}>
          <h2 style={noteTitleStyle}>反馈与合作</h2>
          <p style={noteTextStyle}>欢迎玩家、店家、DM、委托师和技术合作者提供样本、规则建议与功能反馈。</p>
        </section>
      </div>
    </JumuluPageFrame>
  );
}

const roadmapCardStyle: React.CSSProperties = {
  ...jumuluCardStyle,
  minWidth: 0,
  padding: 14,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
};

const numberStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 7,
  backgroundColor: '#fef3c7',
  color: '#92400e',
  fontWeight: 900,
  fontSize: 11,
  flex: '0 0 auto',
};

const noteCardStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 14 };
const noteTitleStyle: React.CSSProperties = { margin: '0 0 6px', color: INK, fontSize: 15, fontWeight: 900 };
const noteTextStyle: React.CSSProperties = { margin: 0, color: MUTED, lineHeight: 1.58, fontSize: 13 };
