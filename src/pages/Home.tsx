import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { flattenScriptRoles } from '../lib/scriptRoleCatalog';
import type { ScriptCatalogItem } from '../types';
import './Home.css';

type SearchType = 'dm' | 'store' | 'role';

type RatingSummary = {
  avg: number | null;
  review_count: number;
  player_count: number;
};

type DossierItem = {
  id: string;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  employment_status?: string | null;
  photo_url?: string | null;
  photo_focus_x?: number | null;
  photo_focus_y?: number | null;
  note?: string | null;
  tags?: string[];
  rating_tags?: string[];
  rating_summary?: RatingSummary | null;
};

type RankingItem = {
  id: string;
  type?: string;
  subject_name?: string;
  subject_city?: string;
  content?: string;
  comment_count?: number;
  vote_count?: number;
};

type ProviderListing = {
  id: string;
  headline?: string;
  description?: string;
  profile?: {
    id?: string;
    display_name?: string;
    city?: string;
    avatar?: string;
    avatar_focus_x?: number;
    avatar_focus_y?: number;
  };
};

type HomeSearchResult = {
  id: string;
  title: string;
  meta: string;
  to: string;
};

const SEARCH_TYPES: Array<{ value: SearchType; label: string }> = [
  { value: 'dm', label: 'DM' },
  { value: 'store', label: '店家' },
  { value: 'role', label: '角色点评' },
];

export default function Home() {
  const navigate = useNavigate();
  const [dmItems, setDmItems] = useState<DossierItem[]>([]);
  const [storeItems, setStoreItems] = useState<DossierItem[]>([]);
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [providerListings, setProviderListings] = useState<ProviderListing[]>([]);
  const [searchType, setSearchType] = useState<SearchType>('dm');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const request = (url: string) => fetch(url, { signal: controller.signal })
        .then(response => response.json())
        .catch(() => ({ success: false, data: [] }));
      const [dmPayload, storePayload, scriptPayload, rankingPayload, providerPayload] = await Promise.all([
        request('/api/lc/dm-dossiers?entityType=dm'),
        request('/api/lc/dm-dossiers?entityType=store'),
        request('/api/lc/scripts'),
        request('/api/lc/rankings?sort=discussed'),
        request('/api/lc/provider-listings?limit=4'),
      ]);
      if (controller.signal.aborted) return;
      setDmItems(dmPayload.success ? dmPayload.data || [] : []);
      setStoreItems(storePayload.success ? storePayload.data || [] : []);
      setScripts(scriptPayload.success ? scriptPayload.data || [] : []);
      setRankings(rankingPayload.success ? rankingPayload.data || [] : []);
      setProviderListings(providerPayload.success ? providerPayload.data || [] : []);
    };
    void load();
    return () => controller.abort();
  }, []);

  const allRoles = useMemo(() => flattenScriptRoles(scripts), [scripts]);
  const ratedRoles = useMemo(() => allRoles
    .filter(role => Number(role.rating_count || 0) > 0)
    .sort((left, right) => {
      const countDifference = Number(right.rating_count || 0) - Number(left.rating_count || 0);
      if (countDifference) return countDifference;
      return Number(right.rating_avg || 0) - Number(left.rating_avg || 0);
    }), [allRoles]);

  const featuredDm = useMemo(() => [...dmItems]
    .sort((left, right) => {
      const imageDifference = Number(Boolean(right.photo_url)) - Number(Boolean(left.photo_url));
      if (imageDifference) return imageDifference;
      return Number(right.rating_summary?.avg || 0) - Number(left.rating_summary?.avg || 0);
    })[0], [dmItems]);

  const searchResults = useMemo<HomeSearchResult[]>(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return [];
    if (searchType === 'role') {
      return allRoles
        .filter(role => `${role.role_name} ${role.script_name}`.toLocaleLowerCase('zh-CN').includes(normalized))
        .slice(0, 6)
        .map(role => ({
          id: role.target_id,
          title: role.role_name,
          meta: `《${role.script_name}》${role.rating_count ? ` · ${role.rating_count} 人评分` : ''}`,
          to: `/scripts/roles/${encodeURIComponent(role.target_id)}`,
        }));
    }
    const source = searchType === 'dm' ? dmItems : storeItems;
    return source
      .filter(item => [
        item.dm_name,
        item.city,
        item.workplace,
        ...(item.tags || []),
        ...(item.rating_tags || []),
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(normalized))
      .slice(0, 6)
      .map(item => ({
        id: item.id,
        title: item.dm_name,
        meta: [item.city, item.workplace, item.rating_summary?.avg ? `${item.rating_summary.avg.toFixed(1)} 分` : '暂无评分'].filter(Boolean).join(' · '),
        to: searchType === 'dm' ? `/dm/${encodeURIComponent(item.id)}` : `/stores/${encodeURIComponent(item.id)}`,
      }));
  }, [allRoles, dmItems, query, searchType, storeItems]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchResults[0]) {
      navigate(searchResults[0].to);
      return;
    }
    navigate(searchType === 'dm' ? '/dm' : searchType === 'store' ? '/stores' : '/scripts');
  };

  const featuredPhoto = featuredDm?.photo_url || generatedAvatarDataUrl(featuredDm?.dm_name || '剧幕录', featuredDm?.id || 'jumulu');
  const featuredTags = [...new Set([...(featuredDm?.rating_tags || []), ...(featuredDm?.tags || [])].filter(Boolean))].slice(0, 4);

  return (
    <main className="home-product">
      <section className="home-discovery">
        <div className="home-discovery-copy">
          <p className="home-kicker">剧幕录 · DM百科</p>
          <h1>查 DM，也查他在哪家店、带过什么本</h1>
          <p className="home-intro">
            把 DM 档案、店家关系、玩家评分和相关社区讨论放在一起，先看清楚，再决定跟谁入戏。
          </p>

          <form className="home-search" onSubmit={submitSearch}>
            <div className="home-search-types" aria-label="搜索类型">
              {SEARCH_TYPES.map(item => (
                <button
                  key={item.value}
                  type="button"
                  className={searchType === item.value ? 'is-active' : ''}
                  aria-pressed={searchType === item.value}
                  onClick={() => setSearchType(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="home-search-field">
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchType === 'dm' ? '输入 DM 名称、城市或店家' : searchType === 'store' ? '输入店家名称或城市' : '输入角色名或剧本名'}
                aria-label="搜索剧幕录"
              />
              <button type="submit">搜索</button>
            </div>
            {query.trim() && (
              <div className="home-search-results" aria-live="polite">
                {searchResults.length > 0 ? searchResults.map(result => (
                  <Link key={`${searchType}-${result.id}`} to={result.to}>
                    <strong>{result.title}</strong>
                    <span>{result.meta}</span>
                  </Link>
                )) : (
                  <Link to={searchType === 'dm' ? '/dm' : searchType === 'store' ? '/stores' : '/scripts'}>
                    <strong>没有找到完全匹配的结果</strong>
                    <span>进入完整资料库继续查找</span>
                  </Link>
                )}
              </div>
            )}
          </form>

          <div className="home-discovery-actions">
            <Link to="/dm"><strong>DM</strong><span>查档案</span></Link>
            <Link to="/stores"><strong>店家</strong><span>看口碑</span></Link>
            <Link to="/scripts"><strong>角色</strong><span>读点评</span></Link>
            <Link to="/rankings"><strong>红黑榜</strong><span>看事件</span></Link>
            <Link to="/commissions"><strong>委托</strong><span>找与接</span></Link>
            <Link to="/carpools"><strong>拼车</strong><span>找搭子</span></Link>
          </div>
        </div>

        <Link className="home-featured-dm" to={featuredDm ? `/dm/${encodeURIComponent(featuredDm.id)}` : '/dm'}>
          <img
            src={featuredPhoto}
            alt={featuredDm ? `${featuredDm.dm_name}的档案照片` : '剧幕录DM百科'}
            style={{ objectPosition: `${featuredDm?.photo_focus_x ?? 50}% ${featuredDm?.photo_focus_y ?? 25}%` }}
          />
          <div className="home-featured-overlay">
            <span>DM 档案</span>
            <div className="home-featured-name">
              <div>
                <h2>{featuredDm?.dm_name || '浏览 DM 百科'}</h2>
                <p>{[featuredDm?.city, featuredDm?.workplace || (featuredDm?.employment_status === 'freelance' ? '自由 DM' : '')].filter(Boolean).join(' · ') || '城市、店家和评分集中查看'}</p>
              </div>
              <strong>{featuredDm?.rating_summary?.avg?.toFixed(1) || '—'}</strong>
            </div>
            {featuredTags.length > 0 && (
              <div className="home-featured-tags">
                {featuredTags.map(tag => <small key={tag}>{tag}</small>)}
              </div>
            )}
          </div>
        </Link>
      </section>

      <section className="home-core-band">
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">交易与社区</p>
            <h2>DM 单飞后接委托，玩家也有地方讨论具体的人和事</h2>
          </div>
        </div>

        <div className="home-core-columns">
          <section className="home-commission-column">
            <div className="home-column-heading">
              <div>
                <span>DM 委托</span>
                <h3>找可以独立接单的 DM</h3>
              </div>
              <Link to="/commissions">进入委托市场</Link>
            </div>
            {providerListings.length > 0 ? (
              <div className="home-provider-list">
                {providerListings.slice(0, 3).map(listing => (
                  <Link key={listing.id} to="/commissions">
                    <img
                      src={listing.profile?.avatar || generatedAvatarDataUrl(listing.profile?.display_name || 'DM', listing.profile?.id || listing.id)}
                      alt=""
                      style={{ objectPosition: `${listing.profile?.avatar_focus_x ?? 50}% ${listing.profile?.avatar_focus_y ?? 25}%` }}
                    />
                    <span>
                      <strong>{listing.profile?.display_name || '未命名 DM'}</strong>
                      <small>{listing.headline || listing.description || '查看可接委托信息'}</small>
                    </span>
                    <b>{listing.profile?.city || '城市待补'}</b>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="home-empty-line">
                <strong>暂时还没有公开的单飞 DM 委托条</strong>
                <span>委托市场仍可发布需求和查看进行中的委托。</span>
              </div>
            )}
            <div className="home-column-actions">
              <Link to="/commissions/new">发布委托</Link>
              <Link to="/commissions">查看全部</Link>
            </div>
          </section>

          <section className="home-community-column">
            <div className="home-column-heading">
              <div>
                <span>社区</span>
                <h3>红黑榜只记录讨论，不参与综合评分</h3>
              </div>
              <Link to="/rankings">进入社区</Link>
            </div>
            {rankings.length > 0 ? (
              <div className="home-community-list">
                {rankings.slice(0, 3).map(item => (
                  <Link key={item.id} to={`/rankings/${encodeURIComponent(item.id)}`}>
                    <span className={`home-ranking-type is-${item.type || 'white'}`}>{rankingTypeLabel(item.type)}</span>
                    <span className="home-community-copy">
                      <strong>{item.subject_name || '社区讨论'}</strong>
                      <small>{item.content || '查看事件记录和相关回应'}</small>
                    </span>
                    <b>{item.comment_count || 0} 讨论</b>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="home-empty-line">
                <strong>社区暂时没有公开讨论</strong>
                <span>审核通过的红黑榜事件会显示在这里。</span>
              </div>
            )}
            <div className="home-column-actions">
              <Link to="/rankings/new">发布讨论</Link>
              <Link to="/rankings">查看红黑榜</Link>
            </div>
          </section>
        </div>
      </section>

      <section className="home-role-band">
        <div className="home-section-heading home-role-heading">
          <div>
            <p className="home-kicker">选本参考</p>
            <h2>选本、选角色之前，先看角色点评</h2>
            <p>角色点评直接使用剧本库里的玩家角色与 NPC 数据，不另建一套角色库。</p>
          </div>
          <div className="home-role-actions">
            <Link to="/scripts">查全部角色点评</Link>
            <Link to="/scripts/rate">添加角色评分</Link>
          </div>
        </div>

        <div className="home-role-list">
          {ratedRoles.slice(0, 4).map(role => (
            <Link key={role.target_id} to={`/scripts/roles/${encodeURIComponent(role.target_id)}`}>
              <div>
                <span>{role.role_kind === 'npc' ? 'NPC' : '玩家角色'}</span>
                <h3>{role.role_name}</h3>
                <p>《{role.script_name}》</p>
              </div>
              <div className="home-role-score">
                <strong>{Number(role.rating_avg || 0).toFixed(1)}</strong>
                <small>{role.rating_count || 0} 人评分</small>
              </div>
            </Link>
          ))}
          {ratedRoles.length === 0 && (
            <div className="home-empty-line home-role-empty">
              <strong>还没有公开的角色点评</strong>
              <span>角色数据会随剧本录入，再由玩家补充第一条评分。</span>
            </div>
          )}
        </div>
      </section>

      <section className="home-script-band">
        <div>
          <p className="home-kicker">基础资料</p>
          <h2>剧本库</h2>
          <p>一个剧本条目同时包含玩家角色和 NPC，角色点评建立在这些资料之上。</p>
        </div>
        <div className="home-script-stats">
          <span><strong>{scripts.length}</strong> 个剧本</span>
          <span><strong>{allRoles.length}</strong> 个角色与 NPC</span>
        </div>
        <Link to="/scripts/contribute">查看并完善剧本资料</Link>
      </section>
    </main>
  );
}

function rankingTypeLabel(type?: string) {
  if (type === 'red') return '红榜';
  if (type === 'black') return '黑榜';
  return '白榜';
}
