const frame = document.getElementById('suite');
frame.addEventListener('load', ()=>{
  const report = document.getElementById('report');
  const log = frame.contentWindow.console.log.bind(frame.contentWindow.console);
  const failures = [];
  frame.contentWindow.console.log = (...args)=>{
    const text = args.join(' ');
    if(text.startsWith('FAIL')) failures.push(text);
    if(text.startsWith('FAIL') || text.startsWith('RESULT')) console.log(text);
    if(text.startsWith('RESULT')){
      report.textContent = failures.concat(text).join('\n');
      report.dataset.done = 'true';
    }
    if(!text.startsWith('PASS')) log(...args);
  };
});
