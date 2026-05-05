import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import type { Creator, Service, Portfolio } from '../types';

const API = '/api';

export default function CreatorProfile() {
  const { id } = useParams();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [contactFormShown, setContactFormShown] = useState(false);
  const [formName, setFormName] = useState('');
  const [formWechat, setFormWechat] = useState('');
  const [formMsg, setFormMsg] = useState('');
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API}/lc/creators/${id}`).then(r => r.json()),
      fetch(`${API}/lc/creators/${id}/availability`).then(r => r.json()),
    ]).then(([profileData, availData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
      }
      if (availData.success) setAvailDates((availData.data || []).map((a: { date: string }) => a.date));
    }).finally(() => setLoading(false));
  }, [id]);

  const submitContactRequest = async () => {
    if (!formName || !formWechat) return;
    await fetch(`${API}/lc/contact-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId: id, requesterName: formName, requesterWechat: formWechat, message: formMsg }),
    });
    setContactSent(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-base text-ink-300">加载中...</p>
      </div>
    </div>
  );

  if (!creator) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-5 opacity-25">🌊</div>
        <p className="text-base text-ink-400 mb-4">创作者不存在</p>
        <Link to="/explore" className="text-sm text-gold-600 underline hover:text-gold-500">返回发现页</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
        <Link to="/explore" className="text-sm text-ink-400 hover:text-gold-600 mb-6 inline-block transition-colors">← 返回发现</Link>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left sidebar */}
          <div className="lg:w-[340px] shrink-0 space-y-5">
            {/* Profile card */}
            <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-2xl lg:text-3xl shrink-0 border border-gold-200/60">
                  {creator.avatar ? (
                    <img src={creator.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold-400">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl lg:text-2xl font-bold text-ink-900 leading-tight">{creator.display_name}</h1>
                  <p className="text-sm text-ink-400 mt-1">
                    {creator.city} {creator.role_type && `· ${creator.role_type}`}
                  </p>
                </div>
              </div>
              {creator.bio && (
                <p className="text-sm text-ink-500 mt-5 leading-relaxed">{creator.bio}</p>
              )}
              {creator.tags && creator.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {creator.tags.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-gold-50 text-gold-700 rounded text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Contact card */}
            <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
              <h2 className="font-semibold text-ink-800 mb-4 text-base">联系创作者</h2>
              {contactFormShown ? (
                <div className="space-y-3">
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm focus:outline-none focus:border-gold-400 bg-cream placeholder:text-ink-300" placeholder="你的称呼" />
                  <input type="text" value={formWechat} onChange={e => setFormWechat(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm focus:outline-none focus:border-gold-400 bg-cream placeholder:text-ink-300" placeholder="你的微信号" />
                  <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm focus:outline-none focus:border-gold-400 bg-cream placeholder:text-ink-300 h-20 resize-none" placeholder="想预约什么？（可选）" />
                  <button onClick={submitContactRequest} disabled={contactSent}
                    className="w-full py-2.5 bg-ink-800 text-white text-sm rounded-[0.75rem] hover:bg-ink-700 disabled:opacity-50 transition-colors">
                    {contactSent ? '已发送 ✓ 等待创作者通过' : '发送申请'}
                  </button>
                  <p className="text-xs text-ink-400 text-center">创作者通过后你将看到对方的微信</p>
                </div>
              ) : (
                <button onClick={() => setContactFormShown(true)}
                  className="w-full py-2.5 bg-ink-800 text-white text-sm rounded-[0.75rem] hover:bg-ink-700 transition-colors">
                  申请联系方式
                </button>
              )}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Services */}
            {services.length > 0 && (
              <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
                <h2 className="font-semibold text-ink-800 mb-4 text-base">可接服务</h2>
                <div className="divide-y divide-gold-100">
                  {services.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div>
                        <span className="text-sm font-medium text-ink-800">{s.service_type}</span>
                        {s.duration && <span className="text-sm text-ink-400 ml-2">· {s.duration}</span>}
                        {s.description && <p className="text-xs text-ink-400 mt-0.5">{s.description}</p>}
                      </div>
                      <span className="text-base font-bold text-gold-600 shrink-0 ml-4">¥{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            {availDates.length > 0 && (
              <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
                <h2 className="font-semibold text-ink-800 mb-4 text-base">可约日期</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {availDates.slice(0, 30).map(d => (
                    <span key={d} className="px-3 py-1.5 bg-gold-50 text-gold-700 rounded text-sm">{d.slice(5)}</span>
                  ))}
                  {availDates.length > 30 && (
                    <span className="text-sm text-ink-400 self-center">+{availDates.length - 30} 天</span>
                  )}
                </div>
                <details>
                  <summary className="text-sm text-gold-600 cursor-pointer hover:text-gold-500">查看日历</summary>
                  <div className="mt-4 max-w-sm">
                    <Calendar
                      tileClassName={({ date }) => {
                        const ds = date.toISOString().split('T')[0];
                        return availDates.includes(ds) ? 'bg-gold-100 text-gold-700 rounded-full font-bold' : '';
                      }}
                      className="border-0 w-full text-sm"
                      minDate={new Date()}
                    />
                  </div>
                </details>
              </div>
            )}

            {/* Portfolio */}
            {portfolio.length > 0 && (
              <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
                <h2 className="font-semibold text-ink-800 mb-4 text-base">作品集</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {portfolio.map(p => (
                    <div key={p.id} className="aspect-square rounded-lg bg-gold-100 overflow-hidden">
                      <img src={p.image_url} alt={p.caption || ''} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
