/* Главная кабинета Штатки.
   Два режима: «мои данные» (человек зарегистрировался в этом браузере) и пример с вымышленными данными
   (без регистрации, по кнопке «Посмотреть на примере» или в просмотре шаблона cabinet.html?tpl=...). */
(function(){
const {W,TPL,DEMO,UT}=window.SHTATKA_WIDGETS,H=window.SHTATKA_HOME,UI=window.SHTATKA_UI;
const $=s=>document.querySelector(s);
const esc=UI.esc,toast=UI.toast;
const SIZE={s:'s3',m:'s6',l:'s12'};
const PLU=(n,a,b,c)=>{const m=n%100,d=n%10;return (m>10&&m<20)?c:d===1?a:(d>=2&&d<=4)?b:c;};
const QTPL=new URLSearchParams(location.search).get('tpl');
const PREVIEW=!!(QTPL&&TPL.find(x=>x.id===QTPL));
const S=H.state();
const cur=PREVIEW?H.resolve('tpl:'+QTPL):H.start();
const layout=cur.layout,demo=cur.demo,dm=DEMO[demo]||{};
const REAL=!PREVIEW&&H.real();
const showDemo=()=>!REAL||S.demoView;

/* имя в приветствии */
let ses=H.session()||{company:'',fio:''};
if(PREVIEW&&dm.who){ses={company:dm.who[1],fio:(dm.who[2]||'Лозицкий')+' '+dm.who[0]};UI.setUser(ses.fio,ses.company);}
const first=((ses.fio||'').trim().split(/\s+/)[1])||'';
const hr=new Date().getHours();
$('#hello').textContent=(hr<5?'Доброй ночи':hr<12?'Доброе утро':hr<18?'Добрый день':'Добрый вечер')+(first?', '+first:'');

/* ---------- срез ---------- */
if(PREVIEW)S.scope=null;
function renderScope(){
  const u=H.scopeUnit(),us=H.units();
  $('#scopeName').textContent=u?u.name:'Вся компания';
  const bar=$('#scopebar');
  if(u){bar.hidden=false;bar.innerHTML=`<span>Показано: <b>${esc(u.name)}</b> · ${UT[u.type]||''} · ${u.staff} ${PLU(u.staff,'человек','человека','человек')}.</span><button type="button" class="b" data-scope="">Вся компания</button>`;}
  else bar.hidden=true;
  const types=[...new Set(us.map(x=>x.type))];
  $('#scopeMenu').innerHTML=`<button type="button" class="pi" data-scope="" aria-pressed="${!u}">Вся компания</button>`+
   (us.length?types.map(t=>`<div class="pg">${UT[t]||t}</div>`+us.filter(x=>x.type===t).map(x=>`<button type="button" class="pi" data-scope="${x.id}" aria-pressed="${!!(u&&u.id===x.id)}">${esc(x.name)}<small>${x.staff}</small></button>`).join('')).join(''):'<p class="lab" style="padding:8px 12px;margin:0">Точки, проекты, города и отделы появятся здесь, когда вы опишете структуру компании.</p>')+
   `<a class="pi link" href="customize.html#structure">Настроить структуру →</a>`;
}
function closeScope(){$('#scopeMenu').hidden=true;$('#scopeBtn').setAttribute('aria-expanded','false');}

/* ---------- блоки на реальных данных ---------- */
const emps=()=>H.employees();
const EMPTY={
 decisions:'Заявок на согласование пока нет.',drivers:'Отметьте водителей в карточках сотрудников: здесь появятся права и медосмотры.',
 migration:'Иностранных сотрудников нет. Если появятся, напомним про уведомления и патенты.',leave:'График отпусков составим по датам приёма.',
 safety:'Кому нужны инструктажи, подскажем по должностям.',med:'Кому нужны медосмотры и медкнижки, определим по должностям.',
 calendar:'Отпуска и выходные появятся здесь после графика.',finance:'Расходы на людей посчитаем, когда появятся оклады.',
 knowledge:'Здесь будут новые требования закона и короткие разборы.',benefits:'Льготы для сотрудников настраиваются в разделе «Льготы».',
 news:'Объявлений пока нет.',shifts:'Смены появятся, когда составите график.',expiry:'Документов со сроком пока нет.',
 absent:'Сегодня все на месте.',swap:'Запросов на подмену нет.',points:'Опишите точки в структуре компании.',
 certs:'Допуски и сертификаты добавляются в карточке сотрудника.',sites:'Объекты появятся из структуры компании.',
 rest:'Режим труда и отдыха водителей появится после первых рейсов.',ppe:'Нормы спецодежды подберём по должностям.',
 hazard:'Данные спецоценки условий труда добавляются в разделе «Компания».',remote:'Кто работает удалённо, отметьте в карточке сотрудника.',
 birthdays:'Дни рождения появятся из анкет сотрудников.',calc:'Калькулятор заработает, когда появятся оклады.',
 kCost:'—',kDocs:'0',kVac:'0 дн.',sick:'0',trips:'0'};
const KPI_SUB={kCost:'посчитаем по окладам',kDocs:'появятся после анкет',kVac:'копится с даты приёма',sick:'больничных нет',trips:'командировок нет'};
function realHtml(id,w){
  const e=emps(),n=e.length;
  const list=(rows,more)=>`<div class="list">${rows.map(r=>`<div class="item"><div class="t"><b>${esc(r[0])}</b><small>${esc(r[1])}</small></div>${r[2]?`<span class="pill ${r[3]||''}">${esc(r[2])}</span>`:''}</div>`).join('')}</div>${more||''}`;
  switch(id){
    case 'kStaff':{const u=H.scopeUnit();const k=u?e.filter(x=>x.unit===u.id).length:n;
      return `<span class="lab">В штате${u?' · '+esc(u.name):''}</span><div class="big">${k}</div><div><a class="pill" href="people.html">${n?'открыть список':'добавить первого'}</a></div>`;}
    case 'tasks':{const t=e.filter(x=>x.kind!=='existing').map(x=>['Анкета не заполнена',x.fio,'Отправить ссылку']).concat(e.filter(x=>x.kind==='existing').map(x=>['Проверить договор',x.fio,'Открыть']));
      return `<h2>Задания <span class="pill" style="background:#1F2B45;color:#F5F1E8">${t.length}</span></h2>`+(t.length?`<div class="list">${t.slice(0,3).map(x=>`<div class="item act"><div class="t"><small>${esc(x[0])}</small>${esc(x[1])}</div><a class="b d" href="people.html">${esc(x[2])}</a></div>`).join('')}</div>`:'<p class="sub">Заданий нет.</p>');}
    case 'hr':{const a=e.filter(x=>x.kind!=='existing').length,b=e.filter(x=>x.kind==='existing').length;
      return `<h2>Личные дела</h2><ul class="bul">${a?`<li class="w2">Ждут анкету: ${a}</li>`:''}${b?`<li class="w2">Договор загружен, проверить: ${b}</li>`:''}<li class="g">Всего в штате: ${n}</li></ul><a class="more" href="people.html">Открыть людей →</a>`;}
    case 'probation':{const r=e.filter(x=>x.kind!=='existing'&&x.contract!=='gph'&&x.contract!=='self');
      return `<h2>Новички и испытательный срок</h2>`+(r.length?list(r.slice(0,3).map(x=>[x.fio,(x.position||'')+(x.start?' · с '+new Date(x.start).toLocaleDateString('ru-RU'):''),'новый'])):'<p class="sub">Новичков на испытательном сроке нет.</p>');}
    case 'fixedterm':{const r=e.filter(x=>x.contract==='fixed');
      return `<h2>Срочные договоры</h2>`+(r.length?list(r.slice(0,3).map(x=>[x.fio,x.position||'','срочный','warn'])):'<p class="sub">Срочных договоров нет.</p>');}
    case 'contractors':{const r=e.filter(x=>x.contract==='gph'||x.contract==='self');
      return `<h2>Самозанятые и подрядчики</h2>`+(r.length?list(r.slice(0,3).map(x=>[x.fio,x.position||'',x.contract==='self'?'самозанятый':'ГПХ'])):'<p class="sub">Самозанятых и подрядчиков нет.</p>');}
    case 'hire':return `<h2>Принять человека</h2><p class="sub">Внесите ФИО и должность: остальное сотрудник заполнит по ссылке.</p><a class="b d" href="people.html#add" style="align-self:flex-start;text-decoration:none">Добавить сотрудника</a>`;
    case 'units':return w.html({t:demo,d:{}});
  }
  if(w.sizes[0]==='s')return `<span class="lab">${esc(w.title)}</span><div class="big">${EMPTY[id]||'0'}</div><div><span class="pill">${esc(KPI_SUB[id]||'пока нет')}</span></div>`;
  return `<h2>${esc(w.title)}</h2><p class="sub">${esc(EMPTY[id]||'Появится, когда добавите сотрудников.')}</p>`;
}

/* ---------- «Первые шаги» ---------- */
function stepsCard(){
  const st=H.steps(),done=st.filter(x=>x.done).length;
  return `<article class="w s12 steps-w" aria-label="Первые шаги"><h2>Первые шаги <span class="lab">${done} из ${st.length}</span></h2>
   <div class="bar"><i style="width:${Math.round(done/st.length*100)}%"></i></div>
   <div class="stl">${st.map((x,i)=>`<a class="stp${x.done?' done':''}" href="${x.href}"><i>${x.done?'✓':i+1}</i><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span></a>`).join('')}</div>
   <div class="steps-f"><button type="button" class="more" id="tourAgain">Как начать работу</button><button type="button" class="more" id="stepsHide">Скрыть</button></div></article>`;
}
function previewCard(){
  return `<article class="w s12 tone-sand" aria-label="Ваша главная"><h2>Ваша главная: «${esc(cur.name)}»</h2>
   <p class="sub">Эти блоки заполнятся, когда появятся сотрудники: ${layout.map(x=>esc(W[x.id].title)).join(', ')}.</p>
   <div><a class="b" href="customize.html">Выбрать другой вариант</a></div></article>`;
}

/* ---------- отрисовка ---------- */
function render(){
  const g=$('#grid'),demoMode=showDemo();
  $('#demoTag').hidden=!demoMode;
  $('#demoToggle').hidden=!REAL||S.demoView;
  $('#demoBar').hidden=!(REAL&&S.demoView);
  let html='';
  if(REAL&&!S.demoView){
    const n=emps().length,st=H.steps(),left=st.filter(x=>!x.done).length;
    $('#subline').textContent=n?('В штате '+n+' '+PLU(n,'человек','человека','человек')+'.'):'Сотрудников пока нет. Начните с первых шагов.';
    if(left&&!S.onboard.hideChecklist)html+=stepsCard();
    if(!n)html+=previewCard();
    else html+=layout.map(x=>{const w=W[x.id],kpi=w.sizes[0]==='s'?' kpi':'';const real=['kStaff','tasks','hr','probation','fixedterm','contractors','hire','units'].includes(x.id);
      return `<article class="w ${SIZE[x.size]}${kpi}${real?'':' quiet'}" data-id="${x.id}" aria-label="${esc(w.title)}">${realHtml(x.id,w)}</article>`;}).join('');
  }else{
    const na=(dm.absent||[1,2,3]).length,nd=(dm.dec||[1,2,3]).length;
    const u=H.scopeUnit();
    $('#subline').textContent=u?('Срез «'+u.name+'».'):('Сегодня не на месте '+na+' '+PLU(na,'человек','человека','человек')+'. Ваших решений ждут '+nd+' '+PLU(nd,'заявка','заявки','заявок')+'.');
    html=layout.length?layout.map(x=>{const w=W[x.id],tone=w.tone?' tone-'+w.tone:'',kpi=w.sizes[0]==='s'?' kpi':'';
      return `<article class="w ${SIZE[x.size]}${tone}${kpi}" data-id="${x.id}" aria-label="${esc(w.title)}">${w.html({t:demo,d:dm})}</article>`;}).join('')
      :'<div class="empty"><b>Здесь пока пусто.</b><br>Нажмите «Настроить главную» и добавьте нужные блоки.</div>';
  }
  g.innerHTML=html;
  UI.renderSide();
}

/* ---------- окно «Первые шаги» ---------- */
const ART={
 hello:`<svg viewBox="0 0 320 150" aria-hidden="true"><rect x="40" y="18" width="240" height="120" rx="14" fill="#1F2B45"/><rect x="40" y="18" width="62" height="120" rx="14" fill="#2A3858"/><rect x="88" y="18" width="14" height="120" fill="#2A3858"/>
  <rect x="52" y="36" width="38" height="7" rx="3.5" fill="#F2C38F"/><rect x="52" y="54" width="30" height="6" rx="3" fill="#C2CADB"/><rect x="52" y="68" width="34" height="6" rx="3" fill="#C2CADB"/><rect x="52" y="82" width="26" height="6" rx="3" fill="#C2CADB"/>
  <rect x="116" y="34" width="70" height="44" rx="8" fill="#F7EBDD"/><rect x="196" y="34" width="70" height="44" rx="8" fill="#F2C38F"/><rect x="116" y="88" width="150" height="36" rx="8" fill="#D6DCE6"/>
  <rect x="126" y="46" width="22" height="10" rx="3" fill="#1F2B45"/><rect x="126" y="62" width="40" height="6" rx="3" fill="#C9BFAE"/><rect x="206" y="46" width="30" height="10" rx="3" fill="#1F2B45"/>
  <circle cx="132" cy="106" r="8" fill="#3F5E8F"/><rect x="146" y="100" width="70" height="6" rx="3" fill="#1F2B45"/><rect x="146" y="110" width="44" height="5" rx="2.5" fill="#3F5E8F"/></svg>`,
 choose:`<svg viewBox="0 0 320 150" aria-hidden="true"><g><rect x="18" y="30" width="86" height="96" rx="14" fill="#F7EBDD"/><circle cx="61" cy="66" r="14" fill="none" stroke="#1F2B45" stroke-width="3" stroke-dasharray="5 5"/><path d="M55 66h12M61 60v12" stroke="#1F2B45" stroke-width="3" stroke-linecap="round"/><rect x="38" y="96" width="46" height="7" rx="3.5" fill="#C9BFAE"/></g>
  <g><rect x="117" y="30" width="86" height="96" rx="14" fill="#D6DCE6"/><circle cx="160" cy="62" r="11" fill="#1F2B45"/><rect x="144" y="76" width="32" height="20" rx="10" fill="#1F2B45"/><rect x="137" y="104" width="46" height="7" rx="3.5" fill="#3F5E8F"/></g>
  <g><rect x="216" y="30" width="86" height="96" rx="14" fill="#F2C38F"/><circle cx="244" cy="64" r="9" fill="#1F2B45"/><circle cx="276" cy="64" r="9" fill="#1F2B45"/><circle cx="260" cy="58" r="10" fill="#3F5E8F"/><rect x="232" y="76" width="56" height="18" rx="9" fill="#1F2B45"/><rect x="236" y="104" width="46" height="7" rx="3.5" fill="#1F2B45" opacity=".5"/></g></svg>`,
 doc:`<svg viewBox="0 0 320 150" aria-hidden="true"><rect x="92" y="14" width="104" height="128" rx="10" fill="#F7EBDD"/><rect x="108" y="32" width="56" height="8" rx="4" fill="#1F2B45"/>${[52,64,76,88,100].map(y=>`<rect x="108" y="${y}" width="${y%24?72:60}" height="5" rx="2.5" fill="#C9BFAE"/>`).join('')}<path d="M110 122c8-10 14 6 22-4s12 2 18-2" fill="none" stroke="#3F5E8F" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="176" y="70" width="86" height="60" rx="12" fill="#1F2B45"/><rect x="200" y="62" width="30" height="12" rx="4" fill="#1F2B45"/><circle cx="219" cy="100" r="17" fill="#2A3858"/><circle cx="219" cy="100" r="10" fill="#F2C38F"/><circle cx="248" cy="80" r="3.5" fill="#F2C38F"/>
  <circle cx="74" cy="56" r="16" fill="#E3F1EA"/><path d="m66 56 6 6 11-12" fill="none" stroke="#2F7D5B" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const PATHS={
 none:{t:'Сотрудников пока нет',s:'Буду нанимать',head:'Добавьте первого сотрудника',text:'Внесите ФИО и должность, остальное человек заполнит сам по ссылке с телефона. Договор, приказ и согласия подготовим.',btn:'Добавить сотрудника',href:'people.html#add'},
 solo:{t:'Пока работаю один',s:'Сотрудников нет, директор — я',head:'Начните с анкеты компании',text:'Режим работы, дни зарплаты, отпуск. Когда понадобится первый сотрудник, добавите его в разделе «Люди» за пару минут.',btn:'Заполнить анкету',href:'company.html'},
 have:{t:'Сотрудники уже есть',s:'Нужно навести порядок',head:'Загрузите договоры сотрудников',text:'Фото или скан трудовых договоров. Достанем ФИО, должность и даты и покажем, каких документов не хватает.',btn:'Загрузить договоры',href:'people.html#upload'}
};
let slide=0;
function tour(open){
  let d=$('#tour');
  if(!d){d=document.createElement('dialog');d.id='tour';d.className='tour';d.setAttribute('aria-label','Первые шаги');document.body.appendChild(d);
    d.addEventListener('close',()=>{S.onboard.seen=true;H.persist();});}
  const p=PATHS[S.onboard.path];
  const dots=`<div class="dots">${[0,1,2].map(i=>`<i class="${i===slide?'on':''}"></i>`).join('')}</div>`;
  let body='';
  if(slide===0)body=`<div class="art">${ART.hello}</div><h2>Добро пожаловать${first?', '+esc(first):''}</h2><p>Штатка ведёт кадры за вас: договоры, приказы, согласия, отпуска и сроки. Покажем, с чего начать: это займёт минуту.</p>`;
  if(slide===1)body=`<div class="art">${ART.choose}</div><h2>Что у вас сейчас?</h2><div class="opts">${Object.entries(PATHS).map(([k,v])=>`<button type="button" class="opt" data-path="${k}" aria-pressed="${S.onboard.path===k}"><b>${v.t}</b><small>${v.s}</small></button>`).join('')}</div>`;
  if(slide===2)body=`<div class="art">${ART.doc}</div><h2>${esc(p.head)}</h2><p>${esc(p.text)}</p>${H.verified()?'':'<p class="small">Перед этим подтвердите компанию: подписью руководителя или оплатой счёта.</p>'}`;
  const next=slide===2?`<a class="b d" href="${H.verified()||p.href==='company.html'?p.href:'register.html#verify'}" id="tourGo">${H.verified()||p.href==='company.html'?esc(p.btn):'Подтвердить компанию'}</a>`:`<button type="button" class="b d" id="tourNext"${slide===1&&!S.onboard.path?' disabled':''}>Далее</button>`;
  d.innerHTML=`<div class="tour-b">${body}</div><div class="tour-f">${dots}<div><button type="button" class="b" id="tourClose">${slide===2?'Позже':'Закрыть'}</button>${next}</div></div>`;
  if(open&&!d.open){if(d.showModal)d.showModal();else d.setAttribute('open','');}
}

/* ---------- события ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a');
  if(!t){closeScope();return;}
  if(t.dataset.scope!==undefined&&!PREVIEW){H.setScope(t.dataset.scope||null);renderScope();render();closeScope();return;}
  if(!t.closest('.scope'))closeScope();
  if(t.dataset.path){S.onboard.path=t.dataset.path;H.persist();tour(false);return;}
  switch(t.id){
    case 'scopeBtn':{const m=$('#scopeMenu');m.hidden=!m.hidden;t.setAttribute('aria-expanded',String(!m.hidden));break;}
    case 'hintX':try{localStorage.setItem('shtatka-cabinet-hint','1')}catch(x){}$('#hint').hidden=true;break;
    case 'demoToggle':case 'demoOn2':S.demoView=true;H.persist();render();window.scrollTo(0,0);break;
    case 'demoOff':S.demoView=false;H.persist();render();break;
    case 'stepsHide':S.onboard.hideChecklist=true;H.persist();render();toast('Первые шаги скрыты. Вернуть можно в «Настроить главную».');break;
    case 'tourAgain':slide=0;tour(true);break;
    case 'tourNext':slide=Math.min(2,slide+1);tour(false);break;
    case 'tourClose':$('#tour').close();break;
    case 'tourGo':S.onboard.seen=true;H.persist();break;
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeScope();});
$('#search').addEventListener('keydown',e=>{if(e.key==='Enter')toast('Поиск и AI-помощник подключим на следующем шаге');});
let hintSeen=false;try{hintSeen=!!localStorage.getItem('shtatka-cabinet-hint')}catch(e){}
if(PREVIEW||hintSeen||REAL||S.start!=='tpl:base')$('#hint').hidden=true;

renderScope();render();
if(REAL&&!S.onboard.seen&&!S.demoView)setTimeout(()=>tour(true),300);
})();
