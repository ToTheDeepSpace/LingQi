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
        <div className="w-10 h-10 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-5" />
        <p className="text-base text-ink-300">加载中...</p>
      </div>
    </div>
  );

  if (!creator) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6 opacity-20">🌊</div>
        <p className="text-lg text-ink-400 mb-5">创作者不存在</p>
        <Link to="/explore" className="text-sm text-gold-600 underline hover:text-gold-500 font-medium">返回发现页</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
        <Link to="/explore" className="text-sm text-ink-400 hover:text-gold-600 mb-8 inline-block transition-colors font-medium">
          ← 返回发现
        </Link>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left sidebar */}
          <div className="lg:w-[350px] shrink-0 space-y-5">
            {/* Profile card — 毛玻璃 */}
            <div className="glass-card rounded-[1.25rem] p-6 lg:p-7">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-3xl lg:text-4xl shrink-0 border border-gold-200/50 avatar-glow">
                  {creator.avatar ? (
                    <img src={creator.avatar} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <span>🎭</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h1 className="text-2xl lg:text-3xl font-bold text-ink-900 leading-tight">{creator.display_name}</h1>
                  <p className="text-sm text-ink-400 mt-2">
                    {creator.city} {creator.role_type && `· ${creator.role_type}`}
                  </p>
                </div>
              </div>
              {creator.bio && (
                <p className="text-sm text-ink-500 mt-6 leading-relaxed">{creator.bio}</p>
              )}
              {creator.tags && creator.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-5">
                  {creator.tags.map((t, i) => (
                    <span key={i} className="tag-pill">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Contact card — 玻璃态 */}
            <div className="glass-card rounded-[1.25rem] p-6 lg:p-7">
              <h2 className="font-bold text-ink-800 mb-5 text-base">联系创作者</h2>
              {contactFormShown ? (
                <div className="space-y-3.5">
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm bg-cream/70 placeholder:text-ink-300"
                    placeholder="你的称呼" />
                  <input type="text" value={formWechat} onChange={e => setFormWechat(e.target.value)}
                    className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm bg-cream/70 placeholder:text-ink-300"
                    placeholder="你的微信号" />
                  <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)}
                    className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm bg-cream/70 placeholder:text-ink-300 h-20 resize-none"
                    placeholder="想预约什么？（可选）" />
                  <button onClick={submitContactRequest} disabled={contactSent}
                    className="w-full py-3 bg-gradient-to-r from-ink-800 to-ink-700 text-white text-sm rounded-[0.75rem] hover:from-ink-700 hover:to-ink-600 disabled:opacity-50 transition-all font-medium shadow-md">
                    {contactSent ? '已发送 ✓ 等待创作者通过' : '发送申请'}
                  </button>
                  <p className="text-xs text-ink-400 text-center">创作者通过后你将看到对方的微信</p>
                </div>
              ) : (
                <button onClick={() => setContactFormShown(true)}
                  className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-400 text-white text-sm rounded-[0.75rem] hover:from-gold-400 hover:to-gold-300 transition-all font-medium shadow-md shadow-gold-500/20">
                  申请联系方式
                </button>
              )}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Services */}
            {services.length > 0 && (
              <div className="glass-card rounded-[1.25rem] p-6 lg:p-7">
                <h2 className="font-bold text-ink-800 mb-5 text-base">可接服务</h2>
                <div className="divide-y divide-gold-100/60">
                  {services.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div>
                        <span className="text-sm font-semibold text-ink-800">{s.service_type}</span>
                        {s.duration && <span className="text-sm text-ink-400 ml-2">· {s.duration}</span>}
                        {s.description && <p className="text-xs text-ink-400 mt-1">{s.description}</p>}
                      </div>
                      <span className="text-lg font-bold gradient-text-gold shrink-0 ml-4">¥{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            {availDates.length > 0 && (
              <div className="glass-card rounded-[1.25rem] p-6 lg:p-7">
                <h2 className="font-bold text-ink-800 mb-5 text-base">可约日期</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {availDates.slice(0, 30).map(d => (
                    <span key={d} className="tag-pill">{d.slice(5)}</span>
                  ))}
                  {availDates.length > 30 && (
                    <span className="text-sm text-ink-400 self-center">+{availDates.length - 30} 天</span>
                  )}
                </div>
                <details>
                  <summary className="text-sm text-gold-600 cursor-pointer hover:text-gold-500 font-medium">查看日历</summary>
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
              <div className="glass-card rounded-[1.25rem] p-6 lg:p-7">
                <h2 className="font-bold text-ink-800 mb-5 text-base">作品集</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {portfolio.map(p => (
                    <div key={p.id} className="aspect-square rounded-xl bg-gold-100 overflow-hidden img-zoom shadow-sm">
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
