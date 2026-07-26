import { useMemo, useState } from 'react';
import type React from 'react';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { jumuluCardStyle } from '../styles/jumuluPageStyles';

const GOLD = '#a66a1f';
const INK = '#27364a';
const MUTED = '#64748b';

type Choice = { id: string; label: string; note: string };
type Topic = { id: string; title: string; scope: string; choices: Choice[] };

const topics: Topic[] = [
  {
    id: 'cp-touch',
    title: 'CP 之间要不要有肢体接触？',
    scope: '情感本 / CP 线 / 陪伴位',
    choices: [
      { id: 'explicit', label: '必须事前明确同意', note: '有接触前说清楚，玩家可拒绝。' },
      { id: 'soft', label: '轻微接触可现场确认', note: '牵手、扶肩等也应给对方拒绝空间。' },
      { id: 'none', label: '默认不应接触', note: '除非双方主动提出并明确同意。' },
    ],
  },
  {
    id: 'dm-extra-scene',
    title: 'DM 加戏要不要提前告知？',
    scope: 'DM 开本 / 情绪加戏 / 角色定制',
    choices: [
      { id: 'before', label: '高强度加戏前要说', note: '尤其涉及亲密、羞辱、强压迫和创伤内容。' },
      { id: 'style', label: '开场说明风格即可', note: '让玩家知道本场可能有高情绪处理。' },
      { id: 'after', label: '不必剧透但要可中止', note: '不提前剧透，但玩家能随时喊停。' },
    ],
  },
  {
    id: 'carpool-transparency',
    title: '车头组局的信息要透明到什么程度？',
    scope: '拼车 / 补贴 / 角色分配',
    choices: [
      { id: 'full', label: '价格和补贴必须透明', note: '票价、A 补、免票、角色分配都应提前说。' },
      { id: 'core', label: '关键成本透明即可', note: '至少说清每个人实际要承担什么。' },
      { id: 'private', label: '允许部分私下沟通', note: '但不能影响已上车玩家的基本知情权。' },
    ],
  },
  {
    id: 'reject-boundary',
    title: '玩家拒绝某类互动后，其他人应该怎么处理？',
    scope: '边界 / 社交礼仪 / 玩家安全感',
    choices: [
      { id: 'respect', label: '立即尊重并换处理方式', note: '拒绝不需要解释，不能继续试探。' },
      { id: 'ask-once', label: '可以确认一次原因', note: '只确认一次，不追问、不施压。' },
      { id: 'dm-mediate', label: '交给 DM 协调', note: '由 DM 换戏路，避免玩家当场尴尬。' },
    ],
  },
];

export default function BoundaryVotes() {
  const [votes, setVotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('lc_boundary_votes_preview') || '{}');
    } catch {
      return {};
    }
  });

  const votedCount = useMemo(() => Object.keys(votes).length, [votes]);

  const vote = (topicId: string, choiceId: string) => {
    const next = { ...votes, [topicId]: choiceId };
    setVotes(next);
    localStorage.setItem('lc_boundary_votes_preview', JSON.stringify(next));
  };

  return (
    <JumuluPageFrame currentLabel="边界投票" maxWidth={1040}>
      <JumuluCompactHeader
        eyebrow="实验议题"
        title="社交边界共识"
        description="收纳剧本杀礼仪与互动边界的讨论。任何投票结果都不能替代个人同意。"
        aside={<strong style={progressStyle}>已选 {votedCount}/{topics.length}</strong>}
      />

      <div style={noticeStyle}>
        <strong style={{ color: INK }}>底线：</strong>事前明确、当场可拒绝、随时可撤回。
        <span> 本页目前只保存到当前浏览器，不计入正式平台票数。</span>
      </div>

      <div className="boundary-topic-grid">
        {topics.map(topic => (
          <article key={topic.id} style={cardStyle}>
            <div style={topicHeaderStyle}>
              <div style={{ minWidth: 0 }}>
                <p style={scopeStyle}>{topic.scope}</p>
                <h2 style={topicTitleStyle}>{topic.title}</h2>
              </div>
              {votes[topic.id] && <span style={pillStyle}>已选择</span>}
            </div>
            <div style={choiceListStyle}>
              {topic.choices.map(choice => {
                const active = votes[topic.id] === choice.id;
                return (
                  <button key={choice.id} onClick={() => vote(topic.id, choice.id)} style={{
                    ...choiceStyle,
                    borderColor: active ? 'rgba(166,106,31,0.48)' : 'rgba(31,41,55,0.10)',
                    background: active ? '#fff5df' : '#fff',
                  }}>
                    <strong style={{ color: active ? GOLD : INK, display: 'block' }}>{choice.label}</strong>
                    <span style={{ color: MUTED, lineHeight: 1.5, fontSize: 12 }}>{choice.note}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <section style={footerNoteStyle}>
        <strong>个体边界高于平均偏好。</strong>
        <span> 结果只用于整理沟通建议，不用于要求任何人接受不舒服的互动。</span>
      </section>
    </JumuluPageFrame>
  );
}

const progressStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 11px', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 7, background: '#fff5df', color: '#8b5919', fontSize: 13 };
const noticeStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, border: '1px solid rgba(166,106,31,0.16)', background: '#fffaf0', color: MUTED, lineHeight: 1.55, fontSize: 13 };
const cardStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 14 };
const topicHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 };
const scopeStyle: React.CSSProperties = { margin: '0 0 4px', color: GOLD, fontSize: 11, fontWeight: 900 };
const topicTitleStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 16, lineHeight: 1.4 };
const choiceListStyle: React.CSSProperties = { display: 'grid', gap: 7 };
const choiceStyle: React.CSSProperties = { minHeight: 58, textAlign: 'left', borderRadius: 7, border: '1px solid rgba(31,41,55,0.10)', padding: '8px 10px', cursor: 'pointer', display: 'grid', gap: 3 };
const pillStyle: React.CSSProperties = { display: 'inline-flex', minHeight: 24, alignItems: 'center', borderRadius: 6, padding: '0 7px', background: '#fff5df', color: GOLD, fontSize: 11, fontWeight: 900, flex: '0 0 auto' };
const footerNoteStyle: React.CSSProperties = { padding: '10px 12px', borderTop: '1px solid rgba(31,41,55,0.08)', color: MUTED, lineHeight: 1.55, fontSize: 13 };
