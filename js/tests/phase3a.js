regress('v4: min-cost flow and Hungarian agree on 300 random assignment matrices', ()=>{
  const rnd = Fx.rng(77);
  let bad = '';
  for(let it=0; it<300 && !bad; it++){
    const n = 1+Math.floor(rnd()*6), m = n+Math.floor(rnd()*4);
    const cost = [];
    for(let i=0; i<n; i++){ cost.push([]); for(let j=0; j<m; j++) cost[i].push(Math.floor(rnd()*100)-30); }
    const h = hungarian(cost);
    const net = new FlowNet(n+m+2);
    const S = n+m, T = n+m+1;
    for(let i=0; i<n; i++){ net.addEdge(S, i, 1, -100000); for(let j=0; j<m; j++) net.addEdge(i, n+j, 1, cost[i][j]); }
    for(let j=0; j<m; j++) net.addEdge(n+j, T, 1, 0);
    const r = net.solve(S, T);
    const flowTotal = r.cost+100000*n;
    if(r.flow!==n || flowTotal!==h.total) bad = 'it '+it+' n '+n+' m '+m+' flow '+r.flow+' cost '+flowTotal+' hungarian '+h.total;
  }
  return verdict(!bad, '300 matrices equal', bad);
});

regress('v4: min-cost flow honours lower bounds and convex reward edges', ()=>{
  const net = new FlowNet(5);
  const BIG = 100000;
  net.addBounded(0, 1, 2, 3, 5, BIG);
  net.addEdge(0, 2, 5, 1);
  const a = net.addEdge(1, 3, 5, 0);
  const b = net.addEdge(2, 3, 5, 0);
  net.addEdge(3, 4, 4, 0);
  const r = net.solve(0, 4, {forceMax:true});
  const viaOne = net.flowOn(a), viaTwo = net.flowOn(b);
  return verdict(net.lowerBoundsMet() && r.flow===4 && viaOne===2 && viaTwo===2, 'lower bound kept', 'flow '+r.flow+' one '+viaOne+' two '+viaTwo+' met '+net.lowerBoundsMet());
});

regress('v4: min-cost flow reports an unmet lower bound', ()=>{
  const net = new FlowNet(3);
  net.addBounded(0, 1, 3, 3, 0, 100000);
  net.addEdge(1, 2, 2, 0);
  net.solve(0, 2, {forceMax:true});
  return verdict(!net.lowerBoundsMet(), 'detected', 'lower bound reported as met');
});
