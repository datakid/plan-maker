const frame = document.getElementById('app');
frame.addEventListener('load', async ()=>{
  const lines = [];
  let pass = 0, fail = 0;
  async function check(width, lang, theme, last){
    const wait = ()=>new Promise(r=>setTimeout(r, 230));
    const assert = (v, text)=>{ if(!v) throw new Error(text); };
    closePop();
    if(sheet.current) sheet.current.close(true);
    if(renderTeam.api) renderTeam.api.closePanel();
    setLang(lang);
    setTheme(theme);
    App.ui.teamWide = null;
    goTab('team');
    const rows = [...document.querySelectorAll('tr.pt-row')];
    const row = rows[last ? rows.length-1 : 0];
    const wrap = document.querySelector('.pt-wrap');
    if(last) wrap.scrollTop = wrap.scrollHeight;
    row.querySelector('.pt-c-load').click();
    await wait();
    assert(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1, 'horizontal page overflow');
    if(width<980){
      assert(sheet.current && document.querySelectorAll('.sheet-head .icon-btn').length>=3, 'narrow sheet/navigation missing');
      sheet.current.close(true);
    } else {
      const panel = document.querySelector('.pt-panel');
      const rect = panel.getBoundingClientRect();
      const viewport = document.documentElement.getBoundingClientRect();
      assert(!panel.hidden && getComputedStyle(panel).position==='fixed', 'drawer not fixed/visible');
      assert(Math.abs(lang==='ar' ? rect.left-viewport.left : rect.right-viewport.right)<=1, 'drawer edge');
      const head = panel.querySelector('.pt-panel-head');
      const top = head.getBoundingClientRect().top;
      const body = panel.querySelector('.pt-panel-body');
      body.scrollTop = body.scrollHeight;
      assert(Math.abs(head.getBoundingClientRect().top-top)<=1, 'drawer header scrolled');
      assert(rect.bottom<=innerHeight+1 && rect.top>=0, 'drawer clipped vertically');
      if(width>=1280){
        const main = document.querySelector('.pt-main').getBoundingClientRect();
        assert(lang==='ar' ? main.left>=rect.right : main.right<=rect.left, 'drawer overlaps reserved table space');
      }
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      assert(panel.hidden && document.activeElement.dataset.pid===row.dataset.pid, 'Escape/focus return');
      row.querySelector('.pt-c-load').click();
      row.querySelector('.pt-c-load').click();
      assert(panel.hidden, 'row toggle');
      wrap.style.height = '180px';
      wrap.scrollTop = 100;
      assert(Math.abs(wrap.querySelector('th').getBoundingClientRect().top-wrap.getBoundingClientRect().top)<=1, 'sticky table header');
      const chip = row.querySelector('.pt-c-avail .chip');
      chip.click();
      const mode = [...document.querySelectorAll('.pop .seg button')].find(b=>b.textContent===t('pAvailCycle'));
      mode.click();
      const pop = document.querySelector('.pop');
      assert(pop.scrollWidth<=pop.clientWidth+1, 'cycle popover overflow');
      assert(getComputedStyle(pop.querySelector('.seg')).flexWrap==='nowrap', 'segmented control wraps');
      closePop();
    }
    return true;
  }
  for(const width of [1440,1280,1100,390]){
    frame.style.width = width+'px';
    await new Promise(r=>setTimeout(r, 60));
    for(const lang of ['ar','en']) for(const theme of ['light','dark']) for(const last of [false,true]){
      const label = width+' '+lang+' '+theme+' '+(last?'last':'first');
      try{
        await frame.contentWindow.eval('('+check.toString()+')('+JSON.stringify(width)+','+JSON.stringify(lang)+','+JSON.stringify(theme)+','+JSON.stringify(last)+')');
        pass++;
        lines.push('PASS '+label);
      }catch(e){ fail++; lines.push('FAIL '+label+' '+e.message); }
      console.log(lines[lines.length-1]);
    }
  }
  const result = 'MATRIX pass='+pass+' fail='+fail;
  console.log(result);
  document.getElementById('report').textContent = lines.concat(result).join('\n');
  document.body.dataset.done = 'true';
});
