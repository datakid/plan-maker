function showPeoplePreview(){
  const params = new URLSearchParams(location.search);
  closePop();
  if(sheet.current) sheet.current.close(true);
  if(renderTeam.api) renderTeam.api.closePanel();
  setLang(params.get('lang')==='en' ? 'en' : 'ar');
  setTheme(params.get('theme')==='dark' ? 'dark' : 'light');
  goTab('team');
  renderTeam.api.openPanel(renderTeam.api.orderIds()[0]);
  document.body.dataset.ready = 'true';
  console.log('PREVIEW width='+innerWidth+' mode='+(sheet.current ? 'sheet' : 'drawer'));
}
window.addEventListener('load', showPeoplePreview);
window.addEventListener('resize', showPeoplePreview);
