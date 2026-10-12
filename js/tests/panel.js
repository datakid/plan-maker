(function(){
  const lines = [];
  let box = null, head = null, list = null, done = false;
  const orig = console.log.bind(console);
  function build(){
    if(box || !document.body) return;
    box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:#fff;color:#111;font:14px/1.5 system-ui,sans-serif;overflow:auto;padding:16px;direction:ltr;text-align:left');
    head = document.createElement('div');
    head.setAttribute('style', 'font-size:20px;font-weight:700;margin-bottom:6px');
    head.textContent = 'Running tests…';
    const bar = document.createElement('div');
    bar.setAttribute('style', 'margin-bottom:12px');
    const hide = document.createElement('button');
    hide.textContent = 'Show app';
    hide.setAttribute('style', 'padding:6px 12px;margin-inline-end:8px');
    hide.onclick = ()=>{ const off = box.style.display==='none'; box.style.display = off ? 'block' : 'none'; };
    const all = document.createElement('label');
    all.innerHTML = '<input type="checkbox" id="tp-all"> show passing tests too';
    all.querySelector('input').onchange = paint;
    bar.appendChild(hide); bar.appendChild(all);
    list = document.createElement('pre');
    list.setAttribute('style', 'white-space:pre-wrap;word-break:break-word;margin:0;font:12.5px/1.5 ui-monospace,monospace');
    box.appendChild(head); box.appendChild(bar); box.appendChild(list);
    document.body.appendChild(box);
    const toggle = document.createElement('button');
    toggle.textContent = 'Test results';
    toggle.setAttribute('style', 'position:fixed;bottom:12px;inset-inline-start:12px;z-index:100000;padding:6px 12px');
    toggle.onclick = ()=>{ box.style.display = 'block'; };
    document.body.appendChild(toggle);
    paint();
  }
  function paint(){
    if(!box) return;
    const showAll = !!(document.getElementById('tp-all') && document.getElementById('tp-all').checked);
    const pass = lines.filter(l=>l.startsWith('PASS')).length;
    const fail = lines.filter(l=>l.startsWith('FAIL')).length;
    const result = lines.find(l=>l.startsWith('RESULT'));
    if(result){
      const refused = result.includes('refused');
      head.textContent = refused ? 'Tests refused to run (storage not isolated)' : (fail===0 && /fail=0/.test(result) ? 'ALL TESTS PASSED · '+result : 'TESTS FAILED · '+result);
      head.style.color = refused || fail>0 || !/fail=0/.test(result) ? '#b00020' : '#0a7a2f';
    } else {
      head.textContent = 'Running tests… '+pass+' passed, '+fail+' failed so far';
    }
    list.textContent = lines.filter(l=>showAll || !l.startsWith('PASS')).join('\n');
  }
  console.log = function(){
    const text = Array.prototype.slice.call(arguments).join(' ');
    lines.push(text);
    if(/^(PASS|FAIL|RESULT|EXC)/.test(text)){ build(); paint(); }
    orig.apply(console, arguments);
  };
  window.addEventListener('error', e=>{ lines.push('FAIL uncaught error · '+e.message); build(); paint(); });
  document.addEventListener('DOMContentLoaded', build);
})();
