import { useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';

const BG = '#fffdf8';
const GOLD = '#a66a1f';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

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
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ background: 'linear-gradient(135deg, #fffaf2 0%, #eef6ff 100%)', borderBottom: '1px solid rgba(166,106,31,0.16)', padding: '44px 20px 30px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <Link to="/rankings" style={topLink}>返回红黑榜事件榜</Link>
          <p style={{ margin: '18px 0 8px', color: '#92400e', fontWeight: 900, fontSize: 13 }}>圈内共识沉淀</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3.1rem)', lineHeight: 1.15 }}>社交边界投票</h1>
          <p style={{ margin: '14px 0 0', color: MUTED, lineHeight: 1.8, maxWidth: 780 }}>
            这些投票用于沉淀剧本杀礼仪和社交边界，不替代任何人的个人同意。涉及肢体接触、亲密互动、强情绪加戏时，底线是事前明确、当场可拒绝、随时可撤回。
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px 82px' }}>
        <div style={noticeStyle}>
          当前是第一版议题骨架，本页投票先保存在本机浏览器中。正式计票版本会绑定登录账号、防刷和城市维度，并把结果沉淀为共识报告。
          <strong style={{ color: GOLD }}> 已选择 {votedCount}/{topics.length} 个议题。</strong>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {topics.map(topic => (
            <article key={topic.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <p style={{ margin: '0 0 6px', color: GOLD, fontSize: 13, fontWeight: 900 }}>{topic.scope}</p>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{topic.title}</h2>
                </div>
                {votes[topic.id] && <span style={pillStyle}>已选择</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                {topic.choices.map(choice => {
                  const active = votes[topic.id] === choice.id;
                  return (
                    <button key={choice.id} onClick={() => vote(topic.id, choice.id)} style={{
                      textAlign: 'left',
                      borderRadius: 12,
                      border: active ? '1px solid rgba(166,106,31,0.48)' : '1px solid rgba(166,106,31,0.14)',
                      background: active ? 'rgba(166,106,31,0.12)' : '#fffaf2',
                      padding: 13,
                      cursor: 'pointer',
                    }}>
                      <strong style={{ color: active ? GOLD : INK, display: 'block', marginBottom: 6 }}>{choice.label}</strong>
                      <span style={{ color: MUTED, lineHeight: 1.65, fontSize: 14 }}>{choice.note}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <section style={{ marginTop: 16, ...cardStyle }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>边界不是多数暴政</h2>
          <p style={{ margin: 0, color: MUTED, lineHeight: 1.8 }}>
            投票结果只能说明圈内倾向，不能要求某个玩家接受不舒服的互动。个体边界高于平均偏好，平台后续会把结果写成“沟通建议”和“开场确认清单”，而不是拿来审判单个玩家。
          </p>
        </section>
      </section>
    </main>
  );
}

const topLink: React.CSSProperties = { color: '#275389', textDecoration: 'none', fontSize: 14, fontWeight: 800 };
const noticeStyle: React.CSSProperties = { marginBottom: 16, padding: 14, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', color: MUTED, lineHeight: 1.8, boxShadow: '0 10px 26px rgba(102,70,30,0.05)' };
const cardStyle: React.CSSProperties = { padding: 16, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', boxShadow: '0 10px 26px rgba(102,70,30,0.06)' };
const pillStyle: React.CSSProperties = { display: 'inline-flex', height: 26, alignItems: 'center', borderRadius: 999, padding: '0 9px', background: 'rgba(166,106,31,0.10)', color: GOLD, fontSize: 12, fontWeight: 900 };
