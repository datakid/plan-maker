const LAYOUT_BIG = 1e9;
const LAYOUT_FILL = 1e7;
const LAYOUT_UNIT = 1000;

function layoutByFlow(P){
  const U = P.units.length, N = P.N;
  const dayNodeBase = 2+U;
  const facCopies = new Map();
  P.units.forEach((u, i)=>{ if(!facCopies.has(u.f.id)) facCopies.set(u.f.id, []); facCopies.get(u.f.id).push(i); });
  let next = dayNodeBase;
  const dayNode = [], kindNode = [], weekNode = new Map();
  for(let d=0; d<N; d++) dayNode.push(next++);
  for(let d=0; d<N; d++){ kindNode.push(P.one[d] ? next++ : -1); }
  for(let d=0; d<N; d++) if(!weekNode.has(P.weekOf[d])) weekNode.set(P.weekOf[d], next++);
  const kindSrc = {basic:next++, contracted:next++};
  const copyNode = new Map();
  for(const [fid, list] of facCopies) if(list.length>1) for(let d=0; d<N; d++) copyNode.set(fid+'|'+d, next++);
  const net = new FlowNet(next);
  const S = 0, T = 1;
  for(const k of ['basic', 'contracted']) net.addEdge(S, kindSrc[k], (P.kindQuota && P.kindQuota[k]) || 0, -LAYOUT_FILL);
  const unitEdges = [];
  for(let i=0; i<U; i++){
    const u = P.units[i];
    if(!u.cand) net.addEdge(S, 2+i, 1, -(LAYOUT_FILL + (4-Math.min(4, u.tier||0))*100000));
    else net.addEdge(kindSrc[u.kind], 2+i, 1, -(u.reward||0));
    const row = [];
    for(let d=0; d<N; d++){
      const c = P.cost(u, d);
      if(c==null) continue;
      const list = facCopies.get(u.f.id);
      let mid;
      if(list.length>1) mid = copyNode.get(u.f.id+'|'+d);
      else mid = P.one[d] && P.one[d].match(u) ? kindNode[d] : dayNode[d];
      const id = net.addEdge(2+i, mid, 1, c);
      row.push({d, id});
    }
    unitEdges.push(row);
  }
  for(const [key, node] of copyNode){
    const d = +key.split('|')[1];
    const fid = key.split('|')[0];
    const target = P.one[d] && P.units.some(u=>u.f.id===fid && P.one[d].match(u)) ? kindNode[d] : dayNode[d];
    net.addEdge(node, target, 1, 0);
  }
  for(let d=0; d<N; d++){
    if(kindNode[d]>=0){
      const one = P.one[d];
      if(one.must) net.addBounded(kindNode[d], dayNode[d], 1, 1, 0, LAYOUT_BIG);
      else net.addEdge(kindNode[d], dayNode[d], 1, -one.w*LAYOUT_UNIT);
      net.addEdge(kindNode[d], dayNode[d], P.room[d], 0);
    }
    if(P.room[d]<=0) continue;
    const wk = weekNode.get(P.weekOf[d]);
    const seg = P.segments(d);
    for(const s of seg){
      if(s.lower>0) net.addBounded(dayNode[d], wk, s.lower, s.n, s.cost, LAYOUT_BIG);
      else net.addEdge(dayNode[d], wk, s.n, s.cost);
    }
  }
  for(const [w, node] of weekNode){
    const segs = P.weekSegments(w);
    for(const s of segs) net.addEdge(node, T, s.n, s.cost);
  }
  const r = net.solve(S, T, {forceMax:false});
  const out = new Map();
  for(let i=0; i<U; i++){
    for(const e of unitEdges[i]) if(net.flowOn(e.id)>0){ out.set(i, e.d); break; }
  }
  return {assign:out, flow:r.flow, cost:r.cost, lowerMet:net.lowerBoundsMet(), nodes:net.n};
}
