const FLOW_INF = 1e15;

function FlowNet(n){
  this.n = n;
  this.head = new Int32Array(n).fill(-1);
  this.to = [];
  this.cap = [];
  this.cost = [];
  this.next = [];
  this.lowerEdges = [];
}

FlowNet.prototype.addEdge = function(u, v, cap, cost){
  const id = this.to.length;
  this.to.push(v); this.cap.push(cap); this.cost.push(cost); this.next.push(this.head[u]); this.head[u] = id;
  this.to.push(u); this.cap.push(0); this.cost.push(-cost); this.next.push(this.head[v]); this.head[v] = id+1;
  return id;
};

FlowNet.prototype.addBounded = function(u, v, lower, upper, cost, big){
  const out = {lowId:-1, upId:-1, lower};
  if(lower>0){
    out.lowId = this.addEdge(u, v, lower, cost-big);
    this.lowerEdges.push(out);
  }
  if(upper>lower) out.upId = this.addEdge(u, v, upper-lower, cost);
  return out;
};

FlowNet.prototype.flowOn = function(id){ return id<0 ? 0 : this.cap[id^1]; };

FlowNet.prototype.lowerBoundsMet = function(){
  for(const e of this.lowerEdges) if(this.flowOn(e.lowId)<e.lower) return false;
  return true;
};

function flowHeapPush(h, d, v){
  h.push(d, v);
  let i = (h.length>>1)-1;
  while(i>0){
    const p = (i-1)>>1;
    if(h[2*p]<=h[2*i]) break;
    const td = h[2*p], tv = h[2*p+1];
    h[2*p] = h[2*i]; h[2*p+1] = h[2*i+1]; h[2*i] = td; h[2*i+1] = tv;
    i = p;
  }
}
function flowHeapPop(h){
  const d = h[0], v = h[1];
  const lv = h.pop(), ld = h.pop();
  const n = h.length>>1;
  if(n>0){
    h[0] = ld; h[1] = lv;
    let i = 0;
    for(;;){
      const l = 2*i+1, r = l+1;
      let m = i;
      if(l<n && h[2*l]<h[2*m]) m = l;
      if(r<n && h[2*r]<h[2*m]) m = r;
      if(m===i) break;
      const td = h[2*m], tv = h[2*m+1];
      h[2*m] = h[2*i]; h[2*m+1] = h[2*i+1]; h[2*i] = td; h[2*i+1] = tv;
      i = m;
    }
  }
  return [d, v];
}

FlowNet.prototype.solve = function(s, t, opts){
  opts = opts || {};
  const n = this.n;
  const pot = new Array(n).fill(0);
  const reach = new Array(n).fill(false);
  const dist0 = new Array(n).fill(FLOW_INF);
  dist0[s] = 0;
  for(let round=0; round<n; round++){
    let changed = false;
    for(let u=0; u<n; u++){
      if(dist0[u]>=FLOW_INF) continue;
      for(let e=this.head[u]; e>=0; e=this.next[e]){
        if(this.cap[e]>0 && dist0[u]+this.cost[e]<dist0[this.to[e]]){ dist0[this.to[e]] = dist0[u]+this.cost[e]; changed = true; }
      }
    }
    if(!changed) break;
  }
  for(let v=0; v<n; v++){ reach[v] = dist0[v]<FLOW_INF; pot[v] = reach[v] ? dist0[v] : 0; }
  let flow = 0, cost = 0, iters = 0;
  const maxFlow = opts.maxFlow==null ? Infinity : opts.maxFlow;
  const dist = new Array(n), prevE = new Array(n);
  while(flow<maxFlow){
    dist.fill(FLOW_INF); prevE.fill(-1);
    dist[s] = 0;
    const heap = [];
    flowHeapPush(heap, 0, s);
    while(heap.length){
      const [d, u] = flowHeapPop(heap);
      if(d>dist[u]) continue;
      for(let e=this.head[u]; e>=0; e=this.next[e]){
        if(this.cap[e]<=0) continue;
        const v = this.to[e];
        const nd = d+this.cost[e]+pot[u]-pot[v];
        if(nd<dist[v]){ dist[v] = nd; prevE[v] = e; flowHeapPush(heap, nd, v); }
      }
    }
    if(dist[t]>=FLOW_INF) break;
    for(let v=0; v<n; v++) if(dist[v]<FLOW_INF) pot[v] += dist[v];
    const pathCost = pot[t]-pot[s];
    if(pathCost>=0 && !opts.forceMax) break;
    let push = maxFlow-flow;
    for(let v=t; v!==s; v=this.to[prevE[v]^1]) push = Math.min(push, this.cap[prevE[v]]);
    for(let v=t; v!==s; v=this.to[prevE[v]^1]){ this.cap[prevE[v]] -= push; this.cap[prevE[v]^1] += push; }
    flow += push; cost += push*pathCost; iters++;
    if(iters>200000) break;
  }
  return {flow, cost, iters};
};
