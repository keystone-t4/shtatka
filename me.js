/* Личный кабинет сотрудника: договоры, график смен, отпуск, сроки иностранца. Данные приходят зашифрованной ссылкой от работодателя (me-core.js). */
(function(){
const M=window.SHTATKA_ME,cfg=window.SHTATKA_CONFIG||{};
const $=s=>document.querySelector(s),V=$('#v');
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const KEY='shtatka-me',REQ='shtatka-me-req';
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const iso=d=>{const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());};
const D=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d);};
const add=(s,n)=>{const x=D(s);x.setDate(x.getDate()+n);return iso(x);};
const today=()=>iso(new Date());
const fmt=s=>{const x=D(s);return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+x.getFullYear();};
const WD=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'],WS=['вс','пн','вт','ср','чт','пт','сб'];
const diff=(a,b)=>Math.round((D(b)-D(a))/864e5);
const plu=(n,a,b,c)=>{const m=n%100,k=n%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
let pending=null,tab='home',flow=null,up={},fields={};
const PP=window.SHTATKA_PASSPORT;

function say(h){V.innerHTML=h;window.scrollTo(0,0);}
function welcome(err){
  say(`<section class="card"><h1>Вход для сотрудника</h1><p class="lead">Работодатель присылает ссылку и отдельно код доступа. Откройте ссылку из сообщения и введите код. Здесь вы увидите свои документы, график смен и остаток отпуска.</p>
  <label class="fld">Если ссылка не открылась, вставьте её сюда<input id="lk" inputmode="url" autocomplete="off" placeholder="https://…/me.html#m=…"></label>${err?`<p class="err">${esc(err)}</p>`:''}<button type="button" class="btn" id="go">Продолжить</button>
  <p class="muted">Вы руководитель или владелец компании? <a href="register.html">Регистрация компании</a></p></section>`);
  $('#go').onclick=()=>{const m=/#m=([\w-]+)/.exec($('#lk').value);if(!m)return welcome('В ссылке нет данных. Скопируйте её из сообщения целиком.');pending=m[1];ask();};
}
function ask(err){
  say(`<section class="card"><h1>Введите код доступа</h1><p class="lead">Код из отдельного сообщения от работодателя: 8 букв и цифр.</p>
  <label class="fld">Код<input id="cd" class="code" maxlength="9" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX"></label>${err?`<p class="err" role="alert">${esc(err)}</p>`:''}
  <button type="button" class="btn" id="ok">Войти</button><button type="button" class="btn ghost" id="bk">Назад</button></section>`);
  const i=$('#cd');i.addEventListener('input',()=>{let v=M.normCode(i.value).slice(0,8);i.value=v.length>4?v.slice(0,4)+'-'+v.slice(4):v;});i.focus();
  $('#bk').onclick=()=>{pending=null;stored()||welcome();};
  $('#ok').onclick=async()=>{const c=M.normCode(i.value);if(c.length<8)return ask('Код состоит из 8 символов. Проверьте сообщение.');
    $('#ok').disabled=true;$('#ok').textContent='Проверяем…';
    try{const p=await M.open(pending,c);if(p.expAt?Date.now()>p.expAt:(p.exp&&today()>p.exp))return ask('Приглашение действует 7 дней и уже истекло. Попросите работодателя прислать новое.');
      put(KEY,{p,at:today()});pending=null;if(cfg.apiUrl){fetch(cfg.apiUrl.replace(/\/$/,'')+'/me/joined',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inviteId:p.id,empId:p.emp.id})}).then(x=>{if(x.ok){const s0=get(KEY,{});s0.joined=true;put(KEY,s0);}}).catch(()=>{});}history.replaceState(null,'',location.pathname);main(p);}
    catch(e){ask(e.message==='code'?'Код не подошёл. Проверьте буквы и цифры или попросите работодателя прислать код ещё раз.':'Ссылка повреждена. Скопируйте её из сообщения целиком.');}};
  i.addEventListener('keydown',e=>{if(e.key==='Enter')$('#ok').click();});
}
function stored(){const s=get(KEY,null);if(s&&s.p){main(s.p);return true;}return false;}

function shiftOf(p,ds){if(!p.sch)return null;const v=p.sch.days[ds];if(!v)return {k:'none'};if(v==='off')return {k:'off'};if(v==='sick')return {k:'sick'};const t=p.sch.types.find(x=>x.id===v);return t?{k:'shift',t}:{k:'none'};}
const tm=t=>t.from+'–'+t.to;
function homeTab(p){
  const t=today(),e=p.emp,first=(e.fio||'').split(' ')[1]||(e.fio||'').split(' ')[0]||'';
  let h=`<section class="card hello"><h1>Здравствуйте, ${esc(first)}</h1><p class="muted">${esc(e.position||'')}${p.co?' · '+esc(p.co):''}</p></section>`;
  if(p.foreign){const n=diff(t,p.foreign.until),cl=n<0?'crit':n<=30?'crit':n<=60?'warn':'ok';
    h+=`<section class="card"><h2>${esc(p.foreign.kind)}</h2><div class="row"><div><b>Действует до ${fmt(p.foreign.until)}</b>${p.foreign.no?`<small>№ ${esc(p.foreign.no)}</small>`:''}</div><span class="pill ${cl}">${n<0?'истёк':'осталось '+n+' '+plu(n,'день','дня','дней')}</span></div>
    <p class="muted">${n<=30?'Срок подходит к концу. Сообщите работодателю, как продлеваете документ, чтобы вам не пришлось прекращать работу.':'Держите срок на контроле: продлевать документ нужно заранее.'}</p></section>`;}
  if(p.sch){const s=shiftOf(p,t);
    h+=`<section class="card today"><span class="muted">Сегодня, ${WD[D(t).getDay()]}</span>${s.k==='shift'?`<b>${esc(s.t.name)}</b><span>${tm(s.t)}</span>`:`<b>${s.k==='sick'?'Больничный':s.k==='off'?'Выходной':'Смена не назначена'}</b>`}</section>`;
    const days=[];for(let i=1;i<=14;i++){const ds=add(t,i);if(diff(p.issued,ds)<28)days.push(ds);}
    const rows=days.map(ds=>{const s=shiftOf(p,ds);return `<div class="row"><div><b>${WS[D(ds).getDay()]}, ${fmt(ds).slice(0,5)}</b></div>${s.k==='shift'?`<span class="pill info">${esc(s.t.name)} ${tm(s.t)}</span>`:`<span class="pill">${s.k==='off'?'выходной':s.k==='sick'?'больничный':'не назначено'}</span>`}</div>`;}).join('');
    h+=`<section class="card"><h2>Ближайшие смены</h2><div class="rows">${rows||'<p class="muted">График закончился. Попросите работодателя обновить доступ.</p>'}</div></section>`;}
  {const st=get(KEY,{});if(!st.joined)h=`<section class="card" style="border-color:var(--lamp)"><h2>Вы в Штатке</h2><p class="lead">Сообщите работодателю, что вошли в кабинет: он увидит это у себя в списке сотрудников.</p><button type="button" class="btn" data-joined="1">Сообщить работодателю</button></section>`+h;}
  h+=`<section class="card"><h2>Отпуск</h2><div class="vac"><div><b>${p.vac.acc}</b><small>накоплено</small></div><div><b>${p.vac.used}</b><small>взято</small></div><div><b>${p.vac.left}</b><small>остаток, дн.</small></div></div><button type="button" class="btn ghost" data-go="vac">Подать заявление на отпуск</button></section>`;
  return h+`<p class="stale">Данные на ${fmt(p.issued)}. Если график или отпуск изменились, работодатель пришлёт новую ссылку.</p>`;
}
function docsTab(p){
  return `<section class="card"><h2>Мои документы</h2><p class="muted">То, что оформлено между вами и работодателем.</p><div class="rows">${p.docs.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b></div><button type="button" class="pill info" data-doc="${i}" style="border:0">Открыть</button></div>`).join('')||'<p class="muted">Документы появятся после оформления.</p>'}</div></section>
  <section class="card"><h2>О работе</h2><div class="rows"><div class="row"><span>Должность</span><b>${esc(p.emp.position||'—')}</b></div><div class="row"><span>Работаю с</span><b>${p.emp.start?fmt(p.emp.start):'—'}</b></div>${p.emp.contractNo?`<div class="row"><span>Договор №</span><b>${esc(p.emp.contractNo)}</b></div>`:''}</div></section>`;
}
function vacTab(p){
  const reqs=get(REQ,[]).filter(r=>r.inviteId===p.id);
  return `<section class="card"><h2>Мой отпуск</h2><div class="vac"><div><b>${p.vac.acc}</b><small>накоплено</small></div><div><b>${p.vac.used}</b><small>взято</small></div><div><b>${p.vac.left}</b><small>остаток, дн.</small></div></div>
  ${p.vac.canTake?'':'<p class="muted">Вы работаете меньше шести месяцев. Отпуск возможен по договорённости с работодателем.</p>'}</section>
  <section class="card"><h2>Заявление на отпуск</h2><div class="g2"><label class="fld">С<input type="date" id="vf" min="${today()}"></label><label class="fld">По<input type="date" id="vt" min="${today()}"></label></div>
  <p class="muted" id="vs">Выберите даты.</p><div id="ve"></div><button type="button" class="btn" id="vsend" disabled>Отправить работодателю</button>
  <p class="muted sm">Работодатель получит заявление и согласует даты. Отпуск начинается только после его согласия.</p></section>
  ${reqs.length?`<section class="card"><h2>Мои заявления</h2><div class="rows">${reqs.map(r=>`<div class="row"><div><b>${fmt(r.from)} — ${fmt(r.to)}</b><small>${r.days} ${plu(r.days,'день','дня','дней')}, отправлено ${fmt(r.at)}</small></div><span class="pill">ждёт ответа</span></div>`).join('')}</div></section>`:''}`;
}
function bindVac(p){
  const f=$('#vf'),t=$('#vt'),b=$('#vsend'),s=$('#vs');if(!f)return;
  const upd=()=>{b.disabled=true;$('#ve').innerHTML='';if(!f.value||!t.value){s.textContent='Выберите даты.';return;}
    if(t.value<f.value){s.textContent='Дата окончания раньше начала.';return;}
    const n=diff(f.value,t.value)+1;s.textContent=`${n} ${plu(n,'календарный день','календарных дня','календарных дней')}. После отпуска у вас останется ${Math.max(0,Math.round((p.vac.left-n)*10)/10)} дн.`;
    if(n>p.vac.left)$('#ve').innerHTML=`<p class="err">Вы просите больше, чем накоплено (${p.vac.left} дн.). Остальное возможно только за свой счёт, по согласию работодателя.</p>`;
    b.disabled=false;};
  f.onchange=()=>{if(!t.value||t.value<f.value)t.value=f.value;upd();};t.onchange=upd;
  b.onclick=async()=>{const n=diff(f.value,t.value)+1,r={v:1,type:'vacation',inviteId:p.id,empId:p.emp.id,fio:p.emp.fio,from:f.value,to:t.value,days:n,at:today()};
    const enc=btoa(unescape(encodeURIComponent(JSON.stringify(r)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const base=location.origin+location.pathname.replace(/[^/]*$/,''),url=base+'people.html#v='+enc;
    const txt=`Заявление на отпуск: ${p.emp.fio}, с ${fmt(r.from)} по ${fmt(r.to)} (${n} ${plu(n,'день','дня','дней')}). Откройте для согласования: ${url}`;
    let sent=false;
    if(cfg.apiUrl){try{const x=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/me/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});sent=x.ok;}catch(e){}}
    if(!sent&&navigator.share){try{await navigator.share({text:txt});sent=true;}catch(e){if(e&&e.name==='AbortError')return;}}
    if(!sent){try{await navigator.clipboard.writeText(txt);sent=true;$('#ve').innerHTML='<p class="ok-box">Текст заявления скопирован. Отправьте его работодателю в мессенджере или СМС.</p>';}catch(e){$('#ve').innerHTML=`<p class="err">Не удалось отправить. Скопируйте текст и перешлите работодателю:</p><p class="sm">${esc(txt)}</p>`;return;}}
    const l=get(REQ,[]);l.push(r);put(REQ,l);if(!$('#ve').innerHTML)$('#ve').innerHTML='<p class="ok-box">Заявление отправлено.</p>';setTimeout(()=>{tab='vac';draw(p);},1500);};
}
const FLD={surname:'Фамилия',name:'Имя',middle:'Отчество',series:'Серия',number:'Номер',issueDate:'Дата выдачи',issuedBy:'Кем выдан',code:'Код подразделения',regAddress:'Адрес регистрации',regDate:'Дата регистрации'};
const PASS=['surname','name','middle','series','number','issueDate','issuedBy','code'],REG=['regAddress','regDate'];
const DATEF=['issueDate','regDate'];
function dataTab(p){
  const reqs=get(REQ,[]).filter(r=>r.inviteId===p.id&&r.type==='data');
  if(p.foreign)return `<section class="card"><h2>Мои данные</h2><p class="lead">Данные иностранного гражданина вносит работодатель. Покажите ему новый документ или фото.</p></section>`;
  const hist=reqs.length?`<section class="card"><h2>Отправленные данные</h2><div class="rows">${reqs.map(r=>`<div class="row"><div><b>${r.kind==='reg'?'Новая прописка':'Новый паспорт'}</b><small>отправлено ${fmt(r.at)}</small></div><span class="pill">ждёт ответа</span></div>`).join('')}</div></section>`:'';
  if(!flow)return `<section class="card"><h2>Обновить данные</h2><p class="lead">Сменили фамилию, получили новый паспорт или прописку? Сфотографируйте страницы, а мы прочитаем данные. Вам останется проверить.</p>
    <button type="button" class="btn" data-flow="passport">Новый паспорт</button><button type="button" class="btn ghost" data-flow="reg">Новая прописка</button>
    <p class="muted sm">Паспорт заменяют при смене фамилии, в 20 и 45 лет, при утере или порче.</p></section>`+hist;
  const list=flow==='passport'?PASS:REG,need=flow==='passport'?'разворот с фото':'страницу с пропиской';
  const pr=up[flow==='passport'?'main':'reg'];
  return `<section class="card"><h2>${flow==='passport'?'Новый паспорт':'Новая прописка'}</h2>
  ${flow==='passport'?`<label class="fld">Что случилось<select id="dr" class="sel"><option>Сменил(а) фамилию</option><option>Замена по возрасту (20 или 45 лет)</option><option>Паспорт утерян или испорчен</option><option>Другое</option></select></label>`:''}
  <label class="fld">Фото: ${need}<input type="file" id="df" accept="image/*,application/pdf"></label><p class="muted sm" id="dst">${pr?'Фото приложено.':'Выберите фото из галереи или сфотографируйте при хорошем свете, без бликов.'}</p>
  <div class="g2" id="dflds">${list.map(k=>`<label class="fld" style="${['issuedBy','regAddress'].includes(k)?'grid-column:1/-1':''}">${FLD[k]}<input data-k="${k}" type="${DATEF.includes(k)?'date':'text'}" value="${esc(fields[k]||'')}"></label>`).join('')}</div>
  <div id="de"></div><button type="button" class="btn" id="dsend">Отправить работодателю</button><button type="button" class="btn ghost" data-flow="">Отмена</button>
  <p class="muted sm">Работодатель сверит данные с оригиналом. Фото в ссылке не передаются: при отправке приложите их в мессенджере.</p></section>`;
}
function bindData(p){
  const f=$('#df');if(!f)return;
  document.querySelectorAll('#dflds input').forEach(i=>i.addEventListener('input',()=>{fields[i.dataset.k]=i.value.trim();}));
  f.onchange=async()=>{const file=f.files[0];if(!file)return;const st=$('#dst');st.textContent='Готовим фото…';
    const prep=await PP.prepare(file).catch(()=>({error:'Не удалось открыть файл.'}));if(prep.error){st.textContent=prep.error;return;}
    up[flow==='passport'?'main':'reg']=prep;st.textContent='Читаем данные…';
    const r=await PP.recognize(flow==='passport'?'main':'reg',prep);
    if(!r.ok){st.textContent=(PP.REASON[r.reason]||'Не удалось прочитать фото.')+' Впишите данные вручную.';return;}
    if(r.demo){st.textContent='Автоматическое чтение пока не подключено. Фото приложено, впишите данные с него.';return;}
    const fl=r.fields||{},o={};(flow==='passport'?PASS:REG).forEach(k=>{const v=k==='regAddress'?fl.address:fl[k];if(v)o[k]=v;});if(flow==='reg'&&fl.regDate)o.regDate=fl.regDate;
    Object.assign(fields,o);st.textContent='Данные прочитаны. Проверьте каждое поле.';document.querySelectorAll('#dflds input').forEach(i=>{if(o[i.dataset.k]){i.value=o[i.dataset.k];i.style.background='var(--info-bg)';}});};
  $('#dsend').onclick=async()=>{
    const list=flow==='passport'?PASS:REG,miss=list.filter(k=>!fields[k]&&!['middle','code'].includes(k));
    if(miss.length){$('#de').innerHTML=`<p class="err">Заполните: ${miss.map(k=>FLD[k].toLowerCase()).join(', ')}.</p>`;return;}
    const r={v:1,type:'passport',kind:flow,reason:flow==='passport'?$('#dr').value:'Новая прописка',inviteId:p.id,empId:p.emp.id,fio:p.emp.fio,at:today(),fields:Object.fromEntries(list.filter(k=>fields[k]).map(k=>[k,fields[k]]))};
    const enc=btoa(unescape(encodeURIComponent(JSON.stringify(r)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url=location.origin+location.pathname.replace(/[^/]*$/,'')+'people.html#v='+enc;
    const txt=`${r.kind==='reg'?'Новая прописка':'Новый паспорт'}: ${p.emp.fio}. Откройте, чтобы сверить и применить: ${url}`;
    const photo=up[flow==='passport'?'main':'reg'],files=photo&&photo.blob?[new File([photo.blob],photo.name||'doc.jpg',{type:photo.blob.type||'image/jpeg'})]:[];
    let sent=false;
    if(cfg.apiUrl){try{const body=Object.assign({},r,{files:photo&&photo.content?[{mime:photo.mime,name:photo.name,b64:photo.content}]:[]});const x=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/me/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});sent=x.ok;}catch(e){}}
    if(!sent&&navigator.share){try{const d=files.length&&navigator.canShare&&navigator.canShare({files})?{text:txt,files}:{text:txt};await navigator.share(d);sent=true;}catch(e){if(e&&e.name==='AbortError')return;}}
    if(!sent){try{await navigator.clipboard.writeText(txt);sent=true;$('#de').innerHTML='<p class="ok-box">Текст скопирован. Отправьте его работодателю и приложите фото страниц.</p>';}catch(e){$('#de').innerHTML=`<p class="err">Не удалось отправить. Скопируйте текст и перешлите:</p><p class="sm">${esc(txt)}</p>`;return;}}
    const l=get(REQ,[]);l.push({type:'data',kind:flow,inviteId:p.id,at:today()});put(REQ,l);up={};fields={};flow=null;
    if(!$('#de').innerHTML)$('#de').innerHTML='<p class="ok-box">Отправлено.</p>';setTimeout(()=>draw(p),1500);};
}
async function sendJoined(s){
  const p=s.p,r={v:1,type:'joined',inviteId:p.id,empId:p.emp.id,fio:p.emp.fio,at:today()};
  const enc=btoa(unescape(encodeURIComponent(JSON.stringify(r)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const txt='Я вошёл(а) в личный кабинет Штатки: '+p.emp.fio+'. Откройте, чтобы отметить: '+location.origin+location.pathname.replace(/[^/]*$/,'')+'people.html#v='+enc;
  let ok=false;
  if(navigator.share){try{await navigator.share({text:txt});ok=true;}catch(e){if(e&&e.name==='AbortError')return;}}
  if(!ok){try{await navigator.clipboard.writeText(txt);ok=true;alert('Текст скопирован. Отправьте его работодателю.');}catch(e){prompt('Скопируйте и отправьте работодателю:',txt);ok=true;}}
  if(ok){s.joined=true;put(KEY,s);draw(p);}
}
function main(p){draw(p);}
function draw(p){
  $('#out').hidden=false;
  const T=[['home','Главная'],['docs','Документы'],['vac','Отпуск'],['data','Данные']];
  say(`<nav class="seg" role="tablist">${T.map(x=>`<button type="button" role="tab" data-tab="${x[0]}" aria-selected="${x[0]===tab}">${x[1]}</button>`).join('')}</nav>`+(tab==='home'?homeTab(p):tab==='docs'?docsTab(p):tab==='data'?dataTab(p):vacTab(p)));
  bindVac(p);bindData(p);window.scrollTo(0,0);
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-go],[data-doc],[data-flow],[data-joined]');if(!t)return;const s=get(KEY,null);if(!s)return;
  if(t.dataset.joined){return sendJoined(s);}
  if(t.dataset.tab){tab=t.dataset.tab;draw(s.p);}
  if(t.dataset.go){tab=t.dataset.go;draw(s.p);}
  if(t.dataset.flow!=null){flow=t.dataset.flow||null;if(!flow){up={};fields={};}draw(s.p);}
  if(t.dataset.doc!=null){const x=s.p.docs[+t.dataset.doc];$('#docT').textContent=x.title;$('#docB').innerHTML=x.html;$('#doc').showModal();}
});
$('#docX').onclick=()=>$('#doc').close();$('#docP').onclick=()=>window.print();
$('#out').onclick=()=>{if(confirm('Выйти из кабинета на этом устройстве? Чтобы войти снова, понадобятся ссылка и код.')){localStorage.removeItem(KEY);pending=null;welcome();$('#out').hidden=true;}};
const m=/^#m=([\w-]+)/.exec(location.hash);
if(m){pending=m[1];ask();}else if(!stored())welcome();
})();
