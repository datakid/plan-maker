const Diag = {last:0};

function diagFrames(err){
  const raw = String(err && err.stack || '');
  const out = [];
  for(const line of raw.split('\n')){
    const m = line.match(/([^\/\\\s(]+\.js):(\d+):(\d+)/);
    if(m) out.push(m[1]+':'+m[2]+':'+m[3]);
    if(out.length>=8) break;
  }
  return out;
}

function buildDiagnostic(err){
  const D = App.data;
  return [
    'al-Khitta '+APP_VERSION,
    'rulesRev '+RULES_REV,
    'lang '+App.ui.lang,
    'tab '+App.ui.tab,
    'people '+(D ? D.people.length : 0)+' facilities '+(D ? D.facilities.length : 0),
    'storageKB '+Math.round(storageSize()/1024),
    'readOnly '+!!App.readOnly,
    'error '+((err && err.name) || 'Error'),
    'at '+(diagFrames(err).join(' < ') || 'unknown')
  ].join('\n');
}

function handleGlobalError(err){
  const now = Date.now();
  if(now-Diag.last<5000) return false;
  Diag.last = now;
  const text = buildDiagnostic(err);
  toast(t('errToast'), {label:t('copyDiag'), onClick:()=>{ copyText(text); }});
  return true;
}

window.addEventListener('error', e=>{ handleGlobalError(e.error || new Error('error')); });
window.addEventListener('unhandledrejection', e=>{ handleGlobalError(e.reason instanceof Error ? e.reason : new Error('rejection')); });
