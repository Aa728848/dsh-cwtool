import type { EntityDefinition, EventGraph, SolarSystem, StaticGalaxyParseResult, TechGraph } from 'cwtools-shared/editors'
import css from './NativeEditorView.module.css'

export type NativeEditorData =
  | { readonly kind: 'tech'; readonly graph: TechGraph }
  | { readonly kind: 'solar'; readonly systems: readonly SolarSystem[] }
  | { readonly kind: 'entity'; readonly entities: readonly EntityDefinition[] }
  | { readonly kind: 'event'; readonly graph: EventGraph }
  | { readonly kind: 'galaxy'; readonly result: StaticGalaxyParseResult }

function TechView({ graph }: { graph: TechGraph }) {
  const nodes = graph.nodes.slice(0, 60)
  const counts = new Map<number, number>()
  const positions = new Map(nodes.map(node => {
    const row = counts.get(node.tier) ?? 0; counts.set(node.tier, row + 1)
    return [node.id, { x: 40 + node.tier * 155, y: 34 + row * 58 }] as const
  }))
  const edges = graph.edges.filter(edge => positions.has(edge.source) && positions.has(edge.target)).slice(0, 160)
  const height = Math.max(260, ...[...counts.values()].map(count => count * 58 + 60))
  return <div className={css.scroller}><svg className={css.tech} width={Math.max(760, (Math.max(...nodes.map(n => n.tier), 0) + 2) * 155)} height={height} role='img' aria-label='Technology dependency graph'>
    {edges.map((edge, index) => { const a=positions.get(edge.source)!; const b=positions.get(edge.target)!; return <line key={index} x1={a.x+126} y1={a.y+16} x2={b.x} y2={b.y+16} className={css.edge} /> })}
    {nodes.map(node => { const p=positions.get(node.id)!; return <g key={node.id} transform={`translate(${p.x},${p.y})`}><rect width='126' height='34' rx='5' data-area={node.area} className={css.node} /><text x='8' y='14'>{node.id.slice(0,20)}</text><text x='8' y='27' className={css.nodeMeta}>T{node.tier} · {node.category || node.area}</text><title>{node.title} · {node.file}:{node.line}</title></g> })}
  </svg><p className={css.caption}>{nodes.length} / {graph.nodes.length} technologies · {edges.length} prerequisite links</p></div>
}

function SolarView({ systems }: { systems: readonly SolarSystem[] }) {
  const system = systems[0]
  if (system === undefined) return <p>No solar system initializer was found.</p>
  const bodies = system.bodies.filter(body => body.bodyType !== 'star').slice(0, 40)
  return <div className={css.solarWrap}><svg viewBox='0 0 640 520' className={css.solar} role='img' aria-label={`${system.displayName ?? system.key} orbital schematic`}><rect width='640' height='520' className={css.space} /><circle cx='320' cy='260' r='24' className={css.star} /><text x='320' y='300' textAnchor='middle'>{system.starClass}</text>
    {bodies.map((body,index) => { const radius=45+Math.min(190,Math.abs(body.resolvedOrbitRadius)*0.55); const angle=body.resolvedOrbitAngle*Math.PI/180; const x=320+Math.cos(angle)*radius; const y=260+Math.sin(angle)*radius; return <g key={`${body.name ?? body.planetClass}-${index}`}><circle cx='320' cy='260' r={radius} className={css.orbit} /><circle cx={x} cy={y} r={Math.max(4,Math.min(13,body.resolvedSize/2))} className={css.planet} /><text x={x+9} y={y-8}>{body.name ?? body.planetClass}</text></g> })}
  </svg><p className={css.caption}>{system.displayName ?? system.key} · {bodies.length} bodies · source-derived orbital schematic</p></div>
}

function EntityView({ entities }: { entities: readonly EntityDefinition[] }) {
  return <div className={css.entities}>{entities.slice(0,100).map(entity => <article key={entity.name}><h2>{entity.name}</h2><p>{entity.pdxmesh ?? 'No pdxmesh'} · {entity.filePath}:{entity.line}</p><div><span>{entity.states.length} states</span><span>{entity.locators.length} locators</span><span>{entity.attaches.length} attaches</span></div>{entity.states.map(state => <section key={state.name}><strong>{state.name}</strong>{state.animation !== undefined && <small>animation: {state.animation}</small>}{state.particleEvents.map((event,index) => <p key={index}>✦ {event.time}s → {event.particle}{event.node ? ` @ ${event.node}` : ''}</p>)}</section>)}</article>)}</div>
}

function EventView({ graph }: { graph: EventGraph }) {
  const nodes=graph.nodes.slice(0,80); const positions=new Map(nodes.map((node,index)=>[node.id,{x:40+(index%5)*160,y:40+Math.floor(index/5)*70}] as const));
  return <div className={css.scroller}><svg className={css.tech} width='850' height={Math.max(260,Math.ceil(nodes.length/5)*70+60)} role='img' aria-label='Event dependency graph'>{graph.edges.filter(edge=>positions.has(edge.source)&&positions.has(edge.target)).slice(0,200).map((edge,index)=>{const a=positions.get(edge.source)!;const b=positions.get(edge.target)!;return <line key={index} x1={a.x+130} y1={a.y+17} x2={b.x} y2={b.y+17} className={css.edge}><title>{edge.edgeType}</title></line>})}{nodes.map(node=>{const p=positions.get(node.id)!;return <g key={node.id} transform={`translate(${p.x},${p.y})`}><rect width='130' height='36' rx='5' className={css.node}/><text x='7' y='15'>{node.id.slice(0,21)}</text><text x='7' y='28' className={css.nodeMeta}>{node.namespace} · {node.type}</text><title>{node.file}:{node.line}</title></g>})}</svg><p className={css.caption}>{nodes.length} / {graph.nodes.length} events · {graph.edges.length} semantic/effect links</p></div>
}

function GalaxyView({ result }: { result: StaticGalaxyParseResult }) {
  const scenario=result.scenarios[0]; if(scenario===undefined)return <p>No static galaxy scenario was found.</p>;
  const usable=scenario.systems.filter(system=>typeof system.x?.value==='number'&&typeof system.y?.value==='number');
  const xs=usable.map(system=>system.x!.value!);const ys=usable.map(system=>system.y!.value!);const minX=Math.min(...xs,0);const maxX=Math.max(...xs,1);const minY=Math.min(...ys,0);const maxY=Math.max(...ys,1);
  const positions=new Map(usable.map(system=>[system.id,{x:40+(system.x!.value!-minX)/(maxX-minX)*720,y:40+(system.y!.value!-minY)/(maxY-minY)*500}] as const));
  return <div className={css.solarWrap}><svg viewBox='0 0 800 580' className={css.solar} role='img' aria-label='Static galaxy explicit hyperlane map'><rect width='800' height='580' className={css.space}/>{scenario.hyperlanes.filter(lane=>lane.kind==='add'&&positions.has(lane.fromId)&&positions.has(lane.toId)).map((lane,index)=>{const a=positions.get(lane.fromId)!;const b=positions.get(lane.toId)!;return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={css.edge}/>})}{usable.map(system=>{const p=positions.get(system.id)!;return <g key={system.nodeKey}><circle cx={p.x} cy={p.y} r='5' className={css.star}/><text x={p.x+8} y={p.y-7}>{system.name??system.id}</text></g>})}</svg><p className={css.caption}>{scenario.name} · {usable.length}/{scenario.systems.length} positioned systems · explicit hyperlanes only</p></div>
}

export function NativeEditorView({ data }: { readonly data: NativeEditorData }) {
  if (data.kind === 'tech') return <TechView graph={data.graph} />
  if (data.kind === 'solar') return <SolarView systems={data.systems} />
  if (data.kind === 'event') return <EventView graph={data.graph} />
  if (data.kind === 'galaxy') return <GalaxyView result={data.result} />
  return <EntityView entities={data.entities} />
}