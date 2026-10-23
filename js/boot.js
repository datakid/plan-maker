(function(){
  try{
    var l = localStorage.getItem('alkhitta.lang'); if(l!=='en') l = 'ar';
    var th = localStorage.getItem('alkhitta.theme');
    document.documentElement.lang = l;
    document.documentElement.dir = l==='ar' ? 'rtl' : 'ltr';
    if(th==='light' || th==='dark') document.documentElement.setAttribute('data-theme', th);
  }catch(e){}
})();
