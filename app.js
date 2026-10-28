(function(){
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
  }
  function loadMetrika(){
    var id=(window.SHTATKA_CONFIG||{}).metrikaId; if(!id||window.__metrika)return; window.__metrika=true;
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
    (window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
    window.ym(Number(id),'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});
  }
  var v=null; try{v=localStorage.getItem('shtatka-cookie')}catch(e){}
  if(v==='all')loadMetrika();
  document.addEventListener('click',function(e){if(e.target&&e.target.id==='ckOk')setTimeout(loadMetrika,0);});
  /* пока виден баннер cookie, оставляем под ним место, чтобы он не закрывал кнопки формы */
  function ckPad(){var c=document.getElementById('ck');var inner=c&&c.firstElementChild;document.body.style.paddingBottom=(c&&!c.hidden&&inner)?(inner.offsetHeight+28)+'px':'';}
  window.addEventListener('load',function(){ckPad();setTimeout(ckPad,400);});window.addEventListener('resize',ckPad);document.addEventListener('click',function(){setTimeout(ckPad,60);});
})();
