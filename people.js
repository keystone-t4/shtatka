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
  $('#empty').hidden=!none;$('#kpis').hidden=none;$('#vt').hidden=none;
  $('#list').hidden=none||view!=='list';$('#org').hidden=none||view!=='tree';if(!none&&view==='tree')renderOrg();
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
    {const so=DZ.soon(x,30);so.forEach(y=>tags.push(`<span class="pill ${y.expired?'crit':'warn'}">${esc(DZ.SHORT[y.k]||y.t)} ${y.expired?'просрочен':'до '+d.fmt(y.until)}</span>`));
     const pr=DZ.progress(x);if(pr.missing.length)tags.push(`<span class="pill warn">документы: ${pr.done}/${pr.total}</span>`);}
    if(x.contract==='self'){const ok=x.npd&&x.npd.status&&d.diff(x.npd.checkedAt.slice(0,10),d.today())<=30;tags.push(`<span class="pill ${ok?'info':'warn'}">${ok?'самозанятый ✓':'проверить НПД'}</span>`);}
    const open=x.tasks.filter(t=>!t.done).length;if(open)tags.push(`<span class="pill ${x.tasks.some(t=>!t.done&&t.due<d.today())?'crit':'warn'}">задач: ${open}</span>`);
    return `<div class="er" data-card="${x.id}" role="button" tabindex="0"><span class="av">${esc(((p[0]||'')[0]||'')+((p[1]||'')[0]||''))}</span>
     <div><b>${esc(x.fio)}</b><small>${esc(x.position||'')}${u?' · '+esc(u.name):''}</small></div>
     <div class="hide-m"><small>${esc(R.CONTRACT[x.contract]||'')} · с ${d.fmt(x.start)}</small></div>
     <div class="tags">${tags.join('')}${x.out?'':(()=>{const s=cabSt(x);return s.k==='in'?'<span class="pill ok">в Штатке</span>':s.k==='wait'?`<button type="button" class="pill info inv-p" data-invcab="${x.id}" title="Отправить заново">приглашён до ${fmtExp(s.exp)}</button>`:s.k==='old'?`<button type="button" class="pill warn inv-p" data-invcab="${x.id}">приглашение истекло: повторить</button>`:`<button type="button" class="b inv-b" data-invcab="${x.id}">Пригласить</button>`;})()}</div></div>`;}).join('');
}
const cabSt=x=>{const c=x.cab;if(!c)return {k:'none'};if(c.joinedAt)return {k:'in'};const exp=c.expAt||(c.at?new Date(c.at+'T23:59:59').getTime()+6*864e5:0);return Date.now()>exp?{k:'old',exp}:{k:'wait',exp};};
const fmtExp=ms=>{const z=new Date(ms);return String(z.getDate()).padStart(2,'0')+'.'+String(z.getMonth()+1).padStart(2,'0');};
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

/* ---------- приём: шаг 1 «Человек» (паспорт по фото или вручную), шаг 2 «Договор» ---------- */
const PP=window.SHTATKA_PASSPORT;
let step=1,mode='hire',auto=new Set(),npdForm=null,pend=[];
const DZ=window.SHTATKA_DOSSIER,JB=window.SHTATKA_JOBS;
let ans={},modeTouched=false;
const LAB=c=>c==='open'||c==='fixed';
const fioOf=()=>[$('#eSur').value,$('#eName').value,$('#eMid').value].map(x=>x.trim()).filter(Boolean).join(' ');
const passParts=()=>{const n=$('#ePass').value.replace(/\D/g,'');return {series:n.slice(0,4),number:n.slice(4,10)};};
function personData(){
  const reg=$('#eReg').value,ru=reg==='ru',pp=passParts();
  return {fio:fioOf(),surname:$('#eSur').value.trim(),name:$('#eName').value.trim(),middle:$('#eMid').value.trim(),sex,birth:$('#eBirth').value,birthPlace:$('#eBPlace').value.trim(),
    regime:reg,country:ru?'Россия':($('#eCountry').value.trim()||''),permitNo:$('#ePermit').value.trim(),permitUntil:$('#ePermitUntil').value,
    passport:{series:pp.series,number:pp.number,issueDate:$('#ePassDate').value,issuedBy:$('#ePassBy').value.trim(),code:$('#ePassCode').value.trim()},
    regAddress:$('#eAddr').value.trim(),regDate:$('#eAddrDate').value,phone:$('#ePhone').value.trim(),email:$('#eEmail').value.trim(),snils:$('#eSnils').value.trim(),innP:$('#eInnP').value.replace(/\D/g,''),
    milCat:$('#eMilCat').value,fit:$('#eFit').value,hasVus:$('#eVus').checked};
}
function workData(){
  const c=$('#eCon').value;
  return {position:$('#ePos').value.trim(),contract:c,salary:+$('#eSal').value||0,rate:LAB(c)?+$('#eRate').value||1:1,start:$('#eStart').value||d.today(),
    contractEnd:c==='fixed'?$('#eEnd').value:'',fixedWhy:c==='fixed'?$('#eFixedWhy').value:'',probation:LAB(c)?+$('#eProb').value:0,workMode:$('#eMode').value,
    answers:Object.assign({},ans),unit:$('#eUnit').value,managerId:$('#eBoss').value||'',workPlace:$('#ePlace').value.trim(),remote:$('#eRemote').checked,
    npd:npdForm,patentNotice:$('#ePatN').checked,patentAdv:+$('#ePatA').value||0,gphInjury:$('#eGphInj').checked,contractAt:d.today()};
}
const formData=()=>Object.assign(personData(),workData(),{existing:kind==='existing'});
function boxes(){
  const reg=$('#eReg').value,ru=reg==='ru',c=$('#eCon').value,lab=LAB(c);
  $('#boxFor').hidden=ru;$('.pp').hidden=!ru;$('#ppFor').hidden=ru;
  $('#boxMil').hidden=!ru;
  $('#eVusW').hidden=sex!=='f';
  if(sex==='f'){const v=$('#eVus').checked;$('#eMilCat').closest('.fld').hidden=!v;$('#eFit').closest('.fld').hidden=!v;}
  else{$('#eMilCat').closest('.fld').hidden=false;$('#eFit').closest('.fld').hidden=false;}
  $('#eFixedW').hidden=c!=='fixed';
  $$('#st2 [data-lab]').forEach(x=>x.hidden=!lab);
  $('#ePatW').hidden=reg!=='patent';$('#eGphW').hidden=c!=='gph';$('#eSelfW').hidden=c!=='self';
  const ip=$('#eInnP').value.replace(/\D/g,'');$('#eSelfInn').textContent=ip||'не указан на шаге 1';
  $('#eSalL').textContent={gph:'Вознаграждение, ₽ в месяц',self:'Оплата, ₽ в месяц',rent:'Арендная плата, ₽ в месяц'}[c]||'Оклад, ₽ в месяц';
  $('#eStartL').textContent=kind==='existing'?'Работает с':(lab?'Дата выхода':'Дата начала');
}
function passStale(birth,issue){if(!birth||!issue)return '';const a=R.age(birth),ai=R.age(birth,issue);
  for(const lim of [20,45])if(a!=null&&ai!=null&&a>=lim&&ai<lim){const due=d.addDays(birth.replace(/^\d{4}/,y=>String(+y+lim)),90);return due<d.today()?'паспорт просрочен: в '+lim+' лет его нужно было заменить до '+d.fmt(due)+'. Попросите новый':'паспорт нужно заменить до '+d.fmt(due)+' ('+lim+' лет)';}
  return '';}
/* подсказка: какие документы нужны на этой работе. Сфера компании — из ОКВЭД, шаблона главной или ответа владельца */
function advHtml(f){
  const ind=JB.industry(),age=R.age($('#eBirth').value,f.start);
  const A=JB.advise({industry:ind.id,position:f.position,remote:f.remote,age,answers:ans});
  const names={med:'Медкнижка и медосмотр',drv:'Водительское удостоверение',edu:'Диплом или удостоверение',crim:'Справка о несудимости',drug:'Справка о наркотиках'};
  const rows=Object.entries(A.items).map(([k,x])=>{
    if(x.need==='ask')return `<div class="adv-q"><b>${esc(names[k]||k)}: нужен ответ</b><span>${esc(x.q.text)}</span>${x.q.key==='industry'?'':`<div><button type="button" class="b" data-ans="${x.q.key}:true">Да</button><button type="button" class="b" data-ans="${x.q.key}:false">Нет</button></div>`}</div>`;
    return `<div class="adv-r ${x.need?'yes':'no'}"><i>${x.need?'✓':'—'}</i><span><b>${esc(names[k]||k)}: ${x.need?'нужна':'не нужна'}</b><small>${esc(x.why)}</small></span></div>`;}).join('');
  const shifts=JB.needsShifts(ind.id,f.position,f.remote)?`<div class="adv-r yes"><i>🗓</i><span><b>График смен важен</b><small>В этой сфере всем нужно знать, кто и когда на работе. Задайте график в разделе «Время» после приёма.</small></span></div>`:'';
  return `<b>Подсказка по документам и графику</b>${f.position?(rows||(ind.id?'<div class="adv-r no"><i>—</i><span><b>Особых документов не нужно</b><small>Достаточно базовых: паспорт, СНИЛС, трудовая или СТД.</small></span></div>':'')):'<small class="muted">Введите должность — подскажем, какие документы нужны именно ей.</small>'}${shifts}`;
}
function preview(){
  if(step!==2)return;
  {const ind=JB.industry();$('#posList').innerHTML=(JB.POS[ind.id]||[]).map(x=>`<option value="${esc(x)}">`).join('');
   if(!modeTouched&&JB.needsShifts(ind.id,$('#ePos').value,$('#eRemote').checked)&&$('#eMode').value==='5/2')$('#eMode').value='shift';
   const si=$('#eInd');if(!si.options.length)si.innerHTML='<option value="">Выберите…</option>'+Object.entries(JB.IND).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
   si.value=ind.id;$('#eIndSrc').textContent=ind.src?'('+ind.src+')':'';
   {const h=advHtml(workData()),box=$('#eAdv');if(box.dataset.h!==h){box.innerHTML=h;box.dataset.h=h;}}}
  const f=formData(),tmp=Object.assign({id:'x',prev:[],tasks:[],sick:[],etk:{}},f),lab=LAB(f.contract);
  const rows=[];
  if(mode==='contract')rows.push(['Договор','обновим условия в карточке и откроем черновик']);
  else{rows.push(['Люди','попадёт в штат']);rows.push(['Документы',lab?'договор, приказ Т-1, согласие, карточка Т-2':'договор '+(R.CONTRACT[f.contract]||'').toLowerCase()]);
    if(lab)rows.push(['Трудовая книжка','ЕФС-1 о приёме до '+d.fmt(d.nextWork(f.start))]);}
  const b=R.get(f.managerId);if(b)rows.push(['Руководитель',b.fio+(b.position?', '+b.position:'')]);
  if(b&&(f.contract==='self'||f.contract==='gph'))rows.push(['Риск','подчинение руководителю — признак трудовых отношений: по ГПХ и с самозанятым его лучше не указывать (ст. 15, 19.1 ТК)']);
  if(f.salary){const P=window.SHTATKA_PAYROLL;
    rows.push(['Платежи',f.contract==='self'?'НДФЛ и взносов нет: самозанятый платит налог сам, проверяйте чек':f.contract==='rent'?'только НДФЛ 13 %: аренда взносами не облагается':f.regime==='hqs'?'НДФЛ; взносов нет (ВКС), травматизм — да':'НДФЛ, взносы'+(f.contract==='gph'&&!f.gphInjury?' (без травматизма)':', травматизм')]);
    if(lab&&f.salary<R.mrotNow()*(f.rate||1))rows.push(['МРОТ','оклад ниже МРОТ '+R.mrotNow().toLocaleString('ru-RU')+' ₽'+(f.rate<1?' × ставка':'')+': доплатите до минимума']);}
  if(f.regime!=='ru'&&mode!=='contract')rows.push(['Иностранцы','уведомление в МВД до '+d.fmt(d.addWork(f.start,3))]);
  else if(mode!=='contract'){const m=R.mil(tmp,f.start);if(m.st==='in')rows.push(['Воинский учёт','сведения в военкомат до '+d.fmt(d.addWork(f.start,5))]);else if(m.st==='check')rows.push(['Воинский учёт','уточнить: '+m.why]);}
  if(f.contract==='fixed'&&!f.contractEnd)rows.push(['Внимание','у срочного договора нужна дата окончания']);
  const ps=f.regime==='ru'?passStale(f.birth,f.passport.issueDate):'';if(ps)rows.push(['Паспорт',ps]);
  $('#ePrev').innerHTML='<b>Что произойдёт</b>'+rows.map(r=>`<div><span>${esc(r[0])}</span><i>${esc(r[1])}</i></div>`).join('');
}
function goStep(n){
  step=n;$('#st1').hidden=n!==1;$('#st2').hidden=n!==2;$('#ft1').hidden=n!==1;$('#ft2').hidden=n!==2;
  $$('#wz li').forEach(li=>{if(+li.dataset.s===n)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  $('#eErr').hidden=true;
  if(n===2){const p=personData();$('#eWho').innerHTML=`<b>${esc(p.fio||'Без имени')}</b>${p.birth?' · '+d.fmt(p.birth):''}${p.passport.series?' · паспорт '+esc(p.passport.series+' '+p.passport.number):''}`;preview();if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>$('#ePos').focus({preventScroll:true}),30);}
  else if(!matchMedia('(pointer:coarse)').matches&&mode!=='hire')setTimeout(()=>$('#eSur').focus({preventScroll:true}),30);
  $('#'+(n===1?'st1':'st2')).scrollTop=0;
}
function bossList(selfId,sel){
  $('#eBoss').innerHTML='<option value="">Нет: подчиняется руководителю компании</option>'+R.bossOptions(selfId).map(x=>`<option value="${x.id}"${x.id===sel?' selected':''}>${esc(x.fio)}${x.position?' — '+esc(x.position):''}</option>`).join('');
}
function resetForm(){
  $('#fAdd').querySelectorAll('input').forEach(i=>{if(i.type==='checkbox')i.checked=false;else if(i.type!=='file')i.value='';});
  $('#eReg').value='ru';$('#eCon').value='open';$('#eRate').value='1';$('#eProb').value='0';
  const qm=(H.state().company||{}).mode;if(qm)$('#eMode').value=qm;
  pend=[];ans={};modeTouched=false;$('#eKeep').checked=true;
  ['main','reg','snils'].forEach(k=>{$('#upSt_'+k).textContent='';$('#upImg_'+k).classList.remove('has');const im=$('#upImg_'+k).querySelector('img');if(im)im.remove();});
  npdForm=null;$('#eSelfSt').className='up-st';$('#eSelfSt').textContent='Статус проверяют перед договором и перед каждой выплатой.';
  auto.clear();$$('#fAdd .auto').forEach(x=>x.classList.remove('auto'));
  sex='m';$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sex==='m'));
}
function openAdd(k){
  mode='hire';kind=k;resetForm();$$('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===k));
  $('#dAddT').textContent='Принять сотрудника';$('#wz').hidden=false;$('#toSt1').hidden=false;$('#eSubmit').textContent=k==='existing'?'Внести и создать договор':'Принять и создать договор';
  $('#eUnit').innerHTML='<option value="">Без подразделения</option>'+H.units().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  $('#eUnitW').hidden=!H.units().length;bossList(null,'');
  $('#eStart').value=d.today();
  boxes();goStep(1);open('#dAdd');
}
/* «Создать договор» из карточки: только шаг 2, данные человека уже есть */
function openContract(id){
  const e=R.get(id);if(!e)return;mode='contract';cur=id;
  resetForm();ans=Object.assign({},e.answers||{});const sp=(e.fio||'').split(/\s+/);
  $('#eSur').value=e.surname||sp[0]||'';$('#eName').value=e.name||sp[1]||'';$('#eMid').value=e.middle||sp.slice(2).join(' ');
  $('#eBirth').value=e.birth||'';$('#eReg').value=e.regime||'ru';sex=e.sex||'m';
  const pp=e.passport||{};$('#ePass').value=pp.series?pp.series+' '+pp.number:'';
  $('#ePos').value=e.position||'';$('#eCon').value=e.contract||'open';$('#eSal').value=e.salary||'';$('#eRate').value=String(e.rate||1);
  $('#eStart').value=e.start||d.today();$('#eEnd').value=e.contractEnd||'';if(e.fixedWhy)$('#eFixedWhy').value=e.fixedWhy;
  $('#eProb').value=String(e.probation||0);if(e.workMode)$('#eMode').value=e.workMode;$('#ePlace').value=e.workPlace||'';$('#eRemote').checked=!!e.remote;
  $('#eInnP').value=e.innP||'';npdForm=e.npd||null;if(e.npd)npdShow($('#eSelfSt'),e.npd);
  $('#ePatN').checked=!!e.patentNotice;$('#ePatA').value=e.patentAdv||'';$('#eGphInj').checked=!!e.gphInjury;
  $('#eUnit').innerHTML='<option value="">Без подразделения</option>'+H.units().map(u=>`<option value="${u.id}"${u.id===e.unit?' selected':''}>${esc(u.name)}</option>`).join('');
  $('#eUnitW').hidden=!H.units().length;bossList(id,e.managerId||'');
  $('#dAddT').textContent='Договор: '+e.fio;$('#wz').hidden=true;$('#toSt1').hidden=true;$('#eSubmit').textContent='Сохранить и открыть договор';
  close($('#dCard'));boxes();goStep(2);open('#dAdd');
}
function check1(){const f=personData();
  if(!f.surname||!f.name)return 'Напишите фамилию и имя.';
  if(!f.birth)return 'Укажите дату рождения: по ней определяем воинский учёт и условия труда.';
  if(f.regime==='ru'&&f.passport.series&&(f.passport.series+f.passport.number).length!==10)return 'Серия и номер паспорта РФ — 10 цифр.';
  if(f.regime!=='ru'&&f.regime!=='eaeu'&&!f.permitUntil)return 'Укажите, до какого числа действует документ на работу.';
  if(f.innP&&!(window.SHTATKA_COMPANY&&window.SHTATKA_COMPANY.innOk(f.innP)&&f.innP.length===12))return 'ИНН человека — 12 цифр, в этих ошибка. Проверьте или оставьте пустым.';
  if(f.snils&&!PP.snilsOk(f.snils))return 'СНИЛС: в номере ошибка (не сходится контрольное число). Проверьте 11 цифр.';
  return '';}
function check2(){const f=workData();
  if(f.contract==='self'&&!$('#eInnP').value.replace(/\D/g,''))return 'Для договора с самозанятым нужен его ИНН: вернитесь на шаг 1.';
  if(f.contract==='self'&&npdForm&&npdForm.status===false)return 'По данным ФНС человек не самозанятый. Договор с самозанятым заключать нельзя: выберите ГПХ или трудовой.';
  if(!f.position)return 'Укажите должность или предмет договора.';
  if(f.contract==='fixed'&&!f.contractEnd)return 'Укажите дату окончания срочного договора.';
  if(f.contract==='fixed'&&f.contractEnd<=f.start)return 'Дата окончания должна быть позже даты начала.';
  const age=R.age($('#eBirth').value,f.start);
  if(f.probation&&age!=null&&age<18)return 'Работнику младше 18 лет испытательный срок не устанавливается (ст. 70 ТК).';
  if(f.probation&&f.contract==='fixed'&&R.d.diff(f.start,f.contractEnd)<=62)return 'По срочному договору до 2 месяцев испытание — не больше 2 недель: выберите «Без испытательного срока» и пропишите 2 недели в договоре.';
  return '';}
const err=t=>{$('#eErr').hidden=!t;$('#eErr').textContent=t||'';if(t)$('#eErr').scrollIntoView({block:'nearest'});};
$('#toSt2').addEventListener('click',()=>{const e1=check1();if(e1)return err(e1);goStep(2);});
$('#toSt1').addEventListener('click',()=>goStep(1));
$('#fAdd').addEventListener('click',e=>{const b=e.target.closest('[data-ans]');if(!b)return;const [k,v]=b.dataset.ans.split(':');ans[k]=v==='true';preview();});
$('#fAdd').addEventListener('change',e=>{if(e.target.id==='eInd'){H.state().company.industry=e.target.value;H.persist();preview();}if(e.target.id==='eMode')modeTouched=true;});
$('#fAdd').addEventListener('input',e=>{if(e.target.id==='eInd')return;if(e.target.classList.contains('auto'))e.target.classList.remove('auto');boxes();preview();});
$('#fAdd').addEventListener('change',e=>{if(e.target.id==='eInd')return;boxes();preview();});
$('#fAdd').addEventListener('click',e=>{const b=e.target.closest('[data-sex]');if(!b)return;sex=b.dataset.sex;$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x===b));boxes();preview();});
/* маски: паспорт 0000 000000, код 000-000, СНИЛС 000-000-000 00 */
$('#ePass').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,10);e.target.value=n.length>4?n.slice(0,4)+' '+n.slice(4):n;});
$('#ePassCode').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,6);e.target.value=n.length>3?n.slice(0,3)+'-'+n.slice(3):n;});
$('#eSnils').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=[n.slice(0,3),n.slice(3,6),n.slice(6,9)].filter(Boolean).join('-')+(n.length>9?' '+n.slice(9):'');});
$('#fAdd').addEventListener('submit',e=>{
  e.preventDefault();const e2=check2();if(e2)return err(e2);
  const w=workData();
  if(mode==='contract'){const x=R.get(cur);if(!x.contractNo)w.contractNo=R.nextNo();R.update(cur,w);R.save();close($('#dAdd'));render();openCard(cur,'docs');showDoc(x,DOCKEY(x));toast('Условия договора сохранены. Черновик открыт: проверьте и распечатайте.');return;}
  const e1=check1();if(e1){goStep(1);return err(e1);}
  const f=formData();if(f.regime==='ru')f.country='Россия';
  f.contractNo=R.nextNo();const x=R.hire(f);
  if(window.__akFid){dropInbox(window.__akFid);window.__akFid=null;}
  if($('#eKeep').checked&&pend.length)saveCopies(x.id,pend.slice());
  close($('#dAdd'));render();openCard(x.id,'docs');showDoc(x,DOCKEY(x));
  const n=[];if(f.regime!=='ru')n.push('иностранцы');else if(['in','check'].includes(R.mil(x).st))n.push('воинский учёт');
  toast('Карточка создана, черновик договора открыт. Сроки уже в работе: документы'+(f.salary?', зарплата':'')+(n.length?', '+n.join(', '):'')+'.');
});
/* паспорт по фото */
if(!matchMedia('(pointer:coarse)').matches){$$('.up .cam').forEach(x=>x.hidden=true);$$('.up label.b:not(.cam)').forEach(l=>{if(l.firstChild&&l.firstChild.nodeType===3)l.firstChild.nodeValue='Выбрать файл';});}
const FIELD={snils:'#eSnils',surname:'#eSur',name:'#eName',middle:'#eMid',birth:'#eBirth',birthPlace:'#eBPlace',issueDate:'#ePassDate',issuedBy:'#ePassBy',code:'#ePassCode',address:'#eAddr',regDate:'#eAddrDate'};
function applyFields(f){
  let n=0;const put=(sel,v)=>{if(!v)return;const el=$(sel);el.value=v;el.classList.add('auto');n++;};
  Object.entries(FIELD).forEach(([k,s])=>put(s,f[k]));
  if(f.series||f.number){put('#ePass',(f.series||'')+(f.number?' '+f.number:''));}
  if(f.sex){sex=f.sex;$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sex===sex));n++;}
  if(f.citizenship&&!/росс/i.test(f.citizenship)){$('#eReg').value='rvp';$('#eCountry').value=f.citizenship;}
  boxes();return n;
}
$('#fAdd').addEventListener('change',async e=>{
  const inp=e.target.closest('[data-file]');if(!inp||!inp.files||!inp.files[0])return;
  const k=inp.dataset.file,st=$('#upSt_'+k),box=$('#upImg_'+k),file=inp.files[0];inp.value='';
  st.className='up-st';st.textContent='Готовим файл…';
  let prep;try{prep=await PP.prepare(file);}catch(x){prep={error:'Не удалось прочитать файл.'};}
  if(prep.error){st.className='up-st bad';st.textContent=prep.error;return;}
  const old=box.querySelector('img');if(old)old.remove();
  if(prep.blob)pend.push({k:k==='snils'?'snils':'passport',blob:prep.blob,name:({main:'Паспорт, разворот',reg:'Паспорт, прописка',snils:'СНИЛС'})[k]+(prep.pdf?'.pdf':'.jpg')});
  if(prep.preview){const im=new Image();im.src=prep.preview;im.alt='';box.appendChild(im);box.classList.add('has');}else{box.classList.add('has','pdf');}
  st.textContent='Распознаём…';
  const r=await PP.recognize(k,prep);prep.content=null;
  if(!r.ok){st.className='up-st bad';st.textContent=PP.REASON[r.reason]||PP.REASON.offline;return;}
  const n=applyFields(r.fields||{});
  st.className='up-st '+(n?'ok':'bad');
  st.textContent=r.demo?'Демо: подставлен пример, сервер распознавания не подключён':n?'Заполнено полей: '+n+'. Проверьте подсвеченные':'Данных не нашли: снимите ровнее или введите вручную';
});
const DOCKEY=e=>({gph:'gph',rent:'rent',self:'self'}[e.contract]||'td');
async function saveCopies(id,list){const e=R.get(id);if(!e)return;const ds=Object.assign({},e.dossier||{});
  for(const p of list){try{const m=await DZ.putFile(p.blob,p.name);const c=ds[p.k]||{files:[]};c.files=(c.files||[]).concat(m);c.state='copy';c.at=d.today();if(p.until)c.until=p.until;ds[p.k]=c;}catch(x){}}
  R.update(id,{dossier:ds});R.save();if(cur===id&&tab==='dossier')paintCard();}
function showDoc(e,key){const x=R.docsFor(e).find(y=>y[0]===key);if(!x)return;$('#dDocT').textContent=x[1];$('#docBody').innerHTML=R.docHtml(e,key);open('#dDoc');}

/* ---------- самозанятые: статус в ФНС ---------- */
const NPD_RU={demo:'Проверка заработает после подключения сервера. Сейчас проверьте вручную: npd.nalog.ru/check-status',busy:'ФНС принимает 2 запроса в минуту. Повторите через минуту.',offline:'ФНС не ответила. Повторите позже или проверьте на npd.nalog.ru/check-status.',bad_inn:'Проверьте ИНН: у физлица 12 цифр.'};
function npdShow(el,v){el.className='up-st '+(v.status?'ok':'bad');el.textContent=(v.status?'Самозанятый':'Не самозанятый')+' по данным ФНС на '+d.fmt(v.checkedAt.slice(0,10));}
async function npdRun(inn,el){
  el.className='up-st';el.textContent='Спрашиваем ФНС… это может занять до минуты';
  const r=await window.SHTATKA_COMPANY.npdCheck(inn);
  if(!r.ok){el.className='up-st bad';el.textContent=NPD_RU[r.reason]||NPD_RU.offline;return null;}
  const v={status:r.status,checkedAt:r.checkedAt||new Date().toISOString(),message:r.message||''};npdShow(el,v);return v;
}
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-npd]');if(!b)return;b.disabled=true;
  try{if(b.dataset.npd==='form'){const v=await npdRun($('#eInnP').value,$('#eSelfSt'));if(v)npdForm=v;}
  else{const e=R.get(b.dataset.npd);const v=await npdRun(e&&e.innP,$('#cNpdSt'));if(v){R.update(e.id,{npd:v});R.save();render();}}}
  finally{b.disabled=false;}});

/* ---------- выгрузка для 1С ---------- */
function csv(name,head,rows){const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const t='\ufeff'+[head,...rows].map(r=>r.map(q).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();}
$('#exp1c').addEventListener('click',()=>{
  const all=R.active();if(!all.length){toast('Сотрудников пока нет.');return;}
  const D_=x=>x?d.fmt(x):'',units=H.units(),sp=e=>(e.fio||'').split(/\s+/);
  csv('sotrudniki-1c-'+d.today()+'.csv',
   ['Табельный номер','Фамилия','Имя','Отчество','Пол','Дата рождения','Место рождения','Гражданство','ИНН','СНИЛС','Вид документа','Серия','Номер','Дата выдачи','Кем выдан','Код подразделения','Адрес регистрации','Телефон','Должность','Подразделение','Вид договора','Дата приёма','Дата окончания договора','Ставка','Оклад','Испытательный срок, мес.','Руководитель','Дистанционно','Документ на работу','Действует до'],
   all.map((e,i)=>{const pp=e.passport||{},b=R.boss(e),u=units.find(x=>x.id===e.unit);
     return [String(i+1).padStart(4,'0'),e.surname||sp(e)[0],e.name||sp(e)[1],e.middle||sp(e).slice(2).join(' '),e.sex==='f'?'Женский':'Мужской',D_(e.birth),e.birthPlace||'',e.country||'Россия',e.innP||'',e.snils||'',
       e.regime==='ru'?'Паспорт гражданина РФ':'Паспорт иностранного гражданина',pp.series||'',pp.number||'',D_(pp.issueDate),pp.issuedBy||'',pp.code||'',e.regAddress||'',e.phone||'',
       e.position||'',u?u.name:'',R.CONTRACT[e.contract]||'',D_(e.start),D_(e.contractEnd),String(e.rate||1).replace('.',','),e.salary||'',e.probation||0,b?b.fio:'',e.remote?'да':'нет',e.permitNo||'',D_(e.permitUntil)];}));
  toast('Файл для 1С скачан: CSV, разделитель «;», даты ДД.ММ.ГГГГ. Загрузите обработкой «из Excel» в ЗУП.');
});

/* список для заказчика или генподрядчика: кто, где, допуски и сроки документов — без паспортов и адресов */
$('#expObj').addEventListener('click',()=>{
  const all=R.active();if(!all.length){toast('Сотрудников пока нет.');return;}
  const units=H.units();
  const till=(e,k)=>{const it=DZ.items(e).find(y=>y.k===k);if(!it||it.need==='off')return '—';return it.until?(it.expired?'просрочено ':'до ')+d.fmt(it.until):(it.state!=='none'?'есть':'нет');};
  csv('spisok-dlya-zakazchika-'+d.today()+'.csv',['Подразделение / объект','ФИО','Должность','Гражданство','Документ на работу до','Медкнижка','Права','Удостоверение о квалификации','Личное дело'],
   all.map(e=>{const un=units.find(x=>x.id===e.unit),pr=DZ.progress(e);return [un?un.name:'',e.fio,e.position||'',e.country||'Россия',e.permitUntil?d.fmt(e.permitUntil):(e.regime==='ru'?'не нужен':''),till(e,'med'),till(e,'drv'),till(e,'edu'),pr.done+' из '+pr.total];}));
  toast('Список скачан: без паспортных данных и адресов — их заказчику передавать не нужно.');
});

/* ---------- анкета по ссылке: приглашение, входящие, перенос данных ---------- */
const b64=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let invAns={},invEmp=null;
const FOREIGN_NEED={patent:['fpass','patent','migcard','reg'],permit:['fpass','permit','migcard','reg'],rvp:['fpass','rvp'],eaeu:['fpass','migcard'],hqs:['fpass','permit','dms','migcard','reg']};
function invData(){
  const pos=$('#iPos').value.trim(),reg=$('#iReg').value,remote=$('#iRem').checked,ind=JB.industry();
  const A=JB.advise({industry:ind.id,position:pos,remote,age:null,answers:invAns}),need=[];
  if(reg!=='ru')need.push(...FOREIGN_NEED[reg]);else need.push('etk','mil');
  Object.entries(A.items).forEach(([k,x])=>{if(x.need===true&&!need.includes(k))need.push(k);});
  return {A,need,pos,reg,ind};
}
function invPaint(){
  const {A,need,pos,reg,ind}=invData();
  $('#posList2').innerHTML=(JB.POS[ind.id]||[]).map(x=>`<option value="${esc(x)}">`).join('');
  const names={med:'Медкнижка',drv:'Водительское удостоверение',edu:'Диплом или удостоверение',crim:'Справка о несудимости',drug:'Справка о наркотиках'};
  const q=Object.entries(A.items).filter(([k,x])=>x.need==='ask'&&x.q.key!=='industry');
  const noInd=!ind.id&&pos&&reg==='ru';
  $('#iAdv').innerHTML='<b>Что попросим у человека</b>'+
   (noInd?'<div class="adv-q"><span>Сначала выберите сферу компании в окне приёма или в карточке, чтобы подсказать про медкнижку.</span></div>':'')+
   q.map(([k,x])=>`<div class="adv-q"><span>${esc(x.q.text)}</span><div><button type="button" class="b" data-ians="${x.q.key}:true">Да</button><button type="button" class="b" data-ians="${x.q.key}:false">Нет</button></div></div>`).join('')+
   `<div class="adv-r yes"><i>✓</i><span><b>Паспорт${reg==='ru'?' и прописка':', данные и фото'}, СНИЛС, контакты</b><small>обязательно для всех</small></span></div>`+
   need.map(k=>`<div class="adv-r yes"><i>✓</i><span><b>${esc(({etk:'Трудовая книжка или СТД',mil:'Военный билет (если военнообязанный)',fpass:'Национальный паспорт',patent:'Патент',permit:'Разрешение на работу',rvp:'РВП или ВНЖ',migcard:'Миграционная карта',reg:'Уведомление о прибытии',dms:'Полис ДМС'}[k])||names[k]||k)}</b></span></span></div>`).join('');
  const inv={v:1,id:Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10),exp:d.addDays(d.today(),7),org:(H.session()||{}).company||'',pos,first:$('#iFirst').value.trim(),foreign:reg!=='ru',reg,need,emp:invEmp};
  const base=location.origin+location.pathname.replace(/[^/]*$/,'');
  $('#iLink').value=cfg.apiUrl?'Ссылку создаст сервер после подключения':base+'anketa.html#i='+b64(inv);
  $('#iLink').dataset.url=cfg.apiUrl?'':$('#iLink').value;
}
function openInvite(emp){
  invAns={};invEmp=emp?emp.id:null;
  $('#iFirst').value=emp?(emp.name||(emp.fio||'').split(' ')[1]||''):'';$('#iPos').value=emp?emp.position||'':'';
  $('#iReg').value=emp?emp.regime||'ru':'ru';$('#iRem').checked=!!(emp&&emp.remote);
  invPaint();close($('#dCard'));open('#dInv');
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-invite],[data-ians],#iCopy,#iShare');if(!t)return;
  if(t.dataset.invite){if(!canEdit()){want('add');return;}openInvite(t.dataset.invite==='new'?null:R.get(t.dataset.invite));return;}
  if(t.dataset.ians){const [k,v]=t.dataset.ians.split(':');invAns[k]=v==='true';invPaint();return;}
  if(t.id==='iCopy'){const u=$('#iLink').dataset.url;if(!u){toast('Ссылку создаст сервер после подключения.');return;}(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>toast('Ссылка скопирована. Отправьте её человеку в мессенджере.')).catch(()=>{$('#iLink').select();toast('Скопируйте ссылку вручную.');});return;}
  if(t.id==='iShare'){const u=$('#iLink').dataset.url;if(!u){toast('Ссылку создаст сервер после подключения.');return;}const org=(H.session()||{}).company||'работодатель';
    if(navigator.share)navigator.share({title:'Анкета для оформления',text:org+' просит заполнить анкету для оформления на работу. Это 5–7 минут.',url:u}).catch(()=>{});
    else $('#iCopy').click();return;}
});
$('#fInv').addEventListener('input',()=>invPaint());$('#fInv').addEventListener('change',()=>invPaint());
/* входящие */
async function readFileJson(fid){const f=await DZ.getFile(fid);if(!f)return null;return JSON.parse(await f.blob.text());}
function inboxList(){try{return JSON.parse(localStorage.getItem('shtatka-anketa-inbox')||'[]');}catch(e){return[];}}
function paintInbox(){const l=inboxList(),box=$('#inbox');box.hidden=!l.length;
  box.innerHTML=l.length?`<b>Пришли анкеты: ${l.length}</b>`+l.map(x=>`<div><span>${esc(x.name)} · ${new Date(x.at).toLocaleDateString('ru-RU')}</span><button type="button" class="b d" data-ak="${x.fid}">Открыть</button><button type="button" class="b" data-akdel="${x.fid}" aria-label="Удалить">×</button></div>`).join(''):'';}
const b2blob=(b64s,mime)=>{const bin=atob(b64s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime||'image/jpeg'});};
const KEYMAP={main:'passport',reg:'passport'};
function applyAnketa(p,fid){
  const x=p.person||{};if(p.empId&&R.get(p.empId)){
    const e=R.get(p.empId),patch={},ds=Object.assign({},e.dossier||{});
    const set=(k,v)=>{if(v)patch[k]=v;};set('surname',x.surname);set('name',x.name);set('middle',x.middle);set('birth',x.birth);set('birthPlace',x.birthPlace);set('regAddress',x.regAddress);set('regDate',x.regDate);set('phone',x.phone);set('email',x.email);set('snils',x.snils);set('innP',x.innP);if(x.sex)patch.sex=x.sex;
    if(x.series)patch.passport={series:x.series,number:x.number,issueDate:x.issueDate,issuedBy:x.issuedBy,code:x.code};
    if(x.surname&&x.name)patch.fio=[x.surname,x.name,x.middle].filter(Boolean).join(' ');
    Object.entries(p.docs||{}).forEach(([k,v])=>{if(v.state==='none')ds[k]=Object.assign({},ds[k],{state:'none'});if(v.until)ds[k]=Object.assign({},ds[k],{until:v.until});});
    R.update(e.id,Object.assign(patch,{dossier:ds}));R.save();
    const list=[];Object.entries(p.files||{}).forEach(([k,arr])=>arr.forEach(f=>list.push({k:KEYMAP[k]||k,blob:b2blob(f.b64,f.mime),name:f.name})));saveCopies(e.id,list);
    dropInbox(fid);render();openCard(e.id,'dossier');toast('Анкета применена к карточке: '+e.fio+'. Проверьте данные.');return;}
  openAdd('new');
  const setv=(s,v)=>{if(!v)return;const el=$(s);el.value=v;el.classList.add('auto');};
  setv('#eSur',x.surname);setv('#eName',x.name);setv('#eMid',x.middle);setv('#eBirth',x.birth);setv('#eBPlace',x.birthPlace);setv('#ePassDate',x.issueDate);setv('#ePassBy',x.issuedBy);setv('#ePassCode',x.code);setv('#eAddr',x.regAddress);setv('#eAddrDate',x.regDate);setv('#ePhone',x.phone);setv('#eEmail',x.email);setv('#eSnils',x.snils);setv('#eInnP',x.innP);
  if(x.series)setv('#ePass',x.series+' '+x.number);
  if(x.sex){sex=x.sex;$$('[data-sex]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sex===sex));}
  if(p.foreign){$('#eReg').value='patent';setv('#eCountry',x.country);}
  pend=[];Object.entries(p.files||{}).forEach(([k,arr])=>arr.forEach(f=>pend.push({k:KEYMAP[k]||k,blob:b2blob(f.b64,f.mime),name:f.name,until:((p.docs||{})[k]||{}).until||''})));
  window.__akFid=fid;boxes();$('#st1').scrollTop=0;toast('Данные из анкеты подставлены. Проверьте подсвеченные поля и нажмите «Далее».');
}
async function dropInbox(fid){if(!fid)return;localStorage.setItem('shtatka-anketa-inbox',JSON.stringify(inboxList().filter(x=>x.fid!==fid)));await DZ.delFile(fid).catch(()=>{});paintInbox();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-ak],[data-akdel],#akFile');if(!b)return;
  if(b.id==='akFile'){$('#akImport').click();return;}
  if(b.dataset.akdel){await dropInbox(b.dataset.akdel);return;}
  const p=await readFileJson(b.dataset.ak);if(!p){toast('Анкета не найдена на этом устройстве.');return;}
  if(!canEdit()){want('add');return;}applyAnketa(p,b.dataset.ak);});
$('#akImport').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const p=JSON.parse(await f.text());if(p.v!==1||!p.person)throw 0;if(!canEdit()){want('add');return;}applyAnketa(p,null);}catch(x){toast('Это не анкета Штатки. Попросите человека прислать файл снова.');}});
paintInbox();

/* ---------- структура подчинённости ---------- */
let view='list';
function renderOrg(){
  const T=R.tree(),units=H.units();
  const card=e=>{const p=e.fio.split(/\s+/),u=units.find(y=>y.id===e.unit),k=R.reports(e.id).length;
    return `<button type="button" class="on" data-card="${e.id}"><span class="av">${esc(((p[0]||'')[0]||'')+((p[1]||'')[0]||''))}</span><span><b>${esc(p.slice(0,2).join(' '))}</b><small>${esc(e.position||'')}${u?' · '+esc(u.name):''}${k?' · подчинённых: '+k:''}</small></span></button>`;};
  const node=n=>`<li>${card(n.e)}${n.kids.length?`<ul>${n.kids.map(node).join('')}</ul>`:''}</li>`;
  const lone=T.filter(n=>!n.kids.length),tops=T.filter(n=>n.kids.length);
  $('#org').innerHTML=(tops.length?`<ul class="tree">${tops.map(node).join('')}</ul>`:'<p class="muted">Подчинённость не задана. Откройте сотрудника → «Создать договор» или «Данные» и выберите руководителя.</p>')
   +(lone.length?`<div class="bh" style="margin-top:14px"><h2>Без руководителя · ${lone.length}</h2></div><div class="lone">${lone.map(n=>card(n.e)).join('')}</div>`:'');
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-view]');if(!b)return;view=b.dataset.view;
  $$('[data-view]').forEach(x=>x.setAttribute('aria-pressed',x===b));
  $('#list').hidden=view!=='list';$('#org').hidden=view!=='tree';if(view==='tree')renderOrg();});

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
const TABS=e=>[['data','Данные'],['dossier','Личное дело'],['docs','Документы'],['mil','Воинский учёт'],...(R.foreign(e)?[['for','Иностранец']]:[]),['etk','Трудовая и стаж'],...(!e.out?[['cab','Кабинет']]:[]),...(window.SHTATKA_SCH&&!e.out&&(window.SHTATKA_SCH.active()||window.SHTATKA_SCH.inSchedule(e))?[['sch','График']]:[]),['sick','Больничные'],['log','История']];
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
    <div class="fld2">${field('cBirth','Дата рождения',e.birth,'date')}${field('cSal',{gph:'Вознаграждение, ₽',self:'Оплата, ₽',rent:'Арендная плата, ₽'}[e.contract]||'Оклад, ₽',e.salary,'number')}</div>
    <div class="fld2">${field('cStart','Дата приёма',e.start,'date')}${field('cPhone','Телефон',e.phone,'tel')}</div>
    <div class="fld2">${field('cEmail','Электронная почта',e.email,'email')}</div>
    ${R.LABOR(e.contract)?`<div class="fld2"><label class="fld">Условия труда по СОУТ<select id="cSout">${[['','СОУТ не проводилась'],['1','Класс 1 — оптимальные'],['2','Класс 2 — допустимые'],['3.1','Класс 3.1 — вредные, +2 %'],['3.2','Класс 3.2 — вредные, +4 %'],['3.3','Класс 3.3 — вредные, +6 %'],['3.4','Класс 3.4 — вредные, +7 %'],['4','Класс 4 — опасные, +8 %']].map(o=>`<option value="${o[0]}"${(e.sout||'')===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></label>
    <label class="fld">Досрочная пенсия<select id="cEarly">${[['','Нет'],['1','Список № 1, +9 %'],['2','Список № 2 и др., +6 %']].map(o=>`<option value="${o[0]}"${(e.early||'')===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></label></div>
    <label class="chk"><input type="checkbox" id="cHead"${R.isHead(e)?' checked':''}> Руководитель организации: взносы не меньше чем с МРОТ</label>`:''}
    <div class="fld2"><label class="fld">Руководитель<select id="cBoss"><option value="">Нет: подчиняется руководителю компании</option>${R.bossOptions(e.id).map(x=>`<option value="${x.id}"${x.id===e.managerId?' selected':''}>${esc(x.fio)}${x.position?' — '+esc(x.position):''}</option>`).join('')}</select></label>
    <div class="fld"><span>Подчинённые</span><div class="subs">${R.reports(e.id).map(x=>`<button type="button" class="pill info" data-card="${x.id}">${esc(x.fio.split(' ').slice(0,2).join(' '))}</button>`).join('')||'<small class="muted">нет</small>'}</div></div></div>
    ${e.contract==='self'?`<div class="st ${e.npd?(e.npd.status?'in':'out'):'check'}"><b>Самозанятый: ${e.npd?(e.npd.status?'статус подтверждён':'ФНС не видит статуса'):'статус не проверялся'}</b><span id="cNpdSt">${e.npd?'Проверено '+d.fmt(e.npd.checkedAt.slice(0,10))+'. ':''}Проверяйте перед каждой выплатой: утрата статуса — риск доначисления НДФЛ и взносов.</span><button type="button" class="b" data-npd="${e.id}" style="align-self:flex-start;margin-top:6px">Проверить в ФНС</button></div>`:''}
    <details class="pd"><summary>Паспорт и адрес${e.passport&&e.passport.series?' · '+esc(e.passport.series+' '+e.passport.number):' · не заполнены'}</summary>
     <div class="fld3">${field('cSur','Фамилия',e.surname||(e.fio||'').split(' ')[0])}${field('cName','Имя',e.name||(e.fio||'').split(' ')[1])}${field('cMid','Отчество',e.middle||(e.fio||'').split(' ').slice(2).join(' '))}</div>
     ${field('cBPlace','Место рождения',e.birthPlace)}
     <div class="fld3">${field('cPass','Серия и номер',e.passport&&e.passport.series?e.passport.series+' '+e.passport.number:'','text','0000 000000')}${field('cPassDate','Дата выдачи',(e.passport||{}).issueDate,'date')}${field('cPassCode','Код подразделения',(e.passport||{}).code,'text','000-000')}</div>
     ${field('cPassBy','Кем выдан',(e.passport||{}).issuedBy)}
     <div class="fld2">${field('cAddr','Адрес регистрации',e.regAddress)}${field('cAddrDate','Дата регистрации',e.regDate,'date')}</div>
     <div class="fld2">${field('cSnils','СНИЛС',e.snils,'text','000-000-000 00')}${field('cInnP','ИНН',e.innP)}</div></details>
    <div class="kv"><span>Договор</span><b>${esc(R.CONTRACT[e.contract]||'')}${e.contractEnd?' до '+d.fmt(e.contractEnd):''}${e.rate&&e.rate<1?' · ставка '+String(e.rate).replace('.',','):''}${e.probation?' · испытательный срок '+e.probation+' мес.':''}${e.remote?' · дистанционно':''}</b></div>
    ${(()=>{const v=R.vacation(e);return `<div class="st ${v.canTake?'in':'check'}"><b>Отпуск: накоплено ${v.acc} дн., осталось ${v.left} дн.</b><span>${v.canTake?'Можно брать отпуск.':'Первый отпуск по закону после 6 месяцев работы.'} Компенсация за остаток около ${v.comp.toLocaleString('ru-RU')} ₽ (оценка). 28 календарных дней в год.</span></div><div class="fld2">${field('cVacUsed','Использовано дней отпуска',e.vacUsed||0,'number')}<span></span></div>`;})()}
    <div class="kv"><span>Договор</span><b>${esc(R.CONTRACT[e.contract]||'')}</b><span>Гражданство</span><b>${esc(R.REGIME[e.regime]||'')}${e.regime!=='ru'?', '+esc(e.country||''):''}</b></div>
    ${e.out?`<p class="note2">Уволен ${d.fmt(e.out.date)}: ${esc(R.FIRE[e.out.reason].t)} (${esc(R.FIRE[e.out.reason].a)}). Личное дело хранится до ${d.fmt(R.purgeOn(e))}.</p>`:''}
    <div class="tl">${e.tasks.length?e.tasks.map(t=>taskRow(Object.assign({},t,{eid:e.id,fio:e.fio}))).join(''):'<p class="muted">Задач нет.</p>'}</div>`;
  }else if(tab==='dossier'){
    const it=DZ.items(e),pr=DZ.progress(e),coarse=matchMedia('(pointer:coarse)').matches;
    const ST={none:['нет','warn'],shown:['оригинал предъявлен','info'],copy:['копия в деле','ok'],done:['готово','ok'],skip:['не требуется','']};
    const off=x=>`<label class="dz-off chk"><input type="checkbox" data-dz-on="${x.k}"> ${esc(x.t)}</label>`;
    const row=x=>{if(x.need==='off')return off(x);const s=x.need==='ask'?['уточните','warn']:x.need==='off'?['не требуется','']:ST[x.state]||ST.none,lbl=x.need==='req'?'обязательно':x.need==='ask'?'нужен ответ':x.need==='cond'?'нужно в вашем случае':x.need==='make'?'оформляем мы':x.need==='off'?'по должности':'по желанию';
      return `<div class="dz ${x.need}"><div class="dz-h"><div><b>${esc(x.t)}</b><small>${esc(lbl)}${x.law?' · '+esc(x.law):''}${x.num?' · <b>'+esc(x.num)+'</b>':''}</small></div><span class="pill ${s[1]}">${s[0]}</span></div>
      ${x.reason?`<p class="dz-r">${esc(x.reason)}</p>`:''}
      ${x.need==='ask'&&x.q?(x.q.key==='industry'?`<label class="fld">${esc(x.q.text)}<select data-dz-ind><option value="">Выберите…</option>${Object.entries(JB.IND).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>`:`<div class="adv-q"><span>${esc(x.q.text)}</span><div><button type="button" class="b" data-dz-ans="${x.q.key}:true">Да</button><button type="button" class="b" data-dz-ans="${x.q.key}:false">Нет</button></div></div>`):''}
      <details><summary>Зачем</summary><p>${esc(x.why)}</p></details>
      ${x.expires?`<label class="fld dz-u">Действует до<input type="date" data-dz-until="${x.k}" value="${esc(x.until)}"></label>${x.expired?'<small class="warnx">Срок истёк: с просроченным документом к работе не допускают. Попросите новый.</small>':''}`:''}
      ${x.files.length?`<div class="dz-f">${x.files.map(f=>`<span class="pill info"><button type="button" class="lnk" data-dz-view="${x.k}:${f.id}">${esc(f.name)}</button><button type="button" class="lnk x" data-dz-del="${x.k}:${f.id}" aria-label="Удалить копию">×</button></span>`).join('')}</div>`:''}
      <div class="dz-a">${x.need==='off'||(x.need==='cond'&&x.grp==='job')?`<label class="chk"><input type="checkbox" data-dz-on="${x.k}"${x.need!=='off'?' checked':''}> Нужен для этой должности</label>`:''}
      ${x.need==='off'?'':x.doc?`<button type="button" class="b" data-doc="${x.doc}">Открыть бланк</button><button type="button" class="b" data-dz-state="${x.k}:${x.state==='done'?'none':'done'}">${x.state==='done'?'Отменить':'Подписано'}</button>`
        :x.check?`<button type="button" class="b" data-dz-state="${x.k}:${x.state==='done'?'none':'done'}">${x.state==='done'?'Отменить':'Проверено, в реестре нет'}</button>`
        :`${x.state==='none'?`<button type="button" class="b" data-dz-state="${x.k}:shown">Оригинал предъявлен</button>`:''}${coarse?`<label class="b d">Сфотографировать<input type="file" accept="image/*" capture="environment" data-dz-file="${x.k}" hidden></label>`:''}<label class="b${coarse?'':' d'}">${coarse?'Из галереи или файла':'Загрузить копию'}<input type="file" accept="image/*,application/pdf" data-dz-file="${x.k}" hidden></label>`}</div></div>`;};
    h=`<div class="dz-top"><button type="button" class="b" data-invite="${e.id}">Попросить документы по ссылке</button></div><div class="st ${pr.missing.length||pr.asks.length?'check':'in'}"><b>Собрано ${pr.done} из ${pr.total}${pr.asks.length?' · вопросов: '+pr.asks.length:''}</b><span>${pr.missing.length?'Не хватает: '+esc(pr.missing.map(x=>x.t.split(' (')[0]).join(', ')):'Все нужные документы есть.'} Требовать документы сверх закона нельзя (ч. 3 ст. 65 ТК).</span></div>
    <p class="muted">Копии хранятся ${cfg.apiUrl?'на сервере в РФ':'на этом устройстве, пока не подключён сервер'}. Делайте копию, только если она нужна: часто достаточно отметить, что оригинал предъявлен.</p>`+
    Object.entries(DZ.GRP).map(([g,t])=>{const a=it.filter(x=>x.grp===g);if(!a.length)return '';
      const on=a.filter(x=>x.need!=='off'),of=a.filter(x=>x.need==='off');
      const body=on.map(row).join('')+(of.length?`<div class="dz-offs"><small class="muted">Не требуются для этой должности — отметьте, если нужны:</small>${of.map(off).join('')}</div>`:'');
      if(g==='opt'){const got=on.filter(x=>x.state!=='none').length;return `<details class="dz-opt"><summary><h3 class="dz-g">${esc(t)} · ${got} из ${on.length}</h3></summary><p class="muted">Эти документы человек даёт сам, если хочет вычет, правильный больничный или зарплату на свою карту. Требовать их нельзя.</p>${body}</details>`;}
      return `<h3 class="dz-g">${esc(t)}</h3>`+body;}).join('');
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
  }else if(tab==='cab'){
    const cb=e.cab;
    h=`<p class="sc-note">Сотрудник видит у себя на телефоне только своё: договоры и согласие, график смен, остаток отпуска. Может подать заявление на отпуск. ${e.regime&&e.regime!=='ru'?'Иностранец видит ещё срок патента или разрешения.':''}</p>
    ${cb&&cb.joinedAt?`<div class="cab-box"><b>Сотрудник в Штатке с ${d.fmt(cb.joinedAt)}</b><small>Данные в его кабинете на ${d.fmt(cb.at)}. Изменился график или отпуск — отправьте приглашение заново.</small></div>`:''}
    ${cb&&!cb.joinedAt?`<div class="cab-box"><b>${cabSt(e).k==='old'?'Приглашение истекло':'Приглашён '+d.fmt(cb.at)}</b><small>${cabSt(e).k==='old'?'Ссылка действовала 7 дней. Отправьте новую.':'Ссылка действует 7 дней, до '+fmtExp(cabSt(e).exp)+' '+new Date(cabSt(e).exp).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'. Данные в ссылке на '+d.fmt(cb.at)+'.'}</small>
      <label class="fld">Код доступа<input id="cbCode" readonly value="${esc(cb.code)}"></label>
      <label class="fld">Ссылка<input id="cbLink" readonly value="${esc(cb.link)}"></label>
      <div class="cab-b"><button type="button" class="b d" data-cab="share">Отправить сотруднику</button><button type="button" class="b" data-cab="link">Копировать ссылку</button><button type="button" class="b" data-cab="code">Копировать код</button></div>
      <small>Ссылку и код отправляйте разными сообщениями: например, ссылку в мессенджер, а код лично или в мессенджере.</small></div>`:''}
    <button type="button" class="b ${cb?'':'d'}" data-invcab="${e.id}">${cb?'Пригласить заново':'Пригласить в Штатку'}</button>`;
  }else if(tab==='sch'){
    const SC=window.SHTATKA_SCH,inn=SC.inSchedule(e),t0=d.today(),x=d.D(t0),mo=SC.month(e,x.getFullYear(),x.getMonth());
    const days=[...Array(14)].map((_,i)=>d.addDays(t0,i));
    h=`<label class="chk"><input type="checkbox" id="cSch"${inn?' checked':''}> В графике смен</label><p class="sc-note">${inn?'Сотрудник виден в разделе «График смен».':'Сотрудник работает по 5/2 или на удалёнке. Включите, если у него сменная работа.'}</p>
    ${inn?`<div class="sc-card"><b>Ближайшие две недели</b><div class="chips" style="margin:8px 0">${days.map(ds=>{const v=SC.cell(e,ds),tp=SC.typeOf(v),sk=R.onSick(e,ds);return `<span title="${esc(d.fmt(ds))}">${d.fmt(ds).slice(0,5)}: ${sk?'б/л':tp?SC.short(tp):v==='off'?'вых':'—'}</span>`;}).join('')}</div>
    <p class="sc-note">В этом месяце: смен ${mo.shifts}, часов ${Math.round(mo.hours*10)/10}, норма ${mo.norm}, ночных ${Math.round(mo.night*10)/10}.</p></div>`:''}
    <a class="b" href="time.html" style="text-decoration:none;display:inline-flex">Открыть график смен</a>`;
  }else if(tab==='sick'){
    h=`<div class="prevs">${e.sick.map(s=>`<div><span>${d.fmt(s.from)} — ${d.fmt(s.to)}</span><i>${esc(s.no||'номер листа не указан')}</i>${s.open?`<button type="button" class="x" data-closesick="${s.id}">закрыть</button>`:'<i>закрыт</i>'}</div>`).join('')||'<p class="muted">Больничных нет.</p>'}</div>
    ${e.out?'':`<div class="fld2">${field('sFrom','С','','date')}${field('sTo','По','','date')}</div>${field('sNo','Номер электронного листа','','text','12 цифр')}<button type="button" class="b" id="sAdd">Добавить больничный</button>`}`;
  }else{
    h=`<div class="prevs">${e.log.map(l=>`<div><span>${esc(l.t)}</span><i>${new Date(l.at).toLocaleDateString('ru-RU')}</i></div>`).join('')}</div>`;
  }
  B.innerHTML=h;
  const f=$('#cFoot');
  f.innerHTML=e.out?`<button type="button" class="b" data-restore="${e.id}">Вернуть из архива</button><button type="button" class="b d" data-close>Закрыть</button>`
   :`<button type="button" class="b" data-fire="${e.id}">Уволить</button><button type="button" class="b" data-contract="${e.id}">Создать договор</button><button type="button" class="b" data-del="${e.id}">Удалить запись</button><button type="button" class="b d" id="cSave">Сохранить</button>`;
}
function saveCard(){
  const e=R.get(cur);if(!e)return;const g=s=>{const x=$(s);return x?x.value:undefined;},c=s=>{const x=$(s);return x?x.checked:undefined;};
  const p={};
  const map={cFio:'fio',cPos:'position',cBirth:'birth',cStart:'start',cPhone:'phone',cEmail:'email',cMilDoc:'milDoc',cRank:'rank',cVus:'vus',cKom:'komm',cCountry:'country',cPermit:'permitNo',cUntil:'permitUntil',cMilCat:'milCat',cFit:'fit',cReg:'regime',cSout:'sout',cEarly:'early',cBoss:'managerId',cSur:'surname',cName:'name',cMid:'middle',cBPlace:'birthPlace',cAddr:'regAddress',cAddrDate:'regDate',cSnils:'snils',cInnP:'innP'};
  Object.entries(map).forEach(([k,v])=>{const x=g('#'+k);if(x!==undefined)p[v]=x;});
  if(g('#cSal')!==undefined)p.salary=+g('#cSal')||0;
  if(g('#cVacUsed')!==undefined)p.vacUsed=+g('#cVacUsed')||0;
  if(c('#cHasVus')!==undefined)p.hasVus=c('#cHasVus');if(c('#cHead')!==undefined)p.head=c('#cHead');if(c('#cAbroad')!==undefined)p.livesAbroad=c('#cAbroad');
  if(g('#cEtk')!==undefined)e.etk.kind=g('#cEtk');
  if(g('#sY')!==undefined&&g('#sY')!==''){e.etk.sfr={y:+g('#sY')||0,m:+g('#sM')||0,d:+g('#sD')||0,at:d.today()};}
  if(g('#cPass')!==undefined){const n=g('#cPass').replace(/\D/g,'');p.passport=Object.assign({},e.passport||{},{series:n.slice(0,4),number:n.slice(4,10),issueDate:g('#cPassDate'),issuedBy:g('#cPassBy'),code:g('#cPassCode')});}
  if(p.surname!==undefined){const f=[p.surname,p.name,p.middle].map(x=>(x||'').trim()).filter(Boolean).join(' ');if(f.split(' ').length>=2)p.fio=f;}
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
  if(t.dataset.contract){openContract(t.dataset.contract);return;}
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
function dzSet(k,patch){const e=R.get(cur);const ds=Object.assign({},e.dossier||{});ds[k]=Object.assign({},ds[k]||{},patch);R.update(cur,{dossier:ds});R.save();paintCard();render();}
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-dz-state],[data-dz-view],[data-dz-del],[data-dz-ans]');if(!b||!cur)return;
  if(b.dataset.dzAns){const [k,v]=b.dataset.dzAns.split(':');const e=R.get(cur);R.update(cur,{answers:Object.assign({},e.answers||{},{[k]:v==='true'})});R.save();paintCard();render();return;}
  if(b.dataset.dzState){const [k,s]=b.dataset.dzState.split(':');dzSet(k,{state:s,at:d.today()});return;}
  if(b.dataset.dzView){const [k,id]=b.dataset.dzView.split(':');const f=await DZ.getFile(id);if(!f){toast('Файл не найден на этом устройстве.');return;}const u=URL.createObjectURL(f.blob);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000);return;}
  if(b.dataset.dzDel){const [k,id]=b.dataset.dzDel.split(':');await DZ.delFile(id).catch(()=>{});const e=R.get(cur),c=(e.dossier||{})[k]||{};const files=(c.files||[]).filter(f=>f.id!==id);dzSet(k,{files,state:files.length?'copy':(c.state==='copy'?'shown':c.state||'none')});toast('Копия удалена.');}
});
document.addEventListener('change',async ev=>{
  const di=ev.target.closest('[data-dz-ind]');if(di&&cur){if(di.value){H.state().company.industry=di.value;H.persist();paintCard();render();}return;}
  const on=ev.target.closest('[data-dz-on]');if(on&&cur){dzSet(on.dataset.dzOn,{on:on.checked});return;}
  const un=ev.target.closest('[data-dz-until]');if(un&&cur){dzSet(un.dataset.dzUntil,{until:un.value});toast(un.value?'Срок сохранён: напомним за 30 дней.':'Срок убран.');return;}
  const inp=ev.target.closest('[data-dz-file]');if(!inp||!inp.files||!inp.files[0]||!cur)return;
  const k=inp.dataset.dzFile,file=inp.files[0];inp.value='';
  const prep=await PP.prepare(file).catch(()=>({error:'Не удалось прочитать файл.'}));if(prep.error){toast(prep.error);return;}
  const m=await DZ.putFile(prep.blob,(DZ.LIST.find(x=>x.k===k)||{}).t.split(' (')[0]+(prep.pdf?'.pdf':'.jpg'));
  const e=R.get(cur),c=(e.dossier||{})[k]||{};dzSet(k,{files:(c.files||[]).concat(m),state:'copy',at:d.today()});
  if(k==='snils'&&!e.snils){toast('Копия сохранена. Читаем номер СНИЛС…');const r=await PP.recognize('snils',prep);if(r.ok&&r.fields&&r.fields.snils){R.update(cur,{snils:r.fields.snils});R.save();paintCard();toast((r.demo?'Демо: ':'')+'Номер СНИЛС внесён: '+r.fields.snils+'. Проверьте.');}}
  else toast('Копия сохранена в личное дело.');
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
document.addEventListener('change',ev=>{if(ev.target.id==='cSch'&&cur){window.SHTATKA_SCH.setIncl(cur,ev.target.checked);if(ev.target.checked&&!window.SHTATKA_SCH.active())window.SHTATKA_SCH.enable(true);paintCard();}});

/* кабинет сотрудника: доступ */
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-cab]');if(!t||!cur)return;const e=R.get(cur),M=window.SHTATKA_ME;
  const a=t.dataset.cab;
  const cb=e.cab;if(!cb)return;const first=(e.fio||'').split(' ')[1]||'';
  const cp=async(x,m)=>{try{await navigator.clipboard.writeText(x);toast(m);}catch(err){toast('Не удалось скопировать: выделите текст вручную.');}};
  if(a==='link')cp(cb.link,'Ссылка скопирована.');
  if(a==='code')cp(cb.code,'Код скопирован.');
  if(a==='share'){const txt='Здравствуйте, '+first+'! Ваш личный кабинет: график смен, отпуск и документы. Откройте ссылку: '+cb.link+'  Код доступа пришлю отдельным сообщением.';
    if(navigator.share){try{await navigator.share({text:txt});return;}catch(err){if(err&&err.name==='AbortError')return;}}cp(txt,'Текст с ссылкой скопирован. Код отправьте отдельным сообщением.');}
});
/* заявление на отпуск от сотрудника приходит ссылкой people.html#v=… */
(function(){const m=location.hash.match(/^#v=([\w-]+)/);if(!m)return;
  setTimeout(()=>{let r;try{r=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')))));}catch(x){toast('Не удалось прочитать заявление.');return;}
    if(r.type==='joined'){const e=R.get(r.empId);history.replaceState(null,'',location.pathname);
      if(!e||!e.cab||e.cab.id!==r.inviteId){toast('Это приглашение не найдено: возможно, вы создали новое. Отправьте приглашение заново.');return;}
      if(!canEdit()){want('add');return;}
      e.cab.joinedAt=d.today();e.log.unshift({at:new Date().toISOString(),t:'Сотрудник вошёл в личный кабинет Штатки'});R.update(e.id,{cab:e.cab});R.save();render();toast(e.fio+' теперь в Штатке.');return;}
    const e=R.get(r.empId);if(!e||!['vacation','passport'].includes(r.type)){toast('Сотрудник из заявления не найден в вашем списке.');return;}
    if(!canEdit()){want('add');return;}
    if(r.type==='passport'){
      const f=r.fields||{},P0=e.passport||{},cur0={surname:e.surname||(e.fio||'').split(' ')[0],name:e.name||(e.fio||'').split(' ')[1],middle:e.middle||(e.fio||'').split(' ').slice(2).join(' '),series:P0.series,number:P0.number,issueDate:P0.issueDate,issuedBy:P0.issuedBy,code:P0.code,regAddress:e.regAddress,regDate:e.regDate};
      const L={surname:'Фамилия',name:'Имя',middle:'Отчество',series:'Серия паспорта',number:'Номер паспорта',issueDate:'Дата выдачи',issuedBy:'Кем выдан',code:'Код подразделения',regAddress:'Адрес регистрации',regDate:'Дата регистрации'};
      const rows=Object.keys(L).filter(k=>f[k]&&String(f[k])!==String(cur0[k]||'')).map(k=>`<tr><td>${L[k]}</td><td>${esc(cur0[k]||'—')}</td><td><b>${esc(f[k])}</b></td></tr>`);
      $('#vacT').textContent='Новые данные: '+e.fio;
      $('#vacB').innerHTML=`<p class="sc-note">${esc(({passport:'Сотрудник прислал данные нового паспорта.',reg:'Сотрудник прислал новую регистрацию.'})[r.kind]||'')}${r.reason?' Причина: <b>'+esc(r.reason)+'</b>.':''}</p>${rows.length?`<div class="tw"><table class="tbl"><thead><tr><th>Поле</th><th>Было</th><th>Станет</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<p>Данные совпадают с карточкой.</p>'}
        <p class="sc-note">Сверьте с оригиналом или фото, которые пришлёт сотрудник. Фото в ссылке не передаются.${r.reason&&/фамил/i.test(r.reason)?' При смене фамилии внесите изменения в личную карточку Т-2 и трудовую книжку по документам.':''}</p>`;
      $('#vacOk').textContent='Применить';$('#vacOk').onclick=()=>{
        const patch={},nm=Object.assign({},cur0,f);
        ['surname','name','middle','regAddress','regDate'].forEach(k=>{if(f[k])patch[k]=f[k];});
        if(['series','number','issueDate','issuedBy','code'].some(k=>f[k]))patch.passport=Object.assign({},P0,Object.fromEntries(['series','number','issueDate','issuedBy','code'].filter(k=>f[k]).map(k=>[k,f[k]])));
        if(f.surname||f.name||f.middle)patch.fio=[nm.surname,nm.name,nm.middle].filter(Boolean).join(' ');
        R.update(e.id,patch);e.log.unshift({at:new Date().toISOString(),t:'Данные обновлены по заявлению сотрудника: '+(r.kind==='reg'?'регистрация':'паспорт')+(r.reason?' ('+r.reason+')':'')});R.save();
        close($('#dVac'));history.replaceState(null,'',location.pathname);$('#vacOk').textContent='Согласовать';render();toast('Данные обновлены. Возьмите копию нового документа в личное дело.');};
      $('#vacNo').onclick=()=>{close($('#dVac'));history.replaceState(null,'',location.pathname);$('#vacOk').textContent='Согласовать';toast('Данные не изменены. Уточните у сотрудника.');};
      open('#dVac');return;}
    const v=R.vacation(e);
    $('#vacT').textContent='Заявление на отпуск: '+e.fio;
    $('#vacB').innerHTML=`<p><b>${d.fmt(r.from)} — ${d.fmt(r.to)}</b>, ${r.days} ${r.days%10===1&&r.days!==11?'день':'дней'}.</p><p class="sc-note">Накоплено ${v.acc} дн., уже взято ${v.used}, остаток ${v.left}.${r.days>v.left?' <b>Просят больше, чем накоплено: возможен отпуск за свой счёт.</b>':''}${!v.canTake?' Шесть месяцев работы ещё не прошло: отпуск возможен по соглашению сторон (ст. 122 ТК).':''}</p><p class="sc-note">Если согласны, оформите приказ об отпуске и ознакомьте сотрудника под подпись. Штатка отметит дни как взятые.</p><button type="button" class="b" id="vacOrd">Показать приказ об отпуске</button>`;
    $('#vacOrd').onclick=()=>{const C=window.SHTATKA_CDOCS;if(C)C.showDoc('Приказ об отпуске: '+e.fio,C.vacOrder(e,r));};
    $('#vacOk').onclick=()=>{R.update(e.id,{vacUsed:(+e.vacUsed||0)+r.days,vacations:(e.vacations||[]).concat([{from:r.from,to:r.to,days:r.days}])});
      e.log.unshift({at:new Date().toISOString(),t:'Отпуск '+d.fmt(r.from)+' — '+d.fmt(r.to)+' по заявлению сотрудника'});R.save();close($('#dVac'));history.replaceState(null,'',location.pathname);render();toast('Отпуск отмечен. Не забудьте приказ.');};
    $('#vacNo').onclick=()=>{close($('#dVac'));history.replaceState(null,'',location.pathname);toast('Сообщите сотруднику об отказе или предложите другие даты.');};
    open('#dVac');},500);})();

/* приглашение в кабинет: короткое окно «ФИО + почта» */
let invE=null;
const mailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function cabAsk(id,err){
  invE=R.get(id);if(!invE)return;
  $('#cabT').textContent='Пригласить в Штатку';
  $('#cabB').innerHTML=`<p class="sc-note">Сотрудник получит письмо со ссылкой на личный кабинет: график смен, остаток отпуска, документы, заявление на отпуск.</p>
   <label class="fld">Сотрудник<input id="cabFio" value="${esc(invE.fio)}" readonly></label>
   <label class="fld">Электронная почта<input id="cabMail" type="email" inputmode="email" autocomplete="off" value="${esc(invE.email||'')}" placeholder="name@example.ru"></label>
   ${err?`<p class="err" role="alert">${esc(err)}</p>`:''}<p class="sc-note">Почту можно исправить. Она сохранится в карточке.</p>`;
  $('#cabF').innerHTML='<button type="button" class="b" data-close>Отмена</button><button type="button" class="b d" id="cabSend">Отправить приглашение</button>';
  close($('#dCard'));open('#dCab');
}
async function cabSend(){
  const e=invE,M=window.SHTATKA_ME,cfg=window.SHTATKA_CONFIG||{},mail=$('#cabMail').value.trim();
  if(!mailOk(mail))return cabAsk(e.id,'Проверьте адрес почты: он должен быть вида name@example.ru');
  if(!canEdit()){want('add');return;}
  $('#cabSend').disabled=true;$('#cabSend').textContent='Готовим…';
  const code=M.newCode(),payload=M.build(e),sealed=await M.seal(payload,code),base=location.origin+location.pathname.replace(/[^/]*$/,''),link=base+'me.html#m='+sealed;
  R.update(e.id,{email:mail,cab:{at:d.today(),code:M.showCode(code),link,id:payload.id,email:mail,expAt:payload.expAt,joinedAt:(e.cab&&e.cab.joinedAt)||''}});R.save();render();
  const first=(e.fio||'').split(' ')[1]||'',co=(H.session()||{}).company||'Работодатель';
  const subj='Приглашение в Штатку: ваш личный кабинет',body=`Здравствуйте, ${first}!\n\n${co} приглашает вас в личный кабинет Штатки. Там ваш график смен, остаток отпуска и документы.\n\nОткройте ссылку:\n${link}\n\nКод доступа вам передадут отдельно.`;
  let how='';
  if(cfg.apiUrl){try{const x=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/me/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empId:e.id,email:mail,fio:e.fio,company:co,link})});if(x.ok)how='sent';}catch(err){}}
  if(!how&&navigator.share&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:subj,text:body});how='shared';}catch(err){if(err&&err.name!=='AbortError')how='';else how='cancel';}}
  if(!how){const m='mailto:'+encodeURIComponent(mail)+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
    if(m.length<1800){location.href=m;how='mail';}
    else{try{await navigator.clipboard.writeText(body);}catch(err){}location.href='mailto:'+encodeURIComponent(mail)+'?subject='+encodeURIComponent(subj);how='mailcopy';}}
  const msg={sent:'Письмо отправлено на '+esc(mail)+'.',shared:'Приглашение отправлено через выбранное приложение.',mail:'Письмо открылось в вашей почте. Нажмите «Отправить» там.',mailcopy:'Письмо открылось в вашей почте, а текст приглашения со ссылкой скопирован: вставьте его в письмо и отправьте.',cancel:'Отправка отменена. Текст можно скопировать кнопкой ниже.'}[how];
  $('#cabT').textContent='Приглашение готово';
  $('#cabB').innerHTML=`<p class="ok-box" style="background:var(--ok-bg);color:var(--ok);border-radius:12px;padding:10px 12px">${msg}</p>
   <p class="sc-note">Сообщите сотруднику код доступа лично или в мессенджере. В письмо он не входит: так чужой человек не откроет кабинет по одной почте.</p>
   <div class="cab-box"><label class="fld">Код доступа<input id="cbCode" readonly value="${esc(M.showCode(code))}"></label><div class="cab-b"><button type="button" class="b d" data-cabcp="code">Копировать код</button><button type="button" class="b" data-cabcp="text">Копировать письмо</button></div></div>`;
  $('#cabF').innerHTML='<button type="button" class="b d" data-close>Готово</button>';
  window.__cabText=body;window.__cabCode=M.showCode(code);
}
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-invcab],#cabSend,[data-cabcp]');if(!t)return;
  if(t.dataset.invcab){ev.stopPropagation();if(!canEdit()){want('add');return;}cabAsk(t.dataset.invcab);return;}
  if(t.id==='cabSend'){cabSend();return;}
  const v=t.dataset.cabcp==='code'?window.__cabCode:window.__cabText;try{await navigator.clipboard.writeText(v);toast(t.dataset.cabcp==='code'?'Код скопирован.':'Письмо скопировано.');}catch(err){toast('Не удалось скопировать: выделите текст вручную.');}},true);
})();
