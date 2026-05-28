import { Link } from 'react-router-dom';
import type React from 'react';

const GOLD = '#d9a857';
const BG = '#0F1117';
const PANEL = '#151923';
const TEXT = 'rgba(235,240,248,0.86)';
const MUTED = 'rgba(220,230,243,0.62)';

const sectionStyle: React.CSSProperties = {
  border: '1px solid rgba(217,168,87,0.14)',
  background: 'rgba(255,255,255,0.035)',
  borderRadius: 14,
  padding: '20px 22px',
};

const h2Style: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: '1.05rem',
  fontWeight: 900,
  marginBottom: 10,
};

const pStyle: React.CSSProperties = {
  color: TEXT,
  lineHeight: 1.85,
  fontSize: '0.92rem',
};

const listStyle: React.CSSProperties = {
  color: TEXT,
  lineHeight: 1.9,
  fontSize: '0.9rem',
  paddingLeft: 18,
  margin: 0,
};

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#fff' }}>
      <section style={{ background: `linear-gradient(135deg, ${PANEL} 0%, #0b1a30 100%)`, borderBottom: '1px solid rgba(217,168,87,0.12)', padding: '54px 20px 38px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Link to="/" style={{ color: GOLD, textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>返回灵契首页</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', margin: '18px 0 12px' }}>{title}</h1>
          <p style={{ ...pStyle, color: MUTED, maxWidth: 760 }}>{intro}</p>
          <p style={{ color: 'rgba(220,230,243,0.46)', fontSize: '0.78rem', marginTop: 14 }}>更新时间：2026-05-28 · 原型期版本</p>
        </div>
      </section>
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '30px 20px 70px', display: 'grid', gap: 16 }}>
        {children}
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={listStyle}>
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function ReviewRules() {
  return (
    <LegalLayout
      title="灵契审核规则"
      intro="灵契当前采用人工审核。审核的目标不是替所有人裁判输赢，而是判断内容是否具备基本事实基础、是否适合公开展示，以及是否存在明显造谣、泄露隐私、恶意攻击或剧透风险。"
    >
      <Section title="一、基本原则">
        <List items={[
          '审核员应尽量保持中立、客观，不因当事人的名气、消费能力、粉丝量或个人关系而改变审核标准。',
          '红榜、黑榜、白榜、评论、相关方回应、委托需求都可能进入审核队列。',
          '审核通过只代表该内容符合平台公开展示要求，不代表平台确认所有陈述完全真实。',
          '对存在明显争议、证据不足或风险较高的内容，平台可以驳回、要求补充材料、限制展示或转入人工复核。',
        ]} />
      </Section>

      <Section title="二、证据要求">
        <p style={pStyle}>发布红黑白榜主帖时，应提交能够证明事件真实发生的材料。证据不一定全部公开展示，但审核员需要看到足够支撑内容的材料。</p>
        <List items={[
          '可接受材料包括聊天记录、订单截图、预约记录、转账凭证、排期截图、公开主页链接、现场照片、合同或其他可核验资料。',
          '黑榜涉及明确负面指控时，证据要求高于红榜和白榜。',
          '只有情绪宣泄、没有事实基础、没有可核验证据的内容，原则上不通过。',
          '伪造、拼接、断章取义或诱导性提交材料，一经发现可以下架内容并限制账号功能。',
        ]} />
      </Section>

      <Section title="三、隐私与打码">
        <List items={[
          '提交内容涉及第三方时，应主动打码手机号、微信号、身份证号、住址、非公开真实姓名、订单号、转账单号等敏感信息。',
          '聊天记录中的无关第三方头像、昵称、联系方式，应尽量打码。',
          '未成年人信息、住址、身份证件、医疗健康、金融账户等高敏信息不得公开展示。',
          '前期未打码内容可以直接驳回；后续平台可能提供审核员在线打码能力。',
          '原始证据主要用于审核和争议处理，不默认完整公开。',
        ]} />
      </Section>

      <Section title="四、红榜、黑榜、白榜">
        <List items={[
          '红榜适合记录值得推荐的人、店、服务、陪伴体验或开本体验。',
          '黑榜适合记录违约、失联、严重服务不符、骚扰、欺诈等明确负面体验；公开展示默认 30 天后过期隐藏，严重公共风险可由管理员特殊处理。',
          '白榜适合记录非夸非踩的中性经历、趣闻、笑话、怪事和行业观察。',
          '白榜不能成为低成本阴阳怪气或变相挂人的地方；实际构成负面指控的，应转为黑榜并补充证据。',
        ]} />
      </Section>

      <Section title="五、评论与相关方回应">
        <List items={[
          '普通评论也需要遵守证据、隐私、打码和禁止攻击规则。',
          '用户认为自己是相关方时，应先发布普通评论；评论审核通过后，可以提交关系说明或图片材料申请置顶回应。',
          '相关方认证资料只给审核员判断，不在前台公开展示。',
          '相关方回应审核通过后，会作为置顶评论展示在主帖下方；审核拒绝时，原普通评论不因此自动删除。',
        ]} />
      </Section>

      <Section title="六、投票与契约币">
        <List items={[
          '点赞、点踩、点欢乐遵循一人一票，不可重复投票。',
          '点赞和点踩消耗契约币，欢乐免费但同样占用一人一票名额。',
          '点赞人、点踩人、欢乐记录可作为公开口碑的一部分展示。',
          '刷票、买号、冒用身份、组织恶意攻击等行为，平台可以限制、撤销或隐藏对应记录。',
        ]} />
      </Section>

      <Section title="七、禁止内容">
        <List items={[
          '违法违规内容、色情交易导向、赌博、诈骗、恐吓、人身威胁、线下骚扰动员。',
          '未经允许公开他人隐私、住址、身份证件、联系方式、未成年人信息。',
          '无事实基础的造谣、辱骂、人肉搜索、煽动网暴。',
          '剧本杀核心诡计、凶手、结局、关键反转等剧透内容，在剧透区正式上线前原则上不进入公开区。',
        ]} />
      </Section>

      <Section title="八、申诉与调整">
        <p style={pStyle}>审核规则会随着产品和社区风险继续调整。用户可以通过相关方回应、补充材料或联系管理员提出申诉。平台保留对明显风险内容进行隐藏、下架、限制传播或重新审核的权利。</p>
      </Section>
    </LegalLayout>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout
      title="灵契隐私政策"
      intro="本政策说明灵契在原型期如何收集、使用、保存和保护你的信息。灵契仍处在早期测试阶段，后续接入正式支付、短信、微信登录或国内部署时，本政策会继续更新。"
    >
      <Section title="一、我们可能收集的信息">
        <List items={[
          '账号信息：手机号、昵称、登录凭证、认证状态、账号创建时间。',
          '个人主页信息：城市、简介、标签、档期、社交主页链接、作品或展示内容。',
          '交易与余额信息：契约币余额、充值申请、消费记录、支付凭证或人工审核记录。',
          '内容信息：红黑白榜帖子、评论、相关方回应、委托需求、接单申请信、审核状态和驳回原因。',
          '证据与认证材料：你主动上传的截图、图片、PDF、说明文字、关系证明或身份认证资料。',
          '基础技术信息：浏览器、设备、访问时间、请求日志、错误日志等用于安全和排错的信息。',
        ]} />
      </Section>

      <Section title="二、我们如何使用信息">
        <List items={[
          '用于创建账号、登录、展示昵称、保存你的主页和委托需求。',
          '用于人工审核帖子、评论、相关方回应、认证材料和充值申请。',
          '用于计算契约币余额、处理发布、评论、点赞、点踩等站内操作。',
          '用于防止刷票、恶意攻击、重复提交、造谣、泄露隐私和其他滥用行为。',
          '用于排查故障、改进产品体验、维护服务安全和生成必要的运营统计。',
        ]} />
      </Section>

      <Section title="三、公开展示的信息">
        <List items={[
          '前台默认展示昵称，不直接展示你的实名。',
          '实名或认证用户可能展示星标、蓝 V、DM 认证等标识，但不公开证件信息。',
          '红黑白榜、评论、欢乐、点赞、点踩、委托需求和接单状态可能按产品规则公开展示。',
          '相关方认证材料、身份证明、支付凭证、原始证据原则上仅供审核使用，不默认公开。',
        ]} />
      </Section>

      <Section title="四、第三方服务">
        <p style={pStyle}>灵契当前使用 Vercel 提供部署和访问服务，使用 Supabase 提供数据库与文件/数据能力。未来可能接入短信、微信登录、支付宝或微信支付等服务。接入新的第三方服务时，我们会尽量只传递完成对应功能所需的信息。</p>
      </Section>

      <Section title="五、信息保存与安全">
        <List items={[
          '我们会在实现产品功能、处理争议、履行审核和安全要求所需的期间内保存相关信息。',
          '黑榜公开展示默认 30 天后过期隐藏，但后台可能为争议处理和安全审计保留必要记录。',
          '我们会采取访问控制、服务端密钥隔离、人工审核权限控制等方式降低数据泄露风险。',
          '互联网服务无法承诺绝对安全。如果发现账号或信息异常，请尽快联系管理员处理。',
        ]} />
      </Section>

      <Section title="六、你的权利">
        <List items={[
          '你可以在账号后台修改昵称、主页资料、社交链接和部分展示信息。',
          '你可以删除自己发布的未审核或可删除内容；已进入争议处理、审核留痕或公共风险判断的记录，可能需要管理员处理。',
          '你可以要求更正明显错误的信息，或对审核结果、相关方认证、黑榜内容提出申诉。',
          '你可以停止使用灵契；如需注销或删除历史数据，当前阶段可联系管理员人工处理。',
        ]} />
      </Section>

      <Section title="七、未成年人">
        <p style={pStyle}>灵契不面向未成年人提供独立服务。请不要提交未成年人的身份信息、联系方式、住址、照片、聊天记录等敏感材料。涉及未成年人的内容，平台会从严审核或直接拒绝公开。</p>
      </Section>

      <Section title="八、Cookie 与本地存储">
        <p style={pStyle}>为了保持登录状态和改善体验，灵契可能使用浏览器本地存储保存登录 token、昵称、身份状态等必要信息。你可以通过浏览器清理本地数据，但清理后可能需要重新登录。</p>
      </Section>

      <Section title="九、政策更新">
        <p style={pStyle}>如果灵契接入正式支付、微信登录、短信通知、国内云服务或新的数据处理方式，我们会更新本政策。重大变化会尽量在页面显著位置提示。</p>
      </Section>

      <Section title="十、联系与反馈">
        <p style={pStyle}>当前原型期的隐私、审核、申诉和删除请求，先通过站内管理员人工处理。正式备案和运营主体信息完善后，本页面会补充完整的运营方名称、联系方式和备案信息。</p>
      </Section>
    </LegalLayout>
  );
}
