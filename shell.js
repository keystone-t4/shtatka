/* Общая оболочка кабинета: меню слева (из настроек), карточка пользователя, нижнее меню на телефоне, всплывашки.
   Подключается на всех страницах кабинета после home-store.js. Страница задаёт <body data-page="home|people|company|tariff">. */
(function(){
const H=window.SHTATKA_HOME;
const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const page=document.body.dataset.page||'home';
const S=H.state();
H.applyUi();

let tt;
function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),3200);}

/* пользователь */
let user={fio:'',company:''};
const ses=H.session();
if(ses)user={fio:ses.fio||'',company:ses.company||''};

function items(){return S.menu.filter(m=>m.on).map(m=>H.MENU.find(i=>i.id===m.id));}
function badge(i){return (!H.real()||S.demoView)&&i.demoBadge?` <span class="badge">${i.demoBadge}</span>`:'';}
function navItem(i){
  const cur=i.id===page?' aria-current="page"':'';
  return i.href?`<a href="${i.href}"${cur}>${esc(i.title)}${badge(i)}</a>`:`<button type="button" data-soon="Раздел «${esc(i.title)}» подключим на следующих шагах"${cur}>${esc(i.title)}${badge(i)}</button>`;
}
function renderSide(){
  const side=$('#side');if(!side)return;
  const p=(user.fio||'').trim().split(/\s+/);
  side.innerHTML=`<a class="logo" href="cabinet.html">${window.SHTATKA_LOGO||((document.getElementById('logoTpl')||{}).innerHTML)||''}<span>Штатка</span></a>
  <nav class="nav" aria-label="Разделы">${items().map(navItem).join('')}</nav>
  <div class="grow"></div>
  <a class="tune" href="customize.html#menu">Настроить меню</a>
  <a class="tune" href="customize.html">Настроить главную</a>
  <div class="me"><span class="av">${esc(((p[0]||'Ш')[0]+((p[1]||'')[0]||'')).toUpperCase())}</span><div><b>${esc(p.slice(0,2).join(' ')||'Вы')}</b><small>${esc(user.company||'Ваша компания')}</small></div></div>
  <button type="button" class="tune" id="logout">Выйти</button>`;
  const bottom=$('#bottom');
  if(bottom){const it=items().slice(0,4);
    bottom.innerHTML=it.map(i=>{const cur=i.id===page?' aria-current="page"':'';const t=i.title.split(' ')[0];
      return i.href?`<a href="${i.href}"${cur}>${esc(t)}</a>`:`<button type="button" data-soon="Раздел «${esc(i.title)}» подключим на следующих шагах">${esc(t)}</button>`;}).join('')+'<button type="button" id="moreBtn">Ещё</button>';}
}
function openSide(){$('#side').classList.add('open');$('#scrim').classList.add('on');}
function closeSide(){$('#side').classList.remove('open');$('#scrim').classList.remove('on');}

document.addEventListener('click',e=>{
  const t=e.target.closest('button,a');if(!t)return;
  if(t.hasAttribute('data-soon')){e.preventDefault();toast(t.dataset.soon||'Эта кнопка заработает на следующем шаге: разделы подключаем по очереди');return;}
  if(t.id==='logout'){try{localStorage.removeItem('shtatka-session')}catch(x){}location.href='index.html';return;}
  if(t.id==='menuBtn'||t.id==='moreBtn'){openSide();return;}
});
const scrim=$('#scrim');if(scrim)scrim.addEventListener('click',closeSide);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSide();});

window.SHTATKA_UI={toast,esc,renderSide,closeSide,
  setUser(fio,company){user={fio,company};renderSide();}};
renderSide();
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
