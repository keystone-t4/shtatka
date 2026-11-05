/* Cookie-согласие Штатки: баннер «Принять все / Настроить / Только необходимые» и окно настроек по категориям.
   Запись выбора: localStorage['shtatka-cookie'] = JSON {v, t, necessary, analytics, marketing}.
   Аналитика (Яндекс Метрика) подключается только при analytics:true. Событие: document 'shtatka:cookies'. */
(function(){
  var KEY='shtatka-cookie';
  var V=(window.SHTATKA_CONFIG||{}).docsVersion||'28.10.2026';
  function read(){var r=null;try{r=localStorage.getItem(KEY)}catch(e){}
    if(!r)return null;
    if(r==='all')return {v:V,necessary:true,analytics:true,marketing:false,legacy:true};
    if(r==='necessary')return {v:V,necessary:true,analytics:false,marketing:false,legacy:true};
    try{var o=JSON.parse(r);return o&&o.necessary?o:null}catch(e){return null}}
  function write(a,m){var o={v:V,t:new Date().toISOString(),necessary:true,analytics:!!a,marketing:!!m};
    try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}
    try{document.dispatchEvent(new CustomEvent('shtatka:cookies',{detail:o}))}catch(e){}
    return o}
  function h(s){var d=document.createElement('div');d.innerHTML=s;return d.firstElementChild}
  var banner,modal;
  function buildBanner(){
    banner=h('<div class="ck" id="ck" hidden role="region" aria-label="Настройки cookie"><div class="ck-card"><div class="ck-t"><b>Cookie на сайте Штатки</b><p>Необходимые нужны, чтобы сайт и кабинет работали. Аналитику («Яндекс Метрика») включим, только если вы разрешите: можно принять всё, выбрать по пунктам или оставить только необходимые. Подробнее — в <a href="cookie.html" target="_blank" rel="noopener">согласии на cookie</a> и <a href="policy.html" target="_blank" rel="noopener">Политике обработки данных</a>.</p></div><div class="ck-btns"><button type="button" class="ck-all" data-a="all">Принять все</button><button type="button" class="ck-set" data-a="set">Настроить</button><button type="button" data-a="min">Только необходимые</button></div></div></div>');
    document.body.appendChild(banner);
    banner.addEventListener('click',function(e){var a=e.target.getAttribute&&e.target.getAttribute('data-a');if(!a)return;
      if(a==='all'){write(true,false);banner.hidden=true}
      else if(a==='min'){write(false,false);banner.hidden=true}
      else openModal();});
  }
  function row(id,title,desc,checked,locked,cols,rows){
    var t='<div class="tw"><table><thead><tr>'+cols.map(function(c){return '<th>'+c+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+c+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
    return '<div class="ckc"><div class="ckc-h"><div><b>'+title+'</b><span class="d">'+desc+'</span></div><label class="sw" aria-label="'+title+'"><input type="checkbox" id="ck_'+id+'"'+(checked?' checked':'')+(locked?' disabled':'')+'><i></i></label></div><details><summary>Что именно и как долго</summary>'+t+'</details></div>';}
  function buildModal(){
    var C=['Название','Зачем','Кто, срок'];
    modal=h('<div class="ckm" hidden role="dialog" aria-modal="true" aria-labelledby="ckmT"><div class="ckm-box"><div class="ckm-top"><h2 id="ckmT">Настройки cookie</h2><button type="button" class="ckm-x" data-a="close">Закрыть</button></div><div class="ckm-body"><p class="ckm-lead">Выберите, с чем вы согласны. Согласие можно изменить в любой момент по ссылке «Настройки cookie» внизу сайта. Отказ от необязательных cookie не ограничивает работу сервиса.</p>'
     +row('nec','Необходимые','Без них сайт и кабинет не работают. Отключить нельзя.',true,true,C,[
       ['shtatka-session','Вход в кабинет и данные регистрации','Штатка, до выхода или 12 месяцев'],
       ['shtatka-home-v2','Ваши настройки кабинета: главная, меню, список сотрудников','Штатка, пока вы их не удалите'],
       ['shtatka-cookie','Запоминает ваш выбор в этом окне','Штатка, 12 месяцев'],
       ['Кэш приложения (service worker)','Работа страниц без интернета','Штатка, до обновления версии'],
       ['Запрос в DaData','Подсказка реквизитов по ИНН при регистрации. Уходит только введённый ИНН','DaData, только в момент ввода']])
     +row('an','Аналитические','Помогают понять, что на сайте непонятно или не работает. Включаются только по вашему согласию.',false,false,C,[
       ['Яндекс Метрика (_ym_uid, _ym_d и др.)','Статистика посещений, карта кликов, ошибки. Метрика получает IP-адрес, сведения о браузере и устройстве, адреса страниц','ООО «Яндекс», до 12 месяцев'],
       ['Вебвизор и запись экрана','Не используются','—']])
     +row('mk','Рекламные','Реклама и ретаргетинг. Сейчас мы их не используем. Если подключим, спросим отдельно.',false,true,C,[
       ['Рекламные пиксели и сети','Не используются','—']])
     +'<p class="ckm-note">Мы не передаём данные кабинета и сведения о ваших сотрудниках в аналитику. Документы: <a href="cookie.html" target="_blank" rel="noopener">согласие на cookie</a>, <a href="policy.html" target="_blank" rel="noopener">Политика обработки данных</a>.</p></div>'
     +'<div class="ckm-foot"><button type="button" class="ck-all" data-a="all">Принять все</button><button type="button" data-a="save">Сохранить выбор</button><button type="button" data-a="min">Только необходимые</button></div></div></div>');
    document.body.appendChild(modal);
    modal.addEventListener('click',function(e){
      if(e.target===modal){closeModal();return}
      var a=e.target.getAttribute&&e.target.getAttribute('data-a');if(!a)return;
      if(a==='close')closeModal();
      else if(a==='all'){write(true,false);done()}
      else if(a==='min'){write(false,false);done()}
      else if(a==='save'){write(modal.querySelector('#ck_an').checked,false);done()}});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)closeModal()});
  }
  var opener=null;
  function openModal(){if(!modal)buildModal();var o=read();modal.querySelector('#ck_an').checked=!!(o&&o.analytics);modal.hidden=false;opener=document.activeElement;var b=modal.querySelector('.ckm-x');if(b)b.focus();document.documentElement.style.overflow='hidden'}
  function closeModal(){modal.hidden=true;document.documentElement.style.overflow='';if(opener&&opener.focus)try{opener.focus()}catch(e){}}
  function done(){closeModal();if(banner)banner.hidden=true}
  function init(){
    buildBanner();
    var o=read();banner.hidden=!!(o&&o.v===V);
    document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-cookie-settings]');if(t){e.preventDefault();openModal()}});
  }
  window.ShtatkaCookies={open:function(){openModal()},get:read};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
