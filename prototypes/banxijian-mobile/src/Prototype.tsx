import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ChatBubbleIcon, CalendarIcon, CheckCircledIcon, MagnifyingGlassIcon, MixerHorizontalIcon, HomeIcon, ReaderIcon, PersonIcon, ArchiveIcon } from '@radix-ui/react-icons';
import { BottomSheet, FlowStack, KeyboardInput, KeyboardTextarea, MobileScroll, useFlow, useKeyboard, type FlowScreen } from './mobile';
import { calculateBanxijianQuote, evaluateDepositReturn, type SellerDepositTierFen } from '../../../api/banxijianRules';
import { demoDossiers, demoEvents, filterDossiers, type DemoDossier, type DemoEvent, type DossierKind } from './communityDemo';

type ProviderId = 'lin' | 'yue';
type Page = 'messages' | 'market' | 'detail' | 'booking' | 'chat' | 'orders' | 'order' | 'mine' | 'seller' | 'deposit' | 'listing' | 'home' | 'encyclopedia' | 'dossier' | 'event' | 'reputation' | 'demands' | 'demand-create';
type OrderStatus = 'requested' | 'confirmed' | 'reserved' | 'started' | 'completed' | 'aftersales';
type Order = { id: string; provider: ProviderId; date: string; place: string; script: string; note: string; serviceFen: number; travelFen: number; status: OrderStatus };
const providers = {
  lin: { name: '林川', city: '西安', photo: '/assets/performer-lin.png', tags: ['情感演绎', '可远征'], headline: '认真接住，每一次入戏。', intro: '擅长细腻、克制的情感表达。开场前一起确认角色理解与相处边界，让整场体验有始有终。', priceFen: 100_000, travelFen: 30_000, deposit: 50_000, score: '4.9', count: 26, dates: [12,13,18,19,20,26] },
  yue: { name: '知月', city: '西安', photo: '/assets/performer-yue.png', tags: ['角色共创', '同城优先'], headline: '让故事，落在真实的感受里。', intro: '喜欢和玩家一起聊角色的细节。擅长自然、松弛的演绎，也愿意在开场前听听你期待的故事。', priceFen: 80_000, travelFen: 0, deposit: 10_000, score: '4.8', count: 18, dates: [13,18,20,27] },
} as const;
const money = (fen: number) => `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const dateLabel = (date: string) => date ? `9月${Number(date.slice(-2))}日` : '选日期';
const isoDate = (day: number) => `2026-09-${String(day).padStart(2, '0')}`;
type DemoState = {
  city: string; budget: number; date: string; selected: ProviderId;
  booking: { place: string; script: string; note: string };
  order: Order | null; accepting: boolean; deposit: SellerDepositTierFen;
  dates: number[]; priceFen: number; listingPending: boolean;
  chats: { provider: ProviderId; text: string }[];
  demand: { title: string; date: string; budget: string } | null;
  dossierKind: DossierKind | '全部';
  reactions: Record<string, { stance?: '同意' | '反对'; joy?: boolean }>;
  comments: Record<string, string[]>;
};
const initialState: DemoState = {
  city: '西安', budget: 0, date: '', selected: 'lin',
  booking: { place: '', script: '', note: '' }, order: null,
  accepting: true, deposit: 50_000, dates: [...providers.lin.dates], priceFen: 100_000,
  listingPending: false, chats: [], demand: null,
  dossierKind: '全部', reactions: {}, comments: {},
};
const DemoContext = createContext<{ state: DemoState; setState: Dispatch<SetStateAction<DemoState>> } | null>(null);
const useDemo = () => { const context = useContext(DemoContext); if (!context) throw new Error('Demo provider missing'); return context; };
const titles: Record<Page, string> = { messages: '消息', market: '委托·伴戏间', detail: '委托师主页', booking: '预约确认', chat: '委托咨询', orders: '我的订单', order: '订单详情', mine: '我的剧幕录', seller: '卖家工作台', deposit: '我的保证金', listing: '编辑委托条', home: '剧幕录', encyclopedia: '剧幕录百科', dossier: '百科档案', event: '口碑事件', reputation: '红黑榜', demands: '委托需求', 'demand-create': '发布委托需求' };

function screen(page: Page, provider: ProviderId = 'lin', recordId = ''): FlowScreen {
  const id = `${page}-${recordId || provider}`;
  return {
    id, headerHeight: 72, footerHeight: ['detail','booking'].includes(page) ? 88 : 76,
    header: () => <Header page={page} />,
    footer: () => page === 'detail' ? <DetailActions provider={provider} /> : page === 'booking' ? <BookingActions provider={provider} /> : ['market','mine','home','encyclopedia','reputation'].includes(page) ? <Tabs page={page} /> : null,
    render: flow => <div inert={flow.current.id !== id} aria-hidden={flow.current.id !== id}><PageContent page={page} provider={provider} recordId={recordId} /></div>,
  };
}
function Header({page}: {page: Page}) {
  const flow = useFlow();
  return <div className="bx-header"><div className="bx-toolbar">
    {flow.canGoBack ? <button className="bx-icon" aria-label="返回上一页" onClick={flow.pop}><ChevronLeftIcon /></button> : <img className="bx-logo" src="/assets/jumulu/logo.png" alt="剧幕录" />}
    <strong>{titles[page]}</strong>{page !== 'messages' ? <button className="bx-icon" aria-label="消息" onClick={() => flow.push(screen('messages'))}><ChatBubbleIcon /></button> : <span className="bx-nav-spacer" />}
  </div><div className="bx-demo">交互预览 · 人物、评价、订单均为虚构示例</div></div>;
}
function Tabs({page}: {page: Page}) {
  const flow = useFlow();
  const tabs: [Page,string,string][] = [['home','首页','home'],['encyclopedia','百科','books'],['market','委托','briefcase'],['reputation','红黑榜','message-star'],['mine','我的','user-circle']];
  return <nav className="bx-tabs" aria-label="主导航">{tabs.map(([id,label,icon]) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => page !== id && flow.replace(screen(id))}>{id === 'home' ? <HomeIcon /> : <img src={`/assets/jumulu/tab-${icon}${page === id ? '-active' : ''}.png`} alt="" />}<span>{label}</span></button>)}</nav>;
}
function Content({children,className=''}: {children: ReactNode;className?:string}) { return <MobileScroll className="bx-scroll"><main className={`bx-content ${className}`}>{children}</main></MobileScroll>; }
function PageContent({page,provider,recordId}: {page: Page;provider: ProviderId;recordId:string}) {
  switch(page) {
    case 'messages': return <Messages />;
    case 'market': return <Market />;
    case 'detail': return <Detail provider={provider} />;
    case 'booking': return <Booking provider={provider} />;
    case 'chat': return <Chat provider={provider} />;
    case 'orders': return <Orders />;
    case 'order': return <OrderDetail />;
    case 'mine': return <Mine />;
    case 'seller': return <Seller />;
    case 'deposit': return <Deposit />;
    case 'listing': return <Listing />;
    case 'home': return <Home />;
    case 'encyclopedia': return <Encyclopedia />;
    case 'dossier': return <Dossier id={recordId} />;
    case 'event': return <EventDetail id={recordId} />;
    case 'reputation': return <Reputation />;
    case 'demands': return <Demands />;
    case 'demand-create': return <CreateDemand />;
  }
}
function SectionTitle({children,action}: {children: ReactNode;action?: ReactNode}) { return <div className="bx-section-title"><h2>{children}</h2>{action}</div>; }
function Row({label,children}: {label: string;children: ReactNode}) { return <div className="bx-row"><span>{label}</span><strong>{children}</strong></div>; }
function Notice({children}: {children: ReactNode}) { return <p className="bx-notice">{children}</p>; }
function Empty({title,children}: {title: string;children: ReactNode}) { return <div className="bx-empty"><CalendarIcon /><h3>{title}</h3>{children}</div>; }
function ProviderCard({id}: {id: ProviderId}) {
  const flow = useFlow(); const {state} = useDemo(); const p = providers[id];
  const deposit = id === 'lin' ? state.deposit : p.deposit;
  return <button className="bx-provider" aria-label={`查看${p.name}的主页`} onClick={() => flow.push(screen('detail',id))}>
    <div className="bx-photo-wrap"><img className="bx-photo" src={p.photo} alt={`${p.name}的AI虚构剧照`} /><span className="bx-photo-label">AI示例剧照</span></div>
    <div className="bx-provider-copy"><div className="bx-name"><h3>{p.name}</h3><span>{p.city}</span></div><p>{p.tags.join(' · ')}</p>
    <div className="bx-price">{money(id === 'lin' ? state.priceFen : p.priceFen)}<small> / 场</small></div>
    <div className="bx-card-foot"><span>{p.score}分 <small>· {p.count}条示例评价</small></span></div>
    {deposit > 0 && <span className="bx-deposit-tag">已缴保证金 {money(deposit)}</span>}</div>
  </button>;
}
function Market() {
  const {state,setState} = useDemo(); const flow = useFlow();
  const [query,setQuery] = useState(''); const [sheet,setSheet] = useState<'city'|'date'|'budget'|null>(null);
  const ids = (Object.keys(providers) as ProviderId[]).filter(id => {
    const p = providers[id]; const days: readonly number[] = id === 'lin' ? state.dates : p.dates;
    return (state.city === '全部城市' || p.city === state.city) && (!query || `${p.name}${p.tags.join('')}`.includes(query))
      && (!state.date || days.includes(Number(state.date.slice(-2)))) && (!state.budget || (id === 'lin' ? state.priceFen : p.priceFen) <= state.budget)
      && (id !== 'lin' || state.accepting);
  });
  return <><Content>
    <div className="bx-heading"><div><h1>找到合拍的委托师</h1><p>先聊期待，再确定这场相遇。</p></div></div>
    <label className="bx-search"><MagnifyingGlassIcon /><KeyboardInput aria-label="搜索委托师" placeholder="搜花名、角色或擅长方向" value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <div className="bx-filters"><button onClick={()=>setSheet('city')}>{state.city}<ChevronRightIcon /></button><button onClick={()=>setSheet('date')}><CalendarIcon />{dateLabel(state.date)}</button><button onClick={()=>setSheet('budget')}><MixerHorizontalIcon />{state.budget ? `${money(state.budget)}以内` : '预算'}</button></div>
    <div className="bx-subnav"><strong>找委托师 <small>{ids.length}</small></strong><button onClick={()=>flow.push(screen('demands'))}>看看委托需求<ChevronRightIcon /></button></div>
    {ids.length ? <div className="bx-provider-grid">{ids.map(id=><ProviderCard key={id} id={id} />)}</div> : <Empty title="暂时没有匹配的委托师"><p>换个日期或预算再看看。</p><button className="bx-secondary" onClick={()=>{setQuery('');setState(s=>({...s,city:'西安',budget:0,date:''}));}}>清除筛选</button></Empty>}
    <Notice>保证金标识不等于优质认证。你可以查看资料、成交评价，再决定是否预约。</Notice>
    <button className="bx-link-card" onClick={()=>flow.push(screen('seller'))}><div><strong>我是委托师</strong><span>管理委托条、档期与预约</span></div><ChevronRightIcon /></button>
  </Content>
  <BottomSheet open={sheet !== null} onOpenChange={open=>!open&&setSheet(null)} title={sheet==='city'?'选择城市':sheet==='date'?'选择日期':'选择预算'} description="筛选仅用于本地演示，不会发送请求。" snap={0.58}>
    <div className="bx-sheet-content">{sheet==='city' ? <div className="bx-options">{['西安','北京','上海','全部城市'].map(city=><button className={state.city===city?'selected':''} key={city} onClick={()=>{setState(s=>({...s,city}));setSheet(null);}}>{city}</button>)}</div> : sheet==='budget' ? <div className="bx-options">{[0,80_000,100_000,150_000].map(budget=><button className={state.budget===budget?'selected':''} key={budget} onClick={()=>{setState(s=>({...s,budget}));setSheet(null);}}>{budget ? `${money(budget)}以内`:'不限预算'}</button>)}</div> : <><Calendar selected={state.date} available={[12,13,18,19,20,26,27]} onSelect={date=>{setState(s=>({...s,date}));setSheet(null);}} /><button className="bx-text-button" onClick={()=>{setState(s=>({...s,date:''}));setSheet(null);}}>不限日期</button></>}</div>
  </BottomSheet></>;
}
function Calendar({selected,available,onSelect,editing=false}: {selected: string;available: readonly number[];onSelect: (date:string)=>void;editing?:boolean}) {
  return <div className="bx-calendar"><div className="bx-calendar-title"><strong>2026年9月</strong><span>{editing?'点击日期切换可接单状态':'蓝框日期可预约'}</span></div><div className="bx-week">{['一','二','三','四','五','六','日'].map(d=><span key={d}>{d}</span>)}</div><div className="bx-days"><span />{Array.from({length:30},(_,i)=>i+1).map(day=>{const enabled=editing?day>=12:available.includes(day); return <button key={day} aria-label={`9月${day}日${available.includes(day)?'可约':'不可约'}`} aria-pressed={selected===isoDate(day)} disabled={!enabled} className={`${available.includes(day)?'available':''} ${selected===isoDate(day)?'selected':''}`} onClick={()=>onSelect(isoDate(day))}>{day}{available.includes(day)&&<small>可约</small>}</button>;})}</div></div>;
}
function Detail({provider}: {provider:ProviderId}) {
  const {state,setState}=useDemo(); const p=providers[provider]; const flow=useFlow(); const [tab,setTab]=useState('介绍');
  return <Content><div className="bx-detail-photo"><img src={p.photo} alt={`${p.name}的AI虚构剧照`} /><span className="bx-photo-label">AI虚构人物 · 示例资料</span></div>
    <div className="bx-detail-name"><div><h1>{p.name}<span>{p.city}</span></h1><p>{p.tags.join(' · ')}</p></div><div className="bx-price">{money(provider==='lin'?state.priceFen:p.priceFen)}<small>/场</small></div></div>
    <div className="bx-inline-info"><span>8小时 / 场</span><span>报价可协商</span><span>车马费单列</span></div>
    <div className="bx-trust"><CheckCircledIcon /><span>保证金 {money(provider==='lin'?state.deposit:p.deposit)} <small>· 仅演示缴存状态</small></span></div>
    <button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('dossier','lin',provider))}>查看{p.name}的百科档案</button>
    <div className="bx-segments">{['介绍','档期','评价'].map(t=><button className={tab===t?'selected':''} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==='介绍'?<><SectionTitle>{p.headline}</SectionTitle><p className="bx-body">{p.intro}</p><div className="bx-panel"><Row label="可接方向">情感本 / 角色演绎</Row><Row label="服务范围">线下 · {p.city}</Row><Row label="加时与夜场">先沟通，双方确认后计入</Row></div><SectionTitle>相处边界</SectionTitle><p className="bx-body">服务内容、肢体接触范围与额外费用都需要提前确认；任何时候都可以明确表达拒绝。</p><button className="bx-link-card" onClick={()=>flow.push(screen('reputation'))}><div><strong>查看百科与社区口碑</strong><span>社区记录与平台成交评价分开展示</span></div><ChevronRightIcon /></button></>:tab==='档期'?<><Calendar selected={state.date} available={provider==='lin'?state.dates:p.dates} onSelect={date=>setState(s=>({...s,date}))} /><Notice>提交预约不会立即锁档。委托师确认后才锁定，预计24小时内答复。</Notice></>:<><SectionTitle>成交评价 <small>演示</small></SectionTitle><div className="bx-review"><strong>{p.score} / 5 <small>· {p.count}条示例</small></strong><p>沟通很清楚，也尊重角色与相处边界。</p><span>示例用户 · 已完成订单</span></div><Notice>这些是虚构展示数据，不代表真实口碑。</Notice></>}
  </Content>;
}
function DetailActions({provider}: {provider:ProviderId}) {
  const flow=useFlow(); return <div className="bx-actionbar"><button className="bx-secondary" onClick={()=>flow.push(screen('chat',provider))}><ChatBubbleIcon />免费咨询</button><button className="bx-primary" onClick={()=>flow.push(screen('booking',provider))}>选档期预约</button></div>;
}
function Booking({provider}: {provider:ProviderId}) {
  const {state,setState}=useDemo(); const p=providers[provider]; const [open,setOpen]=useState(false);
  const quote=calculateBanxijianQuote(provider==='lin'?state.priceFen:p.priceFen,p.travelFen);
  return <><Content><div className="bx-person-row"><img src={p.photo} alt="AI示例剧照" /><div><strong>{p.name} · {p.city}</strong><span>线下委托 / 8小时一场</span></div></div>
    <SectionTitle>这次想见的故事</SectionTitle><button className="bx-input-row" onClick={()=>setOpen(true)}><span>预约日期</span><strong>{state.date?dateLabel(state.date):'请选择可约日期'}</strong><CalendarIcon /></button>
    <label className="bx-field">剧本与角色<KeyboardInput placeholder="例如：情感本 · 指定角色（选填）" value={state.booking.script} onChange={e=>setState(s=>({...s,booking:{...s.booking,script:e.target.value}}))} /></label>
    <label className="bx-field">店家 / 见面地点<KeyboardInput placeholder="填写示例店家或地点" value={state.booking.place} onChange={e=>setState(s=>({...s,booking:{...s.booking,place:e.target.value}}))} /></label>
    <label className="bx-field">想提前聊的事<KeyboardTextarea rows={2} placeholder="角色理解、相处边界、时间安排…" value={state.booking.note} onChange={e=>setState(s=>({...s,booking:{...s.booking,note:e.target.value}}))} /></label>
    <SectionTitle>费用先说清楚</SectionTitle>{quote.status==='ready'&&<div className="bx-panel"><Row label="委托服务价款">{money(quote.servicePriceFen)}</Row><Row label="单列车马费（示例约定）">{money(quote.travelCostFen)}</Row><div className="bx-divider"/><Row label="预约时：20%服务款＋全额车马费">{money(quote.reservationTotalFen)}</Row><Row label="见面后：剩余80%服务款">{money(quote.meetingServiceBalanceFen)}</Row><Row label="服务＋交通合计">{money(quote.serviceAndTravelTotalFen)}</Row></div>}
    <Notice>本次只是发送预约申请，不付款、不锁档。车马费须双方事先确认；平台收费待定，未计入本预览。</Notice>
  </Content><BottomSheet open={open} onOpenChange={setOpen} title="选择可约日期" snap={0.6}><div className="bx-sheet-content"><Calendar selected={state.date} available={provider==='lin'?state.dates:p.dates} onSelect={date=>{setState(s=>({...s,date}));setOpen(false);}} /></div></BottomSheet></>;
}
function BookingActions({provider}: {provider:ProviderId}) {
  const {state,setState}=useDemo(); const flow=useFlow(); const [error,setError]=useState(''); const p=providers[provider];
  function submit() {
    const dates: readonly number[]=provider==='lin'?state.dates:p.dates;
    if (!state.date || !dates.includes(Number(state.date.slice(-2)))) return setError('请先选择可预约的日期');
    if (!state.booking.place.trim()) return setError('请填写店家或见面地点');
    if (state.order && !['completed'].includes(state.order.status)) return setError('演示已有一笔进行中订单，请先在“我的订单”查看');
    setState(s=>({...s,order:{id:'DEMO-0911',provider,date:s.date,...s.booking,serviceFen:provider==='lin'?s.priceFen:p.priceFen,travelFen:p.travelFen,status:'requested'}}));
    flow.replace(screen('order'));
  }
  return <div className="bx-booking-footer">{error&&<p role="alert">{error}</p>}<button className="bx-primary" onClick={submit}>发送预约申请 · 演示</button><small>无需支付，等待委托师确认</small></div>;
}
function Chat({provider}: {provider:ProviderId}) {
  const {state,setState}=useDemo();const flow=useFlow();const [message,setMessage]=useState('');const p=providers[provider];
  function send() { if(!message.trim())return;setState(s=>({...s,chats:[...s.chats,{provider,text:message.trim()}]}));setMessage(''); }
  return <Content><div className="bx-person-row"><img src={p.photo} alt="AI示例剧照"/><div><strong>{p.name} · {p.city}</strong><span>站内咨询免费 · 演示会话</span></div></div><div className="bx-chat-note">演示对话不会发送给任何真实用户</div><div className="bx-bubble">你好，可以先聊聊想约的日期、剧本和角色。<small>示例消息</small></div>{state.chats.filter(m=>m.provider===provider).map((m,i)=><div className="bx-bubble mine" key={i}>{m.text}<small>本地演示 · 未外发</small></div>)}
  <form className="bx-composer" onSubmit={e=>{e.preventDefault();send();}}><KeyboardTextarea aria-label="咨询消息" rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="写下你想咨询的内容…"/><button className="bx-primary" disabled={!message.trim()} type="submit">发送演示消息</button></form><button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('booking',provider))}>聊好了，去预约</button></Content>;
}
const statusLabels:Record<OrderStatus,string>={requested:'等待委托师确认',confirmed:'预约已确认 · 待预约款',reserved:'预约款演示完成 · 待见面',started:'尾款演示完成 · 服务中',completed:'服务完成 · 示例',aftersales:'售后处理中 · 示例'};
function Orders() { const {state}=useDemo(); const flow=useFlow();return <Content><SectionTitle>我买的委托</SectionTitle>{state.order?<button className="bx-link-card" onClick={()=>flow.push(screen('order'))}><div><strong>{providers[state.order.provider].name} · {dateLabel(state.order.date)}</strong><span>{statusLabels[state.order.status]}</span><span>服务＋交通 {money(state.order.serviceFen+state.order.travelFen)}</span></div><ChevronRightIcon /></button>:<Empty title="还没有预约"><p>先看看喜欢的委托师，聊清楚再约。</p><button className="bx-primary" onClick={()=>flow.push(screen('market'))}>去找委托师</button></Empty>}<Notice>咨询与订单分开保存。此预览刷新后会重置。</Notice></Content>; }
function OrderDetail() {
  const {state,setState}=useDemo(); const flow=useFlow();const o=state.order;
  if(!o)return <Orders/>;
  const p=providers[o.provider];const quote=calculateBanxijianQuote(o.serviceFen,o.travelFen);
  const setStatus=(status:OrderStatus)=>setState(s=>({...s,order:s.order?{...s.order,status}:null}));
  return <Content><div className="bx-order-status"><CheckCircledIcon/><h1>{statusLabels[o.status]}</h1><p>{o.status==='requested'?'申请不锁档，委托师确认后才锁定档期。':'所有状态仅用于演示，没有真实收付款。'}</p></div><div className="bx-person-row"><img src={p.photo} alt="AI示例剧照"/><div><strong>{p.name} · {p.city}</strong><span>{dateLabel(o.date)} · 8小时 / 场</span></div></div><div className="bx-panel"><Row label="地点">{o.place}</Row><Row label="剧本 / 角色">{o.script||'待咨询确认'}</Row><Row label="服务价款">{money(o.serviceFen)}</Row><Row label="车马费">{money(o.travelFen)}</Row>{quote.status==='ready'&&<><Row label="预约时应付">{money(quote.reservationTotalFen)}</Row><Row label="见面后尾款">{money(quote.meetingServiceBalanceFen)}</Row></>}</div>
  <Notice>订单保留发起时的价格和约定，不随之后的委托条改价而变化。示例编号：{o.id}</Notice>
  {o.status==='requested'?<button className="bx-primary bx-wide" onClick={()=>flow.push(screen('seller'))}>切到卖家工作台处理申请</button>:o.status==='confirmed'?<button className="bx-primary bx-wide" onClick={()=>setStatus('reserved')}>模拟预约付款 · 不扣款</button>:o.status==='reserved'?<button className="bx-primary bx-wide" onClick={()=>setStatus('started')}>模拟双方见面并付尾款 · 不扣款</button>:o.status==='started'?<><Notice>见面且尾款支付后，可申请提现车马费；服务价款仍按履约与售后规则结算。此原型不提供真实提现。</Notice><button className="bx-primary bx-wide" onClick={()=>setStatus('completed')}>模拟双方确认服务完成</button></>:o.status==='completed'?<button className="bx-secondary bx-wide" onClick={()=>setStatus('aftersales')}>模拟发起售后</button>:<Notice>售后没有结束，保证金退还资格会保持受限。此原型不模拟客服裁决或赔付。</Notice>}
  <button className="bx-text-button" onClick={()=>flow.push(screen('chat',o.provider))}>联系委托师</button></Content>;
}
function Messages() {
  const flow = useFlow(); const {state} = useDemo();
  return <Content><SectionTitle>通知与进展</SectionTitle>
    <button className="bx-link-card" onClick={()=>flow.push(screen('orders'))}><div><strong>订单消息</strong><span>{state.order ? `预约进展：${statusLabels[state.order.status]}` : '暂无订单消息'}</span></div><ChevronRightIcon/></button>
    <button className="bx-link-card" onClick={()=>flow.push(screen('listing'))}><div><strong>审核通知</strong><span>{state.listingPending ? '委托条修改待人工审核 · 演示' : '暂无新的审核通知'}</span></div><ChevronRightIcon/></button>
    <SectionTitle>会话</SectionTitle>{(['lin','yue'] as ProviderId[]).map(id=><button className="bx-link-card" key={id} onClick={()=>flow.push(screen('chat',id))}><div><strong>{providers[id].name} · {providers[id].city}</strong><span>{state.chats.filter(message=>message.provider===id).at(-1)?.text || '打开咨询会话 · 虚构示例'}</span></div><ChevronRightIcon/></button>)}
    <Notice>统一消息入口。这里的会话、审核和订单消息仍是本地演示，不向真实用户发送。</Notice></Content>;
}
function Mine() { const flow=useFlow(); return <Content><div className="bx-user"><img src="/assets/jumulu/logo.png" alt="剧幕录"/><div><h1>我的剧幕录</h1><p>同一个账号，既能预约，也能接单。</p></div></div>{([['orders','我的订单','查看预约、履约和售后'],['messages','消息','会话、订单与审核通知'],['seller','卖家工作台','委托条、档期和接单'],['deposit','我的保证金','自愿缴纳与退还']] as [Page,string,string][]).map(([page,title,desc])=><button className="bx-link-card" key={page} onClick={()=>flow.push(screen(page))}><div><strong>{title}</strong><span>{desc}</span></div><ChevronRightIcon/></button>)}<Notice>演示账号没有真实身份、资产或交易。</Notice></Content>; }
function Seller() {
  const {state,setState}=useDemo();const flow=useFlow();
  if(state.order?.provider==='yue') return <Content><SectionTitle>知月的预约处理演示</SectionTitle><Notice>临时切换到知月的演示身份，只处理她自己的预约。林川的档期、保证金与委托条不会被修改。</Notice><div className="bx-panel"><Row label="预约时间">{dateLabel(state.order.date)}</Row><Row label="地点">{state.order.place}</Row><Row label="状态">{statusLabels[state.order.status]}</Row>{state.order.status==='requested'&&<button className="bx-primary bx-wide" onClick={()=>{setState(s=>({...s,order:s.order?{...s.order,status:'confirmed'}:null}));flow.push(screen('order'));}}>确认预约 · 演示</button>}</div><button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('order'))}>查看这笔演示订单</button></Content>;
  return <Content><div className="bx-heading"><div><h1>林川的工作台</h1><p>管理自己的委托，不由平台派单。</p></div><span className="bx-label">演示卖家</span></div><div className="bx-stats"><div><strong>{state.order&&state.order.status==='requested'?1:0}</strong><span>待确认预约</span></div><div><strong>{state.dates.length}</strong><span>可接单日期</span></div><div><strong>{money(state.deposit)}</strong><span>示例保证金</span></div></div>
  <div className="bx-toggle-row"><div><strong>接受新预约</strong><span>关闭不会取消已有订单</span></div><button role="switch" aria-checked={state.accepting} className={`bx-toggle ${state.accepting?'on':''}`} onClick={()=>setState(s=>({...s,accepting:!s.accepting}))}>{state.accepting?'接单中':'已暂停'}</button></div>
  {state.order&&<><SectionTitle>预约申请</SectionTitle><div className="bx-panel"><Row label="委托师">{providers[state.order.provider].name}</Row><Row label="预约时间">{dateLabel(state.order.date)}</Row><Row label="地点">{state.order.place}</Row><Row label="状态">{statusLabels[state.order.status]}</Row>{state.order.status==='requested'&&<button className="bx-primary bx-wide" onClick={()=>{setState(s=>({...s,order:s.order?{...s.order,status:'confirmed'}:null}));flow.push(screen('order'));}}>确认预约 · 演示</button>}</div></>}
  <button className="bx-link-card" onClick={()=>flow.push(screen('listing'))}><div><strong>我的委托条</strong><span>{state.listingPending?'修改已提交审核 · 演示':'修改内容与报价，提交人工审核'}</span></div><ChevronRightIcon/></button>
  <SectionTitle>我的档期</SectionTitle><Calendar editing selected="" available={state.dates} onSelect={date=>{const day=Number(date.slice(-2));setState(s=>({...s,dates:s.dates.includes(day)?s.dates.filter(d=>d!==day):[...s.dates,day]}));}}/><Notice>蓝框代表可约；点击切换。本原型只演示手动档期，真实锁档冲突会由订单系统校验。</Notice><button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('deposit'))}>保证金与退还</button></Content>;
}
function Deposit() {
  const {state,setState}=useDemo();const [chosen,setChosen]=useState<SellerDepositTierFen>(state.deposit);const [notice,setNotice]=useState('');
  const ownOrder=state.order?.provider==='lin'?state.order:null;
  const eligibility=evaluateDepositReturn({acceptingOrders:state.accepting,openOrderCount:ownOrder&&ownOrder.status!=='completed'?1:0,unresolvedAftersalesCount:ownOrder?.status==='aftersales'?1:0,availableDepositFen:state.deposit});
  const labels={still_accepting_orders:'请先暂停接受新预约',open_orders:'还有未完成订单',unresolved_aftersales:'售后尚未结束',no_available_deposit:'暂无可退保证金',unverified_state:'尚未核实状态'};
  return <Content><SectionTitle>自愿缴纳，不影响正常接单资格</SectionTitle><p className="bx-body">已缴会展示保证金标识，档位越高，排序加权越高；不代表服务质量认证。</p><div className="bx-balance"><span>当前示例保证金</span><strong>{money(state.deposit)}</strong><small>本地演示 · 非真实资产</small></div><div className="bx-deposit-options">{([0,10_000,50_000,100_000] as SellerDepositTierFen[]).map(value=><button aria-pressed={chosen===value} className={chosen===value?'selected':''} key={value} onClick={()=>{setChosen(value);setNotice('');}}>{value?money(value):'暂不缴纳'}</button>)}</div><button className="bx-primary bx-wide" disabled={chosen<=state.deposit} onClick={()=>{setState(s=>({...s,deposit:chosen}));setNotice('已更新演示档位，没有真实扣款。');}}>模拟缴存 / 升档 · 不扣款</button>{chosen<state.deposit&&<Notice>已有保证金不能通过选低档直接退回，请使用下方退还流程。</Notice>}
  <SectionTitle>退出接单后，剩余金额可退</SectionTitle><p className="bx-body">停止接单，所有订单和售后都结束后，可以申请退还剩余保证金。</p>{!eligibility.eligible&&<ul className="bx-blockers">{eligibility.blockers.map(reason=><li key={reason}>{labels[reason]}</li>)}</ul>}<button className="bx-secondary bx-wide" disabled={!eligibility.eligible} onClick={()=>{setState(s=>({...s,deposit:0}));setChosen(0);setNotice('退还流程演示完成，没有真实退款。');}}>模拟退还剩余保证金</button>{notice&&<Notice>{notice}</Notice>}<Notice>扣赔流程、实际退款时效与渠道能力待确认。本页不承诺即时到账。</Notice></Content>;
}
function Listing() {
  const {state,setState}=useDemo();const [price,setPrice]=useState(String(state.priceFen/100));const [intro,setIntro]=useState<string>(providers.lin.intro);const [sent,setSent]=useState(false);const [error,setError]=useState('');
  return <Content><SectionTitle>修改委托条</SectionTitle><label className="bx-field">每场报价（元）<KeyboardInput inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="bx-field">服务介绍<KeyboardTextarea rows={5} value={intro} onChange={e=>setIntro(e.target.value)}/></label><Notice>首次发布与修改均需人工审核。提交不会立即替换已公开版本，也不会改变历史订单。</Notice><button className="bx-primary bx-wide" onClick={()=>{if(!/^\d+(\.\d{1,2})?$/.test(price)||Number(price)<=0||!intro.trim())return setError('请填写有效报价与服务介绍');setState(s=>({...s,listingPending:true}));setSent(true);setError('');}}>提交审核 · 演示</button>{error&&<p role="alert" className="bx-error">{error}</p>}{sent&&<div className="bx-success"><CheckCircledIcon/><strong>修改已进入演示审核队列</strong><p>当前公开报价仍为 {money(state.priceFen)}，等待人工审核。</p></div>}</Content>;
}
function DossierCard({item,compact=false}: {item:DemoDossier;compact?:boolean}) {
  const flow=useFlow();
  const Icon=item.kind==='DM'?PersonIcon:item.kind==='店家'?HomeIcon:item.kind==='剧本'?ReaderIcon:ArchiveIcon;
  return <button className={`bx-dossier-card ${compact?'compact':''}`} onClick={()=>flow.push(screen('dossier','lin',item.id))}>
    {item.provider?<img src={providers[item.provider].photo} alt={`${item.name}的AI虚构剧照`}/>:<Icon/>}
    <div><strong>{item.name}<small>{item.kind} · {item.city}</small></strong><p>{item.summary}</p>{!compact&&<span>{item.source}</span>}</div><ChevronRightIcon/>
  </button>;
}
function EventCard({item,compact=false}: {item:DemoEvent;compact?:boolean}) {
  const flow=useFlow();
  return <button className={`bx-event-card ${compact?'compact':''}`} onClick={()=>flow.push(screen('event','lin',item.id))}>
    <span className={`bx-event-kind ${item.kind==='红榜'?'red':item.kind==='黑榜'?'black':'white'}`}>{item.kind}</span>
    <h3>{item.title}</h3><p>{item.subject}</p><div className="bx-event-tags">{item.tags.map(tag=><span key={tag}>{tag}</span>)}<small>示例 · 查看进展</small></div>
  </button>;
}
function Home() {
  const flow=useFlow();const {state,setState}=useDemo();
  const browse=(kind:DossierKind|'全部')=>{setState(s=>({...s,dossierKind:kind}));flow.replace(screen('encyclopedia'));};
  return <Content className="bx-home-content">
    <div className="bx-heading"><div><h1>散场后，那段没说完的事</h1><p>查店家、评 DM，找到合拍的演绎。</p></div></div>
    <button className="bx-search bx-wide" onClick={()=>browse('全部')}><MagnifyingGlassIcon/><span>搜 DM、店家、剧本或角色</span></button>
    <div className="bx-category-grid">{(['DM','店家','剧本','角色'] as DossierKind[]).map(kind=><button key={kind} onClick={()=>browse(kind)}>{kind}百科</button>)}</div>
    <SectionTitle action={<button className="bx-section-action" onClick={()=>browse('全部')}>查档案与评分</button>}>店家与 DM · 口碑档案</SectionTitle>
    <DossierCard item={demoDossiers[0]} compact/><DossierCard item={demoDossiers[2]} compact/>
    <SectionTitle action={<button className="bx-section-action" onClick={()=>flow.replace(screen('reputation'))}>进入红黑榜</button>}>口碑 · 最近进展</SectionTitle>
    <EventCard item={demoEvents[0]} compact/>
    <SectionTitle action={<button className="bx-section-action" onClick={()=>flow.replace(screen('market'))}>找委托师</button>}>委托 · 伴戏间</SectionTitle>
    <div className="bx-home-services">{(['lin','yue'] as ProviderId[]).filter(id=>id!=='lin'||state.accepting).map(id=><button key={id} onClick={()=>flow.push(screen('detail',id))}><img src={providers[id].photo} alt="AI虚构剧照"/><div><strong>{providers[id].name}<small>{providers[id].city}</small></strong><p>{providers[id].tags[0]}</p><span>{money(id==='lin'?state.priceFen:providers[id].priceFen)}<small> / 场</small></span></div><ChevronRightIcon/></button>)}</div>
    <button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('demands'))}>有明确期待？发布委托需求</button>
  </Content>;
}
function Encyclopedia() {
  const {state,setState}=useDemo();const [query,setQuery]=useState('');const keyboard=useKeyboard();
  const items=filterDossiers(query,state.dossierKind);
  return <Content><div className="bx-heading"><div><h1>选店家，找 DM，先看口碑。</h1><p>人物与店家是主角，剧本与角色是关联资料。</p></div></div>
    <label className="bx-search"><MagnifyingGlassIcon/><KeyboardInput aria-label="搜索百科" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜名称、城市或擅长方向"/></label>
    <div className="bx-community-filters" aria-label="百科分类">{(['全部','DM','店家','剧本','角色'] as const).map(kind=><button key={kind} aria-pressed={state.dossierKind===kind} onClick={()=>{keyboard.hide();setState(s=>({...s,dossierKind:kind}));}}>{kind}</button>)}</div>
    <SectionTitle>百科档案 <small>{items.length}份虚构示例</small></SectionTitle>
    {items.map(item=><DossierCard key={item.id} item={item}/>)}
    {!items.length&&<Empty title="没有找到相关档案"><p>试试其他名称，或清除分类和关键词。</p><button className="bx-secondary" onClick={()=>{keyboard.hide();setQuery('');setState(s=>({...s,dossierKind:'全部'}));}}>清除百科筛选</button></Empty>}
    <Notice>百科收录不等于本人认领，也不等于开通委托。示例来源与身份标识只演示展示方式。</Notice>
  </Content>;
}
function Dossier({id}: {id:string}) {
  const flow=useFlow();const [tab,setTab]=useState('资料');
  const item=demoDossiers.find(d=>d.id===id)!;
  const events=demoEvents.filter(event=>event.dossier===item.id);
  return <Content>
    <div className="bx-dossier-heading"><span className="bx-label">{item.kind}百科 · 虚构示例</span><h1>{item.name}<small>{item.city}</small></h1><p>{item.summary}</p></div>
    <div className="bx-segments">{['资料','关联档案','社区记录'].map(label=><button key={label} className={tab===label?'selected':''} onClick={()=>setTab(label)}>{label}</button>)}</div>
    {tab==='资料'?<><div className="bx-panel">{item.facts.map(([label,value])=><Row key={label} label={label}>{value}</Row>)}<Row label="资料来源">{item.source}</Row></div><Notice>这是百科档案，不是商品页。资料来源、本人身份和店家任职关系分别核实。</Notice></>:tab==='关联档案'?<>{item.related.map(id=><DossierCard key={id} item={demoDossiers.find(d=>d.id===id)!}/>)}</>:<>{events.length?events.map(event=><EventCard key={event.id} item={event}/>):<div className="bx-panel"><strong>暂无关联社区记录</strong><p className="bx-body">没有记录不等于好评，也不代表风险已排除。</p></div>}<Notice>红黑榜记录具体事件，独立于订单评价与保证金排序。</Notice></>}
    {item.provider&&<button className="bx-link-card" onClick={()=>flow.push(screen('detail',item.provider))}><div><strong>找{item.name}委托</strong><span>本人已开通的服务入口 · 演示</span></div><ChevronRightIcon/></button>}
  </Content>;
}
function Reputation() {
  const [kind,setKind]=useState('全部');const [publish,setPublish]=useState(false);const [draft,setDraft]=useState('');const [sent,setSent]=useState(false);
  return <><Content><div className="bx-heading"><div><h1>店家与 DM，口碑有据可查。</h1><p>评分看体验，红黑榜看具体事件与回应。</p></div></div>
    <div className="bx-community-filters" aria-label="榜单分类">{['全部','红榜','黑榜','白榜'].map(label=><button key={label} aria-pressed={kind===label} onClick={()=>setKind(label)}>{label}</button>)}</div>
    <SectionTitle action={<button className="bx-section-action" onClick={()=>setPublish(true)}>写一条记录</button>}>最近进展 <small>虚构事件流</small></SectionTitle>
    {demoEvents.filter(item=>kind==='全部'||item.kind===kind).map(item=><EventCard key={item.id} item={item}/>)}
    {sent&&<div className="bx-panel" role="status"><strong>我的演示记录 · 待人工审核</strong><p className="bx-body">{draft}</p><small>仅保存在当前预览，未公开、未外发。</small></div>}
    <Notice>口碑不随保证金加权，不以付费改变。审核决定内容是否适合公开，不替代责任认定。</Notice>
  </Content><BottomSheet open={publish} onOpenChange={setPublish} title="写一条记录 · 本地演示" description="描述具体体验，不公开私密材料。正式发布仍需审核。" snap={0.72}><div className="bx-sheet-content"><label className="bx-field">事件经过<KeyboardTextarea rows={5} value={draft} onChange={e=>{setDraft(e.target.value);setSent(false);}} placeholder="仅填写虚构内容用于体验…" maxLength={600}/></label><button className="bx-primary bx-wide" disabled={!draft.trim()} onClick={()=>{setSent(true);setPublish(false);}}>提交演示审核 · 不公开</button></div></BottomSheet></>;
}
function EventDetail({id}: {id:string}) {
  const {state,setState}=useDemo();const [comment,setComment]=useState('');const [notice,setNotice]=useState('');const flow=useFlow();
  const event=demoEvents.find(item=>item.id===id)!;const reaction=state.reactions[event.id]||{};
  function react(value:'同意'|'反对'|'欢乐') {setState(s=>{const previous=s.reactions[event.id]||{};return {...s,reactions:{...s.reactions,[event.id]:value==='欢乐'?{...previous,joy:!previous.joy}:{...previous,stance:previous.stance===value?undefined:value}}};});}
  return <Content><span className="bx-label">{event.kind} · 虚构事件</span><div className="bx-event-heading"><h1>{event.title}</h1><p>{event.subject}</p></div><div className="bx-event-tags">{event.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
    <SectionTitle>事件记录</SectionTitle><p className="bx-body">{event.summary}</p>
    <div className="bx-response"><strong>相关方回应 / 当前进展</strong><p>{event.response}</p><small>示例更新时间：2026年9月13日 · 以详情页最新状态为准</small></div>
    {event.dossier&&<button className="bx-secondary bx-wide" onClick={()=>flow.push(screen('dossier','lin',event.dossier))}>查看关联百科档案</button>}
    <div className="bx-community-filters" aria-label="事件互动">{(['同意','反对','欢乐'] as const).map(label=><button key={label} aria-pressed={label==='欢乐'?!!reaction.joy:reaction.stance===label} onClick={()=>react(label)}>{label}{(label==='欢乐'?reaction.joy:reaction.stance===label)?' · 已选':''}</button>)}</div>
    <Notice>立场票同意 / 反对二选一，欢乐独立。这里仅演示交互，未产生真实投票。</Notice>
    <SectionTitle>讨论与补充</SectionTitle><p className="bx-body">围绕具体体验讨论，不公开他人的隐私。</p>
    {(state.comments[event.id]||[]).map((text,index)=><div className="bx-panel" key={index}><small>我的补充 · 演示待审核</small><p className="bx-body">{text}</p></div>)}
    <form onSubmit={e=>{e.preventDefault();if(!comment.trim())return;setState(s=>({...s,comments:{...s.comments,[event.id]:[...(s.comments[event.id]||[]),comment.trim()]}}));setComment('');}}><label className="bx-field">补充讨论<KeyboardTextarea rows={2} value={comment} onChange={e=>setComment(e.target.value)} placeholder="仅填写虚构演示内容" maxLength={500}/></label><button className="bx-secondary bx-wide" disabled={!comment.trim()}>提交演示补充</button></form>
    <button className="bx-text-button" onClick={()=>setNotice('已演示进入举报流程，没有向平台提交真实举报。')}>举报此记录 · 演示</button>{notice&&<p role="status" className="bx-notice">{notice}</p>}
  </Content>;
}
function Demands() {const flow=useFlow();const {state}=useDemo();const [open,setOpen]=useState(false);return <><Content><div className="bx-heading"><div><h1>让合适的人找到你</h1><p>买家发布需求，委托师自主应征。</p></div></div><button className="bx-primary bx-wide" onClick={()=>flow.push(screen('demand-create'))}>发布我的需求</button><SectionTitle>西安 · 示例需求</SectionTitle><div className="bx-panel"><span className="bx-label">9月19日 · 情感演绎</span><h3>想约一场细腻自然的角色演绎</h3><p className="bx-body">希望提前沟通角色理解，预算800—1200元，车马费另议。</p><button className="bx-secondary bx-wide" onClick={()=>setOpen(true)}>我要应征 · 演示</button></div>{state.demand&&<div className="bx-panel"><span className="bx-label">我的需求 · 演示待审核</span><h3>{state.demand.title}</h3><p>{state.demand.date} · {state.demand.budget}</p></div>}</Content><BottomSheet open={open} onOpenChange={setOpen} title="应征演示已记录" description="没有向真实用户发送申请。正式功能会记录申请内容、审核状态和站内消息。" snap={0.35}><button className="bx-primary bx-wide" onClick={()=>setOpen(false)}>知道了</button></BottomSheet></>;}
function CreateDemand(){const {setState}=useDemo();const flow=useFlow();const [title,setTitle]=useState('');const [budget,setBudget]=useState('');const [error,setError]=useState('');return <Content><label className="bx-field">你想要怎样的委托<KeyboardTextarea rows={4} value={title} onChange={e=>setTitle(e.target.value)} placeholder="写下日期、剧本、角色与期待…"/></label><label className="bx-field">预算范围<KeyboardInput value={budget} onChange={e=>setBudget(e.target.value)} placeholder="例如800—1200元，车马费另议"/></label><Notice>本次提交只保存在演示内存，正式发布需要审核。</Notice><button className="bx-primary bx-wide" onClick={()=>{if(!title.trim()||!budget.trim())return setError('请填写需求与预算');setState(s=>({...s,demand:{title:title.trim(),date:'日期见需求说明',budget:budget.trim()}}));flow.pop();}}>提交需求审核 · 演示</button>{error&&<p className="bx-error" role="alert">{error}</p>}</Content>;}
function useKeepFieldAboveActions() {
  const keyboard=useKeyboard();
  useEffect(()=>{
    const field=keyboard.focusedElement;
    const scroll=field?.closest<HTMLElement>('.mobile-scroll');
    if(!keyboard.visible||!field||!scroll)return;
    // Only scroll this form, never scrollIntoView on the outer phone frame.
    const reveal=()=>{
      const bounds=scroll.getBoundingClientRect();
      const scale=bounds.height/scroll.clientHeight;
      const footer=field.closest('.flow-stack')?.querySelector('.flow-fixed-footer')?.getBoundingClientRect();
      const lower=Math.min(bounds.bottom,footer?.top??bounds.bottom)-12*scale;
      const rect=field.getBoundingClientRect();
      if(rect.bottom>lower)scroll.scrollTop+=(rect.bottom-lower)/scale;
      else if(rect.top<bounds.top+12*scale)scroll.scrollTop-=(bounds.top+12*scale-rect.top)/scale;
    };
    const observer=new ResizeObserver(reveal);observer.observe(scroll);reveal();
    return()=>observer.disconnect();
  },[keyboard.visible,keyboard.focusedElement]);
}
export default function Prototype() { const [state,setState]=useState<DemoState>(initialState);useKeepFieldAboveActions();useEffect(()=>{document.title='剧幕录｜百科、口碑与委托交互预览';},[]);return <DemoContext.Provider value={{state,setState}}><div className="bx-app"><FlowStack initial={screen('home')}/></div></DemoContext.Provider>; }
