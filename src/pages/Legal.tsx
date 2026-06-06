import { Link } from 'react-router-dom';
import type React from 'react';

const GOLD = '#d9a857';
const BG = '#fffdf8';
const PANEL = '#fffaf2';
const TEXT = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const CONTACT_EMAIL = 'basara-twenty@foxmail.com';
const ICP_RECORD_NO = '冀ICP备2026019163号-1';
const BUSINESS_LICENSE_IMAGE = '/legal/business-license-huilan.jpg';

const sectionStyle: React.CSSProperties = {
  border: '1px solid rgba(217,168,87,0.22)',
  background: 'rgba(255,255,255,0.86)',
  borderRadius: 14,
  padding: '20px 22px',
  boxShadow: '0 12px 32px rgba(31,41,55,0.06)',
};

const h2Style: React.CSSProperties = {
  color: '#1f2937',
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

const linkStyle: React.CSSProperties = {
  color: '#275389',
  textDecoration: 'none',
  fontWeight: 800,
};

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main style={{ background: BG, minHeight: '100vh', color: TEXT }}>
      <section style={{ background: `linear-gradient(135deg, ${PANEL} 0%, #eef6ff 100%)`, borderBottom: '1px solid rgba(217,168,87,0.18)', padding: '54px 20px 38px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Link to="/" style={{ color: GOLD, textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>返回灵契首页</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', margin: '18px 0 12px' }}>{title}</h1>
          <p style={{ ...pStyle, color: MUTED, maxWidth: 760 }}>{intro}</p>
          <p style={{ color: 'rgba(71,85,105,0.56)', fontSize: '0.78rem', marginTop: 14 }}>更新时间：2026-06-04 · 原型期版本</p>
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

function InfoRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(110px, 160px) 1fr',
          gap: 12,
          alignItems: 'baseline',
          padding: '10px 0',
          borderBottom: '1px solid rgba(217,168,87,0.12)',
        }}>
          <span style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.82rem', fontWeight: 850 }}>{label}</span>
          <span style={{ color: TEXT, fontSize: '0.92rem', lineHeight: 1.75, fontWeight: 650 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export function BusinessLicense() {
  return (
    <LegalLayout
      title="经营主体信息"
      intro="本页面用于公示灵契当前运营主体、备案信息和营业执照。用户如需核对主体、申请发票、投诉申诉或联系平台，可通过站内信或客服邮箱处理。"
    >
      <Section title="一、经营主体">
        <InfoRows rows={[
          ['运营主体', '河北雄安澜洄娱乐有限公司'],
          ['统一社会信用代码', '91130629MAEX8NGU6H'],
          ['主体类型', '有限责任公司（自然人独资）'],
          ['成立日期', '2025年09月16日'],
          ['注册地址', '河北雄安新区容城县容城镇奥威路130号3幢1-076（自主申报）'],
          ['网站域名', 'lingqi.jusichen.com'],
          ['ICP备案号', ICP_RECORD_NO],
          ['客服邮箱', CONTACT_EMAIL],
        ]} />
      </Section>

      <Section title="二、营业执照">
        <div style={{
          border: '1px solid rgba(217,168,87,0.18)',
          borderRadius: 14,
          padding: 12,
          background: '#fff',
          boxShadow: '0 12px 28px rgba(31,41,55,0.05)',
        }}>
          <img
            src={BUSINESS_LICENSE_IMAGE}
            alt="河北雄安澜洄娱乐有限公司营业执照"
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 10 }}
          />
        </div>
      </Section>

      <Section title="三、说明">
        <List items={[
          '本页公示信息用于说明灵契当前运营主体和用户联系渠道，不构成对任何线下交易、委托服务或第三方内容真实性的担保。',
          '营业执照图片仅用于经营主体公示。用户可结合国家企业信用信息公示系统等公开渠道自行核验主体登记信息。',
          '如需申请发票、处理充值异常、投诉举报、隐私请求或审核申诉，可使用站内信或客服邮箱联系平台。',
        ]} />
        <p style={pStyle}>联系方式：<Link to="/contact" style={linkStyle}>站内信</Link> / <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>。ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={linkStyle}>{ICP_RECORD_NO}</a>；公安联网备案号办理完成后会继续补充公示。</p>
      </Section>
    </LegalLayout>
  );
}

export function SecurityAssessment() {
  return (
    <LegalLayout
      title="灵契安全评估说明"
      intro="本页面用于说明灵契对互动信息服务采取的账号核验、内容审核、举报处置、日志留存和监管协助措施，方便用户理解平台治理边界，也方便备案及安全评估材料整理。"
    >
      <Section title="一、服务与交互功能范围">
        <List items={[
          '灵契当前提供灵契师主页、委托需求墙、拼车区、红黑白榜、评论、相关方置顶回应、举报投诉、契约币余额和管理员审核等功能。',
          '红黑白榜、评论、委托需求、拼车和公开主页属于用户可发布或可被举报的互动内容。',
          '灵契当前不提供站内私信、群聊、直播、论坛版块、公众账号群发或用户自建通讯群组功能；相关安全评估栏目可按“无此功能”填写。',
          '拼车区因时效强，采用先公开、后治理；红黑榜、委托需求、评论、相关方回应等按当前规则进入人工审核或后置处理。',
        ]} />
      </Section>

      <Section title="二、账号核验与身份标识">
        <List items={[
          '用户发布、评论、投票、接单/上车申请等公开互动前需要注册登录账号，并完成手机号验证；头像可用于主页展示，但不作为发言门槛。',
          '前台默认展示昵称，不直接展示真实姓名、手机号或微信号。',
          '实名认证、DM 认证、店家认证等只展示认证标识，证件和证明材料仅供审核使用。',
          '发现冒用身份、恶意刷票、造谣、泄露隐私或其他明显违规行为时，管理员可以下架内容、限制公开展示或限制账号继续发布。',
        ]} />
      </Section>

      <Section title="三、内容审核与违法有害信息处置">
        <List items={[
          '红黑榜负面内容必须附带证据材料；涉及第三方信息的截图、图片和文档需要主动打码。',
          '审核员会尽量保持中立、客观，对证据不足、隐私未打码、明显辱骂、人肉搜索、色情交易导向、诈骗、剧透等内容进行驳回、隐藏或下架。',
          '平台提供举报入口，用户可以对拼车、红黑白榜、评论、委托需求和公开主页提交举报。',
          '管理员后台可查看举报内容、处理结果、目标快照，并可对违规内容执行下架或对账号执行限制。',
        ]} />
      </Section>

      <Section title="四、日志留存与安全记录">
        <p style={pStyle}>平台会为安全、审核、争议处理和依法协助需要保留必要操作日志。普通网页无法读取设备 MAC 地址，因此灵契不会虚假承诺采集 MAC。</p>
        <List items={[
          '日志记录范围包括账号 ID、角色、操作类型、操作时间、目标类型、目标 ID、请求路径、IP 地址、User-Agent 和必要的非敏感摘要。',
          '记录的动作包括登录、注册、发布、评论、举报、查看拼车联系方式、申请上车、投票、认证提交、后台审核、下架、封禁和解除限制等。',
          '证据图片、认证材料、支付凭证等敏感材料保存在对应业务表或文件存储中，不在安全日志摘要里重复展开。',
          '日志用于排查异常、处理投诉、辅助审核、防刷和依法配合监管、司法或行政机关履职。',
        ]} />
      </Section>

      <Section title="五、投诉举报与申诉">
        <List items={[
          '公开内容旁会尽量提供举报入口；恶意举报同样会留下记录。',
          '相关方可以先发布评论，再提交相关方认证材料申请置顶回应。',
          '用户对审核、下架、账号限制或公开评价有异议时，可以补充材料并通过站内方式向管理员申诉。',
          `用户可以通过站内信或对外联系邮箱 ${CONTACT_EMAIL} 联系平台。ICP备案号：${ICP_RECORD_NO}；公安联网备案号当前办理中，完成后会继续补充公示。`,
        ]} />
      </Section>

      <Section title="六、监管协助与整改计划">
        <List items={[
          '平台会根据主管机关、公安机关、网信部门或司法机关依法提出的要求，提供必要的数据查询、日志留存和处置协助。',
          '当前已具备站内举报、人工审核、违规内容下架、账号限制、安全日志和防篡改审计链能力。',
          '后续整改方向包括敏感词/图片自动预审、多人复核、举报导出、日志筛选导出、正式短信/微信核验和国内云部署。',
        ]} />
      </Section>
    </LegalLayout>
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
          '30 天公开期不是删除记录，而是避免无限期公开惩罚；平台后续可在去标识化后，把高频问题沉淀为剧本杀礼仪、社交礼仪和社区规则建议。',
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
        <p style={pStyle}>审核规则会随着产品和社区风险继续调整。用户可以通过相关方回应、补充材料或联系管理员提出申诉，也可以发送邮件至 <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>。平台保留对明显风险内容进行隐藏、下架、限制传播或重新审核的权利。</p>
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
          '基础技术信息：IP 地址、User-Agent、访问时间、请求路径、操作类型、对象 ID、错误日志等用于安全和排错的信息。',
        ]} />
      </Section>

      <Section title="二、我们如何使用信息">
        <List items={[
          '用于创建账号、登录、展示昵称、保存你的主页和委托需求。',
          '用于人工审核帖子、评论、相关方回应、认证材料和充值申请。',
          '用于计算契约币余额、处理发布、评论、点赞、点踩等站内操作。',
          '用于防止刷票、恶意攻击、重复提交、造谣、泄露隐私和其他滥用行为。',
          '用于保留发布、评论、举报、审核、下架、账号限制等必要安全日志。',
          '用于排查故障、改进产品体验、维护服务安全和生成必要的运营统计。',
        ]} />
      </Section>

      <Section title="三、公开展示的信息">
        <List items={[
          '前台默认展示昵称，不直接展示你的实名。',
          '实名或认证用户可能展示星标、蓝 V、DM 认证等标识，但不公开证件信息。',
          '红黑白榜、评论、欢乐、点赞、点踩、委托需求和接单状态可能按产品规则公开展示。',
          '实名认证身份证图片会在上传前加上“仅用于灵契实名认证”水印；相关方认证材料、身份证明、支付凭证、原始证据原则上仅供审核使用，不默认公开。',
        ]} />
      </Section>

      <Section title="四、第三方服务">
        <p style={pStyle}>灵契当前使用腾讯云提供服务器、域名解析、证书和对象存储等基础能力，使用 Supabase 提供数据库能力，使用支付宝和微信支付提供充值支付能力。未来可能接入短信、微信登录等服务。接入新的第三方服务时，我们会尽量只传递完成对应功能所需的信息。</p>
      </Section>

      <Section title="五、信息保存与安全">
        <List items={[
          '我们会在实现产品功能、处理争议、履行审核和安全要求所需的期间内保存相关信息。',
          '黑榜公开展示默认 30 天后过期隐藏，但后台可能为争议处理和安全审计保留必要记录；平台也可能在去标识化后用于共性问题总结和社区规则改进。',
          '平台会为投诉举报、违法有害信息处置和依法协助需要，保留必要操作日志；普通网页无法读取设备 MAC 地址，灵契不会承诺或尝试采集 MAC。',
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
        <p style={pStyle}>当前原型期的隐私、审核、申诉和删除请求，先通过站内管理员人工处理，也可以使用 <Link to="/contact" style={linkStyle}>站内信</Link> 或发送邮件至 <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>。经营主体信息见 <Link to="/business-license" style={linkStyle}>经营主体信息</Link>。ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={linkStyle}>{ICP_RECORD_NO}</a>；公安联网备案号办理完成后会继续补充公示。</p>
      </Section>
    </LegalLayout>
  );
}

export function UserAgreement() {
  return (
    <LegalLayout
      title="灵契用户协议"
      intro="欢迎使用灵契。本协议用于说明你在使用灵契账号、灵契师主页、委托需求墙、红黑白榜、契约币、评论和相关方回应等功能时需要遵守的基本规则。继续使用灵契，即视为你理解并同意本协议。"
    >
      <Section title="一、服务说明">
        <List items={[
          '灵契是连接委托人、灵契师及配套服务人员的原型期平台，当前功能包括主页展示、委托需求、红黑白榜、评论、相关方回应、邀请奖励、契约币余额和人工审核。',
          '平台仍处于测试和迭代阶段，部分功能可能调整、下线、合并或改为新的产品形态。',
          '灵契不直接保证任何委托、接单、陪伴、拍摄、妆造、服装或道具服务一定达成，具体合作由用户自行确认。',
        ]} />
      </Section>

      <Section title="二、账号与身份">
        <List items={[
          '你需要使用真实可用的手机号或平台支持的方式注册账号，并妥善保管登录信息；公开发言、投票、评论、接单/上车申请等互动前需要完成手机号验证。',
          '你不得冒用他人身份、盗用他人账号、使用他人联系方式注册或发布内容。',
          '前台默认显示昵称，不直接展示实名；实名、DM、店家等认证状态可能以星标或认证标识展示。实名认证身份证图片会在上传前加“仅用于灵契实名认证”水印，仅供后台审核。',
          '如账号存在异常登录、恶意刷票、造谣、骚扰、诈骗等风险，平台可以限制、冻结或下线相关功能。',
        ]} />
      </Section>

      <Section title="三、内容发布规则">
        <List items={[
          '你对自己发布的主页资料、委托需求、红黑白榜、评论、接单申请、相关方回应和上传材料负责。',
          '发布内容应尽量真实、清楚、可核验，不得故意捏造事实、伪造证据、断章取义或恶意引导他人攻击。',
          '涉及第三方信息时，应主动打码手机号、微信号、身份证号、住址、非公开真实姓名、订单号、无关头像等敏感信息。',
          '不得发布违法违规、色情交易导向、赌博、诈骗、威胁恐吓、人肉搜索、未成年人隐私、恶意剧透等内容。',
        ]} />
      </Section>

      <Section title="四、红黑白榜与评论">
        <List items={[
          '红榜用于推荐和记录正向体验；黑榜用于记录明确负面体验；白榜用于记录中性趣闻、怪事、笑话或行业观察。',
          '黑榜公开展示默认 30 天后过期隐藏，严重违法、长期风险或公共利益相关内容可由管理员特殊处理；隐藏不等于删除全部记录，平台可在必要范围内保留争议处理记录，并在去标识化后总结共性问题。',
          '红黑白榜主帖、评论和相关方回应可能需要人工审核，审核通过不代表平台确认全部事实，只代表符合当前展示规则。',
          '相关方回应应先作为普通评论发布，再提交关系说明或图片材料申请置顶；认证材料仅供审核判断，不默认公开。',
        ]} />
      </Section>

      <Section title="五、委托需求与接单申请">
        <List items={[
          '委托人可以发布角色、日期、地点、预算、联系说明或其他需求；内容审核通过后进入委托需求墙。',
          '灵契师或其他服务人员可以对已上墙需求提交接单申请信。',
          '接单申请只是表达合作意向，不构成平台担保、合同成立或服务承诺。',
          '用户在线下沟通、付款、见面、服务履行前，应自行确认身份、边界、价格、时间、地点和安全风险。',
        ]} />
      </Section>

      <Section title="六、契约币与费用">
        <List items={[
          '契约币是灵契站内余额名称，用于发布、评论、点赞、点踩等站内操作。',
          '原型期可能存在新户赠送、邀请奖励、人工充值、支付宝充值、微信支付充值等方式；平台可以按防刷、活动和运营需要调整赠送规则。',
          '邀请奖励采用分阶段发放：被邀请新用户注册后可获得额外赠送额度；邀请人需等待被邀请人完成手机号验证或有效互动后再获得对应奖励。',
          '用户应按实际需要充值，避免一次性充值过多。已支付充值入账后会产生支付通道、开票和账务处理成本，除重复扣款、支付成功未到账、平台原因无法提供对应功能等异常情形外，原则上不支持提现或无理由退款。',
          '用户可按实际支付的充值订单金额申请发票；新户赠送、邀请奖励、优惠额度、未支付订单和已作废/已退款订单不作为开票金额。',
          '如果内容因重复提交、明显违规或平台原因未能进入相应流程，平台可以按当时规则退回或调整契约币。',
          '契约币不是法定货币、储值卡或金融产品，不能提现、转让、代充倒卖或用于站外交易。',
        ]} />
      </Section>

      <Section title="七、审核、处理与申诉">
        <List items={[
          '平台可以对内容进行通过、驳回、要求补充材料、隐藏、下架、限制传播或重新审核。',
          '对恶意刷票、重复发布、造谣、骚扰、泄露隐私、伪造证据等行为，平台可以限制账号功能或清理相关记录。',
          '平台会记录必要的账号、IP、User-Agent、操作时间、操作类型和目标对象，用于审核、争议处理、防刷和依法协助。',
          '用户如认为审核结果、黑榜内容、相关方认证或账号处理存在问题，可以补充材料并向管理员申诉。',
          '平台会尽量保持中立、客观，但不承诺介入所有线下纠纷或替用户完成事实裁判。',
        ]} />
      </Section>

      <Section title="八、知识产权与授权">
        <List items={[
          '你应确保上传的文字、图片、截图、作品展示、头像、社交主页链接等内容有权使用。',
          '你授权灵契在提供服务、页面展示、审核、争议处理和产品运营所需范围内使用你提交的内容。',
          '未经允许，不得批量抓取、复制、搬运、售卖或二次发布平台上的用户资料、评价、证据和委托信息。',
        ]} />
      </Section>

      <Section title="九、免责声明">
        <List items={[
          '灵契作为信息发布和连接平台，不对用户之间线下交易、服务质量、人身安全、付款履约作绝对保证。',
          '因用户自行发布不实内容、泄露隐私、线下交易、私下沟通、账号保管不当造成的损失，由相关责任方自行承担。',
          '因不可抗力、第三方服务异常、网络故障、备案或监管要求导致的服务中断、迁移或调整，平台会尽力处理但不承诺完全避免影响。',
        ]} />
      </Section>

      <Section title="十、协议更新">
        <p style={pStyle}>灵契可能根据产品功能、审核规则、支付方式、部署环境和法律合规要求更新本协议。更新后继续使用灵契，即视为你接受新的协议内容。重大变化会尽量在页面显著位置提示。</p>
      </Section>

      <Section title="十一、联系与备案">
        <p style={pStyle}>如需联系客服、申请发票、提交隐私请求、投诉举报或申诉审核结果，可以使用 <Link to="/contact" style={linkStyle}>站内信</Link> 或发送邮件至 <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>。经营主体信息见 <Link to="/business-license" style={linkStyle}>经营主体信息</Link>。ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={linkStyle}>{ICP_RECORD_NO}</a>；公安联网备案号当前办理中，完成后会继续公示。</p>
      </Section>
    </LegalLayout>
  );
}
