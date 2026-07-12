import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, GraphData, NodeObject } from 'react-force-graph-2d';
import type { DossierNamedRef } from '../lib/dossierWiki';
import type { PublicDmAffiliation } from '../lib/dmDossierPresentation';

type GraphNodeKind = 'dm' | 'store' | 'tag' | 'script' | 'profile';

export type DmGraphDossier = {
  id: string;
  entity_type?: 'dm' | 'store' | null;
  dm_name: string;
  workplace?: string | null;
  employer_store_id?: string | null;
  tags?: string[];
  rating_tags?: string[];
  common_scripts?: DossierNamedRef[];
  related_profiles?: DossierNamedRef[];
  related_stores?: DossierNamedRef[];
  affiliation?: PublicDmAffiliation | null;
};

type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  href?: string;
  val: number;
};

type GraphLink = {
  source: string;
  target: string;
  kind: 'tag' | 'store' | 'script' | 'profile';
  verification: 'confirmed' | 'unverified' | 'reference';
};

const NODE_COLORS: Record<GraphNodeKind, string> = {
  dm: '#2f5f94',
  store: '#28735d',
  tag: '#b7791f',
  script: '#a4435b',
  profile: '#6656a8',
};

function compactGraphKey(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
}

function buildGraph(items: DmGraphDossier[]): GraphData<GraphNode, GraphLink> {
  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();
  const addNode = (node: GraphNode) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const addLink = (source: string, target: string, kind: GraphLink['kind'], verification: GraphLink['verification'] = 'reference') => {
    const key = `${source}|${target}|${kind}`;
    if (!links.has(key)) links.set(key, { source, target, kind, verification });
  };

  items.forEach(item => {
    const entityType = item.entity_type === 'store' ? 'store' : 'dm';
    const sourceId = `${entityType}:${item.id}`;
    addNode({
      id: sourceId,
      label: item.dm_name,
      kind: entityType,
      href: entityType === 'store' ? `/stores/${encodeURIComponent(item.id)}` : `/dm/${encodeURIComponent(item.id)}`,
      val: entityType === 'dm' ? 8 : 7,
    });

    Array.from(new Set([...(item.tags || []), ...(item.rating_tags || [])]))
      .filter(Boolean)
      .slice(0, 10)
      .forEach(tag => {
        const nodeId = `tag:${compactGraphKey(tag)}`;
        addNode({ id: nodeId, label: tag, kind: 'tag', val: 3 });
        addLink(sourceId, nodeId, 'tag');
      });

    (item.common_scripts || []).slice(0, 12).forEach(script => {
      const nodeId = `script:${script.id || compactGraphKey(script.name)}`;
      addNode({ id: nodeId, label: script.name, kind: 'script', val: 4 });
      addLink(sourceId, nodeId, 'script');
    });

    const linkedStores = new Map<string, DossierNamedRef & { verification: GraphLink['verification'] }>();
    (item.related_stores || []).forEach(store => linkedStores.set(store.id, { ...store, verification: 'reference' }));
    if (item.affiliation?.store_dossier_id) {
      linkedStores.set(item.affiliation.store_dossier_id, {
        id: item.affiliation.store_dossier_id,
        name: item.affiliation.store_name || item.workplace || '关联店家',
        verification: item.affiliation.status === 'approved' ? 'confirmed' : 'unverified',
      });
    } else if (item.employer_store_id && item.workplace) {
      linkedStores.set(item.employer_store_id, { id: item.employer_store_id, name: item.workplace, verification: 'unverified' });
    }
    Array.from(linkedStores.values()).slice(0, 12).forEach(store => {
      const nodeId = `store:${store.id}`;
      addNode({ id: nodeId, label: store.name, kind: 'store', href: `/stores/${encodeURIComponent(store.id)}`, val: 6 });
      addLink(sourceId, nodeId, 'store', store.verification);
    });

    (item.related_profiles || []).slice(0, 12).forEach(profile => {
      const nodeId = `profile:${profile.id}`;
      addNode({ id: nodeId, label: profile.name, kind: 'profile', href: `/explore/${encodeURIComponent(profile.id)}`, val: 4 });
      addLink(sourceId, nodeId, 'profile');
    });
  });

  return { nodes: Array.from(nodes.values()), links: Array.from(links.values()) };
}

export default function DmRelationshipGraph({ items }: { items: DmGraphDossier[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [width, setWidth] = useState(960);
  const [hoveredId, setHoveredId] = useState('');
  const graphData = useMemo(() => buildGraph(items), [items]);
  const height = width < 640 ? 500 : 620;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => setWidth(Math.max(280, Math.floor(element.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => graphRef.current?.zoomToFit(450, 54), 520);
    return () => window.clearTimeout(timer);
  }, [graphData]);

  if (graphData.nodes.length === 0) {
    return <div style={emptyStyle}>当前筛选下没有可展示的关系。</div>;
  }

  return (
    <section style={shellStyle}>
      <div style={legendStyle} aria-label="关系图图例">
        {([
          ['dm', 'DM'],
          ['store', '店家'],
          ['tag', '标签'],
          ['script', '剧本'],
          ['profile', '圈人'],
        ] as const).map(([kind, label]) => (
          <span key={kind} style={legendItemStyle}>
            <i aria-hidden="true" style={{ ...legendDotStyle, background: NODE_COLORS[kind] }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>{graphData.nodes.length} 个节点</span>
        <span style={{ color: '#8a5a19', fontSize: 11, fontWeight: 700 }}>橙色虚线＝社区提供的店家关系</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height, overflow: 'hidden' }}>
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          backgroundColor="#fffdf8"
          nodeRelSize={4}
          nodeVal="val"
          nodeColor={node => NODE_COLORS[node.kind]}
          nodeLabel={node => `${node.label} · ${node.kind === 'dm' ? 'DM' : node.kind === 'store' ? '店家' : node.kind === 'tag' ? '标签' : node.kind === 'script' ? '剧本' : '主页'}`}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node, context, globalScale) => {
            if (node.kind !== 'dm' && node.kind !== 'store' && node.id !== hoveredId && globalScale < 1.45) return;
            const label = node.label;
            const fontSize = Math.max(9, Math.min(13, 11 / globalScale));
            context.font = `${node.kind === 'dm' || node.kind === 'store' ? 700 : 600} ${fontSize}px sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'top';
            context.fillStyle = '#1f2937';
            context.fillText(label, node.x || 0, (node.y || 0) + Math.sqrt(node.val) * 4 + 3, 130 / globalScale);
          }}
          linkColor={link => link.verification === 'confirmed'
            ? 'rgba(40,115,93,0.62)'
            : link.verification === 'unverified' ? 'rgba(183,121,31,0.72)' : 'rgba(100,116,139,0.28)'}
          linkWidth={link => link.kind === 'store' ? 1.5 : 1}
          linkLineDash={link => link.verification === 'unverified' ? [5, 4] : []}
          cooldownTicks={120}
          d3VelocityDecay={0.32}
          minZoom={0.35}
          maxZoom={5}
          onEngineStop={() => graphRef.current?.zoomToFit(350, 54)}
          onNodeHover={node => setHoveredId(node?.id ? String(node.id) : '')}
          onNodeClick={node => {
            if (node.href) navigate(node.href);
          }}
          showPointerCursor={object => Boolean((object as NodeObject<GraphNode> | undefined)?.href)}
        />
      </div>
    </section>
  );
}

const shellStyle: React.CSSProperties = {
  border: '1px solid rgba(31,41,55,0.10)',
  borderRadius: 8,
  background: '#fffdf8',
  overflow: 'hidden',
};

const legendStyle: React.CSSProperties = {
  minHeight: 42,
  padding: '8px 12px',
  borderBottom: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

const legendItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: '#475569',
  fontSize: 12,
  fontWeight: 700,
};

const legendDotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
};

const emptyStyle: React.CSSProperties = {
  border: '1px solid rgba(31,41,55,0.10)',
  borderRadius: 8,
  padding: '42px 18px',
  textAlign: 'center',
  color: '#64748b',
  background: '#fff',
};
