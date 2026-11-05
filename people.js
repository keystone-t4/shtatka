/* Раздел «Люди»: приём, увольнение, карточка сотрудника. Всё, что вносится здесь, сразу попадает в остальные разделы
   (воинский учёт, иностранцы, зарплата, больничные, документы и сроки, трудовая книжка, архив). Ядро — hr-core.js. */
(function(){
const H=window.SHTATKA_HOME,UI=window.SHTATKA_UI,R=window.SHTATKA_HR,esc=UI.esc,toast=UI.toast;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cfg=window.SHTATKA_CONFIG||{};
const d=R.d;
const PLU=(n,a,b,c)=>{const m=n%100,k=n%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
const real=H.real();
let bypass=false;try{bypass=sessionStorage.getItem('shtatka-demo-bypass')==='1'}catch(e){}
const canEdit=()=>!real||H.verified()||bypass;
let kind='new',sex='m',upMode='upload',pending=null,cur=null,tab='data';

const opt=(o,sel)=>Object.entries(o).map(([k,v])=>`<option value="${k}"${k===sel?' selected':''}>${esc(typeof v==='string'?v:v.t)}</option>`).join('');
$('#eReg').innerHTML=opt(R.REGIME);$('#eCon').innerHTML=opt(R.CONTRACT);
$('#eMilCat').innerHTML='<option value="">Не знаю (уточним)</option>'+opt(R.MILCAT);$('#eFit').innerHTML=opt(R.FIT);
$('#fWhy').innerHTML=opt(R.FIRE);

function render(){
  const all=R.active(),n=all.length;
  $('#gate').hidden=!real||H.verified()||bypass;
  const none=!R.emps().length;
  $('#empty').hidden=!none;$('#list').hidden=none;$('#kpis').hidden=none;
  $('#pActs').hidden=none&&false;
  $('#pSub').textContent=none?'Сотрудников пока нет. Выберите, с чего начать.':('В штате '+n+' '+PLU(n,'человек','человека','человек')+'. Всё, что вы вносите здесь, появляется в остальных разделах.');
  if(none){$('#todo').hidden=true;return;}
  const mil=all.filter(e=>['in','check'].includes(R.mil(e).st)).length,fr=all.filter(e=>!!R.foreign(e)).length,sk=all.filter(e=>R.onSick(e)).length,ov=R.overdue().length;
  $('#kpis').innerHTML=[['В штате',n,'people.html'],['Воинский учёт',mil,'military.html'],['Иностранцы',fr,'foreign.html'],['На больничном',sk,'sick.html'],['Просрочено',ov,'docs.html',ov?'crit':'']].map(k=>`<a class="kpi ${k[3]||''}" href="${k[2]}"><b>${k[1]}</b><span>${k[0]}</span></a>`).join('');
  const t=R.openTasks().sort((a,b)=>a.due<b.due?-1:1).slice(0,5);
  $('#todo').hidden=!t.length;
  $('#todo').innerHTML=t.length?`<div class="bh"><h2>Что сделать</h2><a href="docs.html">Все сроки →</a></div><div class="tl">${t.map(x=>taskRow(x)).join('')}</div>`:'';
  const units=H.units();
  $('#list').innerHTML=all.map(x=>{const p=x.fio.split(/\s+/);const u=units.find(y=>y.id===x.unit);
    const tags=[];const m=R.mil(x);if(m.st==='in')tags.push('<span class="pill info">воинский учёт</span>');if(m.st==='check')tags.push('<span class="pill warn">уточнить учёт</span>');
    const f=R.foreign(x);if(f)tags.push(`<span class="pill ${f.lvl==='ok'?'info':f.lvl}">иностранец</span>`);if(R.onSick(x))tags.push('<span class="pill warn">на больничном</span>');
    const open=x.tasks.filter(t=>!t.done).length;if(open)tags.push(`<span class="pill ${x.tasks.some(t=>!t.done&&t.due<d.today())?'crit':'warn'}">задач: ${open}</span>`);
    return `<div class="er" data-card="${x.id}" role="button" tabindex="0"><span class="av">${esc(((p[0]||'')[0]||'')+((p[1]||'')[0]||''))}</span>
     <div><b>${esc(x.fio)}</b><small>${esc(x.position||'')}${u?' · '+esc(u.name):''}</small></div>
     <div class="hide-m"><small>${esc(R.CONTRACT[x.contract]||'')} · с ${d.fmt(x.start)}</small></div>
     <div class="tags">${tags.join('')}</div></div>`;}).join('');
}
function taskRow(x){
  const late=x.due<d.today();
  return `<div class="tk ${late?'late':''}"><label><input type="checkbox" data-task="${x.id}" data-eid="${x.eid}"${x.done?' checked':''}><span><b>${esc(x.title)}</b><small>${esc(x.fio)} · ${esc(x.law)}</small></span></label><span class="pill ${late?'crit':'info'}">${late?'просрочено, ':'до '}${d.fmt(x.due)}</span></div>`;
}
function open(id){const e=$(id);if(e.showModal)e.showModal();else e.setAttribute('open','');}
function close(e){if(e.open)e.close();}
function want(what){
  if(what==='check'){openUpload('check');return;}
  if(!canEdit()){pending=what;$('#gDemo').hidden=$('#gSkip').hidden=!!cfg.apiUrl;open('#dGate');return;}
  if(what==='add')openAdd('new');else if(what==='fire')openFire();else if(what==='bulk'){$('#bText').value='';$('#bNote').hidden=true;open('#dBulk');}else openUpload('upload');
}

/* ---------- приём ---------- */
function formData(){
  const reg=$('#eReg').value,ru=reg==='ru';
  return {fio:$('#eFio').value.trim(),sex,birth:$('#eBirth').value,regime:reg,country:ru?'Россия':($('#eCountry').value.trim()||''),permitNo:$('#ePermit').value.trim(),permitUntil:$('#ePermitUntil').value,
    milCat:$('#eMilCat').value,fit:$('#eFit').value,hasVus:$('#eVus').checked,position:$('#ePos').value.trim(),contract:$('#eCon').value,salary:+$('#eSal').value||0,
    start:$('#eStart').value||d.today(),phone:$('#ePhone').value.trim(),unit:$('#eUnit').value,existing:kind==='existing'};
}
function boxes(){
  const reg=$('#eReg').value,ru=reg==='ru';
  $('#boxFor').hidden=ru||reg==='eaeu'&&false;
  $('#boxMil').hidden=!(ru&&sex==='m')&&!(ru&&sex==='f');
  $('#eVusW').hidden=sex!=='f';$('#eMilCat').closest('.fld').hidden=false;$('#eFit').closest('.fld').hidden=false;
  if(sex==='f'){const v=$('#eVus').checked;$('#eMilCat').closest('.fld').hidden=!v;$('#eFit').closest('.fld').hidden=!v;}
}
function preview(){
  const f=formData(),tmp=Object.assign({id:'x',prev:[],tasks:[],sick:[],etk:{}},f);
  const rows=[['Люди','попадёт в штат'],['Документы и сроки','договор, приказ, согласие, карточка Т-2'],['Трудовая книжка','запись о приёме в ЕФС-1 до '+d.fmt(d.nextWork(f.start))]];
  if(f.salary)rows.push(['Зарплата','войдёт в расчёт на команду']);
  if(f.regime!=='ru'){rows.push(['Иностранцы','уведомление в МВД до '+d.fmt(d.addWork(f.start,3))+(f.permitUntil?', документ до '+d.fmt(f.permitUntil):'')]);rows.push(['Воинский учёт','не ведётся: иностранный гражданин']);}
  else{const m=R.mil(tmp,f.start);
    if(!f.birth)rows.push(['Воинский учёт','заполните дату рождения: определим, ставить ли на учёт']);
    else if(m.st==='in')rows.push(['Воинский учёт','ставим на учёт; сведения в военкомат до '+d.fmt(d.addWork(f.start,5))]);
    else if(m.st==='check')rows.push(['Воинский учёт','требует уточнения: '+m.why]);
    else rows.push(['Воинский учёт','не ставим: '+m.why]);}
  const a=R.age(f.birth,f.start);if(a!=null&&a<18)rows.push(['Охрана труда','несовершеннолетний: медосмотр, испытательный срок запрещён']);
  $('#ePrev').innerHTML='<b>Что произойдёт после приёма</b>'+rows.map(r=>`<div><span>${esc(r[0])}</span><i>${esc(r[1])}</i></div>`).join('');
}
function openAdd(k){
  kind=k;$$('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===k));
  $('#eStartL').textContent=k==='existing'?'Работает с':'Дата выхода';
  $('#eUnit').innerHTML='<option value="">Без подразделения</option>'+H.units().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  $('#eUnitW').hidden=!H.units().length;
  if(!$('#eStart').value)$('#eStart').value=d.today();
  $('#eErr').hidden=true;boxes();preview();open('#dAdd');$('#eFio').focus();
}
$('#fAdd').addEventListener('input',()=>{boxes();preview();});$('#fAdd').addEventListener('change',()=>{boxes();preview();});
$('#fAdd').addEventListener('click',e=>{const b=e.target.closest('[data-sex]');if(!b)return;sex=b.dataset.sex;$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x===b));boxes();preview();});
$('#fAdd').addEventListener('submit',e=>{
  e.preventDefault();const f=formData();let err='';
  if(f.fio.split(/\s+/).length<2)err='Напишите фамилию и имя.';
  else if(!f.birth)err='Укажите дату рождения: по ней определяем воинский учёт и условия труда.';
  else if(!f.position)err='Укажите должность.';
  else if(f.regime!=='ru'&&f.regime!=='eaeu'&&!f.permitUntil)err='Укажите, до какого числа действует документ на работу.';
  if(err){$('#eErr').hidden=false;$('#eErr').textContent=err;return;}
  const x=R.hire(f);
  ['#eFio','#ePos','#ePhone','#eSal','#eBirth','#eCountry','#ePermit','#ePermitUntil'].forEach(s=>$(s).value='');
  close($('#dAdd'));render();
  const n=[];if(f.regime!=='ru')n.push('иностранцы');else if(['in','check'].includes(R.mil(x).st))n.push('воинский учёт');
  toast('Принят. Уже добавлен: люди, документы и сроки, трудовая книжка'+(f.salary?', зарплата':'')+(n.length?', '+n.join(', '):'')+'.');
});

/* ---------- импорт списком ---------- */
$('#fBulk').addEventListener('submit',e=>{
  e.preventDefault();const lines=$('#bText').value.split(/\n/).map(x=>x.trim()).filter(Boolean);let ok=0,bad=[];
  lines.forEach((l,i)=>{const c=l.split(/[;\t]/).map(x=>x.trim());
    const [fio,birth,pos,sal,start,sx,cit]=c;
    if(!fio||fio.split(/\s+/).length<2||!/^\d{4}-\d{2}-\d{2}$/.test(birth||'')||!pos){bad.push(i+1);return;}
    const ru=!cit||/^(рф|россия|ru)$/i.test(cit);
    R.hire({fio,birth,position:pos,salary:+String(sal||'').replace(/\s/g,'')||0,start:/^\d{4}-\d{2}-\d{2}$/.test(start||'')?start:d.today(),sex:/^ж/i.test(sx||'')?'f':'m',regime:ru?'ru':'patent',country:ru?'Россия':cit,existing:true});ok++;});
  const n=$('#bNote');n.hidden=false;
  n.textContent='Добавлено: '+ok+(bad.length?'. Не разобрали строки: '+bad.join(', ')+' (нужны ФИО, дата рождения ГГГГ-ММ-ДД и должность).':'.')+(ok?' Иностранцев без срока патента проверьте в карточке.':'');
  render();if(ok&&!bad.length)setTimeout(()=>close($('#dBulk')),900);
});

/* ---------- увольнение ---------- */
function firePrev(){
  const e=R.get($('#fWho').value);if(!e)return;const f=R.FIRE[$('#fWhy').value],dt=$('#fDate').value||d.today();
  $('#fNote').textContent=f.a+'. '+f.note;
  const rows=[['Люди и зарплата','уйдёт из штата и расчёта с '+d.fmt(dt)],['Архив','личное дело хранится до '+d.fmt(R.purgeOn({out:{date:dt}}))],['Трудовая книжка','запись об увольнении в ЕФС-1 до '+d.fmt(d.nextWork(dt))+', выдать СТД-Р в последний день']];
  if(!R.foreign(e)&&['in','check'].includes(R.mil(e).st))rows.push(['Воинский учёт','сообщить в военкомат до '+d.fmt(d.addWork(dt,5))+' и снять с учёта организации']);
  if(R.foreign(e))rows.push(['Иностранцы','уведомление в МВД о прекращении договора до '+d.fmt(d.addWork(dt,3))]);
  {const v=R.vacation(e);rows.push(['Расчёт','выплатить всё в последний день (ст. 140 ТК). Неиспользованный отпуск: '+v.left+' дн., компенсация около '+Math.round(v.comp).toLocaleString('ru-RU')+' ₽ (ст. 127 ТК), оценка']);}
  $('#fPrev').innerHTML='<b>Что произойдёт после увольнения</b>'+rows.map(r=>`<div><span>${esc(r[0])}</span><i>${esc(r[1])}</i></div>`).join('');
}
function openFire(id){
  const a=R.active();if(!a.length){toast('Увольнять пока некого: в штате никого нет.');return;}
  $('#fWho').innerHTML=a.map(e=>`<option value="${e.id}"${e.id===id?' selected':''}>${esc(e.fio)} — ${esc(e.position||'')}</option>`).join('');
  $('#fDate').value=d.today();$('#fErr').hidden=true;firePrev();open('#dFire');
}
$('#fFire').addEventListener('input',firePrev);$('#fFire').addEventListener('change',firePrev);
$('#fFire').addEventListener('submit',e=>{
  e.preventDefault();const id=$('#fWho').value,dt=$('#fDate').value;
  if(!id||!dt){$('#fErr').hidden=false;$('#fErr').textContent='Выберите сотрудника и дату.';return;}
  const x=R.fire(id,$('#fWhy').value,dt);close($('#dFire'));close($('#dCard'));render();
  toast((x?x.fio.split(' ').slice(0,2).join(' '):'Сотрудник')+' уволен. Он убран из штата, зарплаты и учётов, личное дело в архиве.');
});

/* ---------- карточка ---------- */
const TABS=e=>[['data','Данные'],['docs','Документы'],['mil','Воинский учёт'],...(R.foreign(e)?[['for','Иностранец']]:[]),['etk','Трудовая и стаж'],['sick','Больничные'],['log','История']];
function field(id,label,val,type,ph){return `<label class="fld">${label}<input id="${id}" type="${type||'text'}" value="${esc(val==null?'':val)}"${ph?` placeholder="${esc(ph)}"`:''}></label>`;}
function openCard(id,t){
  const e=R.get(id);if(!e)return;cur=id;tab=t||'data';
  $('#dCardT').textContent=e.fio;
  $('#dCardS').textContent=(e.position||'')+(e.out?' · уволен '+d.fmt(e.out.date):' · с '+d.fmt(e.start));
  paintCard();if(!$('#dCard').open)open('#dCard');
}
function paintCard(){
  const e=R.get(cur);if(!e)return;
  const tb=TABS(e);if(!tb.some(x=>x[0]===tab))tab='data';
  $('#cTabs').innerHTML=tb.map(x=>`<button type="button" role="tab" data-tab="${x[0]}" aria-selected="${x[0]===tab}">${x[1]}</button>`).join('');
  const B=$('#cBody');let h='';
  if(tab==='data'){
    h=`<div class="fld2">${field('cFio','ФИО',e.fio)}${field('cPos','Должность',e.position)}</div>
    <div class="fld2">${field('cBirth','Дата рождения',e.birth,'date')}${field('cSal','Оклад, ₽',e.salary,'number')}</div>
    <div class="fld2">${field('cStart','Дата приёма',e.start,'date')}${field('cPhone','Телефон',e.phone,'tel')}</div>
    ${(()=>{const v=R.vacation(e);return `<div class="st ${v.canTake?'in':'check'}"><b>Отпуск: накоплено ${v.acc} дн., осталось ${v.left} дн.</b><span>${v.canTake?'Можно брать отпуск.':'Первый отпуск по закону после 6 месяцев работы.'} Компенсация за остаток около ${v.comp.toLocaleString('ru-RU')} ₽ (оценка). 28 календарных дней в год.</span></div><div class="fld2">${field('cVacUsed','Использовано дней отпуска',e.vacUsed||0,'number')}<span></span></div>`;})()}
    <div class="kv"><span>Договор</span><b>${esc(R.CONTRACT[e.contract]||'')}</b><span>Гражданство</span><b>${esc(R.REGIME[e.regime]||'')}${e.regime!=='ru'?', '+esc(e.country||''):''}</b></div>
    ${e.out?`<p class="note2">Уволен ${d.fmt(e.out.date)}: ${esc(R.FIRE[e.out.reason].t)} (${esc(R.FIRE[e.out.reason].a)}). Личное дело хранится до ${d.fmt(R.purgeOn(e))}.</p>`:''}
    <div class="tl">${e.tasks.length?e.tasks.map(t=>taskRow(Object.assign({},t,{eid:e.id,fio:e.fio}))).join(''):'<p class="muted">Задач нет.</p>'}</div>`;
  }else if(tab==='docs'){
    h=`<p class="muted">Документы собираются из карточки и меняются, когда меняются данные. Состав зависит от пола, гражданства и статуса.</p><div class="dl">${R.docsFor(e).map(x=>`<button type="button" class="doc" data-doc="${x[0]}"><b>${esc(x[1])}</b><small>Открыть, распечатать или сохранить в PDF</small></button>`).join('')}</div>`;
  }else if(tab==='mil'){
    const m=R.mil(e);
    h=`<div class="st ${m.st}"><b>${{in:'Подлежит воинскому учёту',check:'Нужно уточнить',out:'Снять с учёта',no:'На учёт не ставится'}[m.st]}</b><span>${esc(m.why)}</span></div>`;
    if(R.foreign(e)===null&&(m.st!=='no'||e.sex==='f')){
      h+=`<div class="fld2"><label class="fld">Категория запаса<select id="cMilCat"><option value="">Не знаю</option>${opt(R.MILCAT,e.milCat)}</select></label><label class="fld">Годность<select id="cFit">${opt(R.FIT,e.fit)}</select></label></div>
      <div class="fld2">${field('cMilDoc','Военный билет',e.milDoc,'text','серия и номер')}${field('cRank','Звание',e.rank)}</div><div class="fld2">${field('cVus','ВУС',e.vus)}${field('cKom','Военкомат',e.komm)}</div>
      ${e.sex==='f'?`<label class="chk"><input type="checkbox" id="cHasVus"${e.hasVus?' checked':''}> Есть ВУС</label>`:''}
      <label class="chk"><input type="checkbox" id="cAbroad"${e.livesAbroad?' checked':''}> Постоянно живёт за границей</label>
      <p class="muted">Предельный возраст по составу: рядовые и сержанты ${R.soldierLimit(new Date().getFullYear())} лет в этом году (повышается до 55 к 2028 году), младшие офицеры 60, старшие 65, высшие 70. Для женщин 45 и 50. Проверить по действующей редакции закона.</p>`;
    }else if(R.foreign(e))h+='<p class="muted">Иностранные граждане на воинском учёте организации не состоят.</p>';
  }else if(tab==='for'){
    const f=R.foreign(e);
    h=`<div class="st ${f.lvl==='ok'?'in':f.lvl==='warn'?'check':'out'}"><b>${esc(R.REGIME[e.regime])}</b><span>${esc(f.msg)}</span></div>
    <div class="fld2">${field('cCountry','Страна',e.country)}${field('cPermit','Номер документа',e.permitNo)}</div>${field('cUntil','Документ действует до',e.permitUntil,'date')}
    <label class="fld">Режим<select id="cReg">${opt(R.REGIME,e.regime)}</select></label>
    <p class="muted">Уведомление МВД о приёме и о прекращении договора подаётся в течение 3 рабочих дней. Штраф юрлицу до 1 млн ₽ (ст. 18.15 КоАП), проверить.</p>`;
  }else if(tab==='etk'){
    const z=R.stazh(e),s=e.etk&&e.etk.sfr;
    h=`<div class="st in"><b>Стаж: ${R.fmtY(z.total)}</b><span>у нас ${R.fmtY(z.own)}, до нас ${R.fmtY(z.prev)}; пересекающиеся периоды не считаются дважды.</span></div>
    <div class="fld2"><label class="fld">Трудовая книжка<select id="cEtk"><option value="etk"${e.etk.kind==='etk'?' selected':''}>Только электронная (СТД-Р)</option><option value="both"${e.etk.kind==='both'?' selected':''}>Электронная и бумажная</option><option value="paper"${e.etk.kind==='paper'?' selected':''}>Только бумажная</option></select></label></div>
    <b>Прошлые места работы</b>
    <div class="prevs">${e.prev.map((p,i)=>`<div><span>${esc(p.org)}</span><i>${d.fmt(p.from)} — ${d.fmt(p.to)} · ${esc(p.src||'')}</i><button type="button" class="x" data-delprev="${i}">убрать</button></div>`).join('')||'<p class="muted">Пока не внесены.</p>'}</div>
    <div class="fld2">${field('pOrg','Организация','')}${field('pFrom','С','','date')}</div><div class="fld2">${field('pTo','По','','date')}<div class="fld"><br><button type="button" class="b" id="pAdd">Добавить период</button></div></div>
    <b>Сверка с электронной трудовой книжкой</b>
    <p class="muted">Попросите сотрудника скачать «Сведения о трудовой деятельности» на Госуслугах (раздел «Работа и пенсия» → «Электронная трудовая книжка») и внесите итог. Мы сравним со своим расчётом и покажем расхождение.</p>
    <div class="fld2">${field('sY','Лет по выписке',s?s.y:'','number')}${field('sM','Месяцев',s?s.m:'','number')}</div>${field('sD','Дней',s?s.d:'','number')}
    ${s?`<div class="st ${z.match?'in':'check'}"><b>${z.match?'Стаж совпадает с выпиской':'Расхождение '+Math.abs(z.gap)+' дн.'}</b><span>${z.match?'Данные в приложении и в ЭТК согласованы.':'У нас '+R.fmtY(z.total)+', в выписке '+s.y+' л. '+s.m+' мес. '+s.d+' дн. Проверьте прошлые места, периоды без записи и наши записи о приёме и увольнении. Исправление в ЭТК подаётся сведениями ЕФС-1 (подраздел 1.1).'}</span></div>`:''}
    <b>События для ЕФС-1 (подраздел 1.1)</b>
    <div class="tl">${e.tasks.filter(t=>t.key==='efs'||t.key==='fEfs').map(t=>taskRow(Object.assign({},t,{eid:e.id,fio:e.fio}))).join('')||'<p class="muted">События не найдены.</p>'}</div>`;
  }else if(tab==='sick'){
    h=`<div class="prevs">${e.sick.map(s=>`<div><span>${d.fmt(s.from)} — ${d.fmt(s.to)}</span><i>${esc(s.no||'номер листа не указан')}</i>${s.open?`<button type="button" class="x" data-closesick="${s.id}">закрыть</button>`:'<i>закрыт</i>'}</div>`).join('')||'<p class="muted">Больничных нет.</p>'}</div>
    ${e.out?'':`<div class="fld2">${field('sFrom','С','','date')}${field('sTo','По','','date')}</div>${field('sNo','Номер электронного листа','','text','12 цифр')}<button type="button" class="b" id="sAdd">Добавить больничный</button>`}`;
  }else{
    h=`<div class="prevs">${e.log.map(l=>`<div><span>${esc(l.t)}</span><i>${new Date(l.at).toLocaleDateString('ru-RU')}</i></div>`).join('')}</div>`;
  }
  B.innerHTML=h;
  const f=$('#cFoot');
  f.innerHTML=e.out?`<button type="button" class="b" data-restore="${e.id}">Вернуть из архива</button><button type="button" class="b d" data-close>Закрыть</button>`
   :`<button type="button" class="b" data-fire="${e.id}">Уволить</button><button type="button" class="b" data-del="${e.id}">Удалить запись</button><button type="button" class="b d" id="cSave">Сохранить</button>`;
}
function saveCard(){
  const e=R.get(cur);if(!e)return;const g=s=>{const x=$(s);return x?x.value:undefined;},c=s=>{const x=$(s);return x?x.checked:undefined;};
  const p={};
  const map={cFio:'fio',cPos:'position',cBirth:'birth',cStart:'start',cPhone:'phone',cMilDoc:'milDoc',cRank:'rank',cVus:'vus',cKom:'komm',cCountry:'country',cPermit:'permitNo',cUntil:'permitUntil',cMilCat:'milCat',cFit:'fit',cReg:'regime'};
  Object.entries(map).forEach(([k,v])=>{const x=g('#'+k);if(x!==undefined)p[v]=x;});
  if(g('#cSal')!==undefined)p.salary=+g('#cSal')||0;
  if(g('#cVacUsed')!==undefined)p.vacUsed=+g('#cVacUsed')||0;
  if(c('#cHasVus')!==undefined)p.hasVus=c('#cHasVus');if(c('#cAbroad')!==undefined)p.livesAbroad=c('#cAbroad');
  if(g('#cEtk')!==undefined)e.etk.kind=g('#cEtk');
  if(g('#sY')!==undefined&&g('#sY')!==''){e.etk.sfr={y:+g('#sY')||0,m:+g('#sM')||0,d:+g('#sD')||0,at:d.today()};}
  if(p.fio)p.fio=p.fio.trim();
  R.update(cur,p);R.save();paintCard();render();toast('Сохранено. Разделы пересчитаны.');
}

document.addEventListener('click',ev=>{
  const t=ev.target.closest('button,a,[data-card]');if(!t)return;
  if(t.dataset.open){want(t.dataset.open);return;}
  if(t.hasAttribute('data-close')){close(t.closest('dialog'));return;}
  if(t.dataset.kind){openAdd(t.dataset.kind);return;}
  if(t.dataset.card){openCard(t.dataset.card);return;}
  if(t.dataset.tab){tab=t.dataset.tab;paintCard();return;}
  if(t.dataset.doc){const e=R.get(cur);$('#dDocT').textContent=(R.docsFor(e).find(x=>x[0]===t.dataset.doc)||[])[1]||'Документ';$('#docBody').innerHTML=R.docHtml(e,t.dataset.doc);open('#dDoc');return;}
  if(t.id==='docPrint'){const w=window.open('','_blank');if(w){w.document.write('<meta charset="utf-8"><title>Документ</title><style>body{font:14px/1.5 Onest,Arial,sans-serif;max-width:720px;margin:32px auto;padding:0 20px}td{border:1px solid #999;padding:6px 10px}table{border-collapse:collapse;width:100%}.d{color:#666;font-size:12px}</style>'+$('#docBody').innerHTML);w.document.close();w.focus();w.print();}return;}
  if(t.id==='cSave'){saveCard();return;}
  if(t.dataset.fire){close($('#dCard'));openFire(t.dataset.fire);return;}
  if(t.dataset.restore){R.restore(t.dataset.restore);close($('#dCard'));render();toast('Сотрудник возвращён в штат. Задачи по приёму не создавались: проверьте данные.');return;}
  if(t.id==='pAdd'){const o=$('#pOrg').value.trim(),f=$('#pFrom').value,to=$('#pTo').value;if(!o||!f||!to||to<f){toast('Укажите организацию и корректные даты.');return;}const e=R.get(cur);e.prev.push({org:o,from:f,to,src:'вручную'});R.save();paintCard();return;}
  if(t.dataset.delprev!==undefined){const e=R.get(cur);e.prev.splice(+t.dataset.delprev,1);R.save();paintCard();return;}
  if(t.id==='sAdd'){const f=$('#sFrom').value,to=$('#sTo').value;if(!f||!to||to<f){toast('Укажите даты больничного.');return;}R.addSick(cur,{from:f,to,no:$('#sNo').value.trim()});paintCard();render();toast('Больничный добавлен: сотрудник отмечен в зарплате и учёте отсутствий.');return;}
  if(t.dataset.closesick){R.closeSick(cur,t.dataset.closesick);paintCard();render();return;}
  if(t.dataset.del){if(t.dataset.arm){R.remove(t.dataset.del);close($('#dCard'));render();toast('Запись удалена целиком, архив её не хранит.');}else{t.dataset.arm='1';t.textContent='Точно удалить?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='Удалить запись';}},3000);}return;}
  if(t.id==='gSkip'){bypass=true;try{sessionStorage.setItem('shtatka-demo-bypass','1')}catch(x){}close($('#dGate'));render();if(pending)want(pending);return;}
  if(t.id==='upManual'){close($('#dUp'));openAdd('existing');return;}
});
document.addEventListener('change',ev=>{
  const c=ev.target.closest('[data-task]');if(!c)return;
  R.doneTask(c.dataset.eid,c.dataset.task,c.checked);render();if($('#dCard').open)paintCard();
});
document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.dataset&&ev.target.dataset.card){ev.preventDefault();openCard(ev.target.dataset.card);}});

/* ---------- загрузка договоров (как раньше) ---------- */
function openUpload(mode){
  upMode=mode;$('#upList').innerHTML='';$('#upNote').hidden=true;$('#upManual').hidden=true;$('#upFiles').value='';
  $('#dUpT').textContent=mode==='check'?'Бесплатная проверка договора':'Загрузить договоры';
  $('#upText').textContent=mode==='check'?'Пришлите шаблон трудового договора без данных сотрудника: Word, PDF или фото.':'Фото или скан трудовых договоров, можно несколько сразу.';
  $('#upFiles').accept=mode==='check'?'image/*,application/pdf,.doc,.docx':'image/*,application/pdf';
  open('#dUp');
}
function gotFiles(fl){
  const f=[...fl].slice(0,30);if(!f.length)return;
  $('#upList').innerHTML=f.map(x=>`<div><span>${esc(x.name)}</span><small>${(x.size/1024/1024).toFixed(1)} МБ</small></div>`).join('');
  const n=$('#upNote');n.hidden=false;
  if(upMode==='check'){n.textContent='Файл выбран. Проверку подключим вместе с сервером: результат придёт на почту из регистрации.';}
  else{n.textContent='Распознавание договоров подключим вместе с сервером: заберём ФИО, должность, оклад и даты. Пока можно внести сотрудника вручную по договору.';$('#upManual').hidden=false;}
}
$('#upFiles').addEventListener('change',e=>gotFiles(e.target.files));
const drop=$('#drop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');gotFiles(e.dataTransfer.files);});
$$('dialog').forEach(dl=>dl.addEventListener('click',e=>{if(e.target===dl)dl.close();}));

render();
const hash=location.hash.slice(1);
const m=hash.match(/^c=([a-z0-9]+)(?:&tab=(\w+))?/);
if(m)setTimeout(()=>openCard(m[1],m[2]),100);
else if(['add','fire','upload','check','bulk'].includes(hash))setTimeout(()=>want(hash),200);
})();
