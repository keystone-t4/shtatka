/* Регистрация «Штатки»: ИНН → о себе и согласия → код из СМС → кабинет создан и подтверждение компании.
   Без apiUrl в config.js работает в демо-режиме: заявка хранится в браузере. */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cfg=window.SHTATKA_CONFIG||{};
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ROLES={head:'Руководитель',ip:'Индивидуальный предприниматель',hr:'Кадровик',acc:'Бухгалтер',manager:'Управляющий',admin:'Администратор',other:'Другое'};
let tt;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),3600);}
let company=null;

/* почта поддержки — из config.js */
const mail=cfg.supportEmail||'';
['#takenMail','#selfMail'].forEach(s=>{const a=$(s);if(mail)a.href='mailto:'+mail;else a.addEventListener('click',e=>{e.preventDefault();toast('Адрес поддержки появится после запуска. Сейчас пишите на почту из реквизитов в оферте.');});});

/* переключение экранов */
function show(id){
  ['f1','f2','f3','done'].forEach(x=>$('#'+x).hidden=(x!==id));
  const n={f1:1,f2:2,f3:3,done:4}[id];
  [1,2,3].forEach(i=>{$('#st'+i).className=i<n?'done':(i===n?'on':'');});
  $('#sideAfter').hidden=id==='done';$('#sideWhy').hidden=id!=='done';
  window.scrollTo({top:0,behavior:'smooth'});
  const f=$('#'+id).querySelector('input:not([type=checkbox]),select');if(f&&id!=='done'&&!f.value)f.focus({preventScroll:true});
}

/* шаг 1: ИНН */
const C=window.SHTATKA_COMPANY,innOk=C.innOk;
const taken=inn=>get('shtatka-registrations',[]).some(r=>r&&r.company&&r.company.inn===inn);
$('#sampleInn').addEventListener('click',()=>{$('#inn').value='7812345675';$('#inn').focus();});
$('#inn').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,12);['#company','#next1','#err1','#taken'].forEach(s=>$(s).hidden=true);});
function fillCompany(d){
  company=d;$('#coName').textContent=d.name;$('#coMeta').textContent=d.meta;$('#coAddr').textContent=d.addr||'';$('#coHead').textContent=d.head;
  const day=new Date(d.checkedAt||Date.now()).toLocaleDateString('ru-RU');
  $('#coTag').textContent=d.demo?'Пример реквизитов · демо-режим':'Найдено: '+(d.sources||['ЕГРЮЛ']).join(', ')+' · '+day;$('#coTag').classList.toggle('demo',!!d.demo);
  $('#company').hidden=false;
  if(taken(d.inn)){$('#taken').hidden=false;$('#next1').hidden=true;return;}
  $('#next1').hidden=false;$('#next1').focus();
}
const ERR={not_found:'Компания с таким ИНН не найдена в ЕГРЮЛ/ЕГРИП. Проверьте цифры.',offline:'Не удалось получить данные из ЕГРЮЛ. Проверьте интернет и попробуйте ещё раз.'};
$('#f1').addEventListener('submit',async e=>{
  e.preventDefault();const v=$('#inn').value.trim();$('#err1').hidden=true;
  if(!innOk(v)){$('#err1').hidden=false;$('#err1').textContent=v.length?'Проверьте ИНН: в цифрах ошибка. У компании 10 цифр, у ИП 12.':'Введите ИНН: 10 цифр для ООО или 12 для ИП.';return;}
  const b=$('#findBtn');b.disabled=true;b.textContent='Ищем…';
  const r=await C.lookup(v);
  b.disabled=false;b.textContent='Найти';
  if(!r.ok){$('#err1').hidden=false;$('#err1').textContent=ERR[r.reason]||ERR.offline;return;}
  const c=r.company;
  if(!C.active(c)){$('#err1').hidden=false;$('#err1').textContent='По данным ЕГРЮЛ компания '+(C.STATUS_RU[c.status]||'не действует')+(c.endDate?' с '+c.endDate:'')+'. Зарегистрировать её нельзя.';return;}
  fillCompany({...c,meta:c.demo?(c.ip?'ИНН '+v+' · ОГРНИП 3XXXXXXXXXXXXXX':'ИНН '+v+' · ОГРН 1XXXXXXXXXXXX · КПП 78XXXXXXX'):C.meta(c),
    addr:c.address,head:C.head(c)||(c.ip?'Индивидуальный предприниматель':''),headName:c.headName||''});
});
$('#next1').addEventListener('click',()=>{$('#role').value=company&&company.ip?'ip':'head';roleNote();show('f2');});

/* шаг 2: о себе */
const norm=s=>(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z\s-]/g,'').trim().split(/\s+/).slice(0,2).join(' ');
function roleNote(){
  const r=$('#role').value,n=$('#roleNote'),fio=$('#fio').value.trim();
  n.className='note';n.hidden=false;
  if((r==='head'||r==='ip')&&company&&company.headName&&fio.split(/\s+/).length>=2&&norm(fio)!==norm(company.headName)){
    n.classList.add('warn');n.textContent='По ЕГРЮЛ руководитель — '+company.headName+'. Если это не вы, выберите свою должность.';return;}
  if(r==='head'||r==='ip'){n.hidden=true;return;}
  n.textContent='Сотрудник тоже может зарегистрироваться. Компанию потом подтвердит руководитель.';
}
$('#role').addEventListener('change',roleNote);$('#fio').addEventListener('blur',roleNote);
const upd=()=>{$('#next2').disabled=!($('#cOffer').checked&&$('#cPd').checked);};
['#cOffer','#cPd'].forEach(s=>$(s).addEventListener('change',upd));
$('#back2').addEventListener('click',()=>show('f1'));
$('#f2').addEventListener('submit',e=>{
  e.preventDefault();
  const fio=$('#fio').value.trim(),ph=$('#phone').value.replace(/\D/g,''),em=$('#email').value.trim();let m='';
  if(fio.split(/\s+/).length<2)m='Напишите фамилию и имя.';else if(ph.length<10||ph.length>11)m='Проверьте телефон: нужно 10–11 цифр.';else if(!/^\S+@\S+\.\S+$/.test(em))m='Проверьте почту.';
  $('#err2').hidden=!m;$('#err2').textContent=m;if(m)return;
  $('#phoneOut').textContent=$('#phone').value.trim();show('f3');startTimer();
});

/* шаг 3: код */
let t=null;
function startTimer(){let s=59;clearInterval(t);const el=$('#timer');el.textContent='Отправить код ещё раз через '+s+' с';
  t=setInterval(()=>{s--;if(s<=0){clearInterval(t);el.innerHTML='<button class="lnk" type="button" id="resend">Отправить код ещё раз</button>';$('#resend').addEventListener('click',startTimer);}else el.textContent='Отправить код ещё раз через '+s+' с';},1000);}
const cells=$$('#code input');
cells.forEach((c,i)=>{
  c.addEventListener('input',()=>{c.value=c.value.replace(/\D/g,'').slice(0,1);if(c.value&&cells[i+1])cells[i+1].focus();});
  c.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!c.value&&cells[i-1])cells[i-1].focus();});
  c.addEventListener('paste',e=>{const d=(e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,4);if(d.length){e.preventDefault();d.split('').forEach((x,j)=>{if(cells[j])cells[j].value=x;});}});
});
if(cfg.apiUrl)$('#smsHint').hidden=true;
$('#back3').addEventListener('click',()=>{clearInterval(t);show('f2');});
$('#f3').addEventListener('submit',async e=>{
  e.preventDefault();const code=cells.map(c=>c.value).join('');
  if(code.length<4){$('#err3').hidden=false;$('#err3').textContent='Введите все 4 цифры кода.';return;}
  const now=new Date().toISOString(),v=cfg.docsVersion;
  const payload={company:company||{inn:$('#inn').value},
    contact:{fio:$('#fio').value.trim(),role:$('#role').value,roleTitle:ROLES[$('#role').value],phone:$('#phone').value.trim(),email:$('#email').value.trim()},
    smsCode:code,
    consents:{offer:{given:$('#cOffer').checked,at:now,version:v},personalData:{given:$('#cPd').checked,at:now,version:v},ads:{given:$('#cAds').checked,at:now,version:v}},
    verification:{status:'pending'},userAgent:navigator.userAgent};
  if(cfg.apiUrl){
    try{const r=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(r.status===409){$('#err3').hidden=false;$('#err3').textContent='Эта компания уже зарегистрирована. Попросите доступ у администратора кабинета.';return;}
      if(!r.ok)throw new Error(r.status);
    }catch(err){$('#err3').hidden=false;$('#err3').textContent='Не получилось создать кабинет: сервер не ответил. Попробуйте ещё раз через минуту.';return;}
  }else{const a=get('shtatka-registrations',[]);a.push(payload);put('shtatka-registrations',a);}
  const pc=payload.company;
  put('shtatka-session',{company:pc.name||'',inn:pc.inn,co:{ip:!!pc.ip,okved:pc.okved||null,okvedName:pc.okvedName||null,msp:pc.msp==null?null:pc.msp,taxSystem:pc.taxSystem||null,sources:pc.sources||[],checkedAt:pc.checkedAt||null,demo:!!pc.demo},fio:payload.contact.fio,role:payload.contact.role,at:now,verified:false});
  clearInterval(t);$('#err3').hidden=true;
  openDone(true);
});

/* готово: подтверждение компании */
function openDone(fresh){
  const s=get('shtatka-session',{})||{};
  $('#doneCo').textContent=s.company||'компанию';
  const first=(s.fio||'').split(/\s+/)[1];
  $('#doneTitle').textContent=fresh?((first?first+', к':'К')+'абинет создан'):'Подтверждение компании';
  const isHead=s.role==='head'||s.role==='ip';
  $('#sendBox').hidden=isHead;
  if(s.verified){$('#vStatus').textContent='Компания подтверждена';$('#vStatus').classList.add('ok');}
  show('done');
}
/* подтверждение подписью (КЭП): server/esign.mjs проверяет сертификат, центр, ИНН и ОГРН по ЕГРЮЛ */
const E=window.SHTATKA_ESIGN;
const kst=(t,cls)=>{const e=$('#kepSt');e.hidden=!t;e.textContent=t||'';e.className='small kep-st'+(cls?' '+cls:'');};
function markVerified(r){
  const s=get('shtatka-session',{})||{};
  put('shtatka-session',Object.assign(s,{verified:true,verifiedBy:{method:'kep',kind:r.identity.kind,fio:r.identity.fio,thumbprint:r.identity.thumbprint,at:new Date().toISOString()},kepToken:r.token}));
  $('#vStatus').textContent='Компания подтверждена';$('#vStatus').classList.add('ok');$('#mchd').hidden=true;
}
$('#kepBtn').addEventListener('click',async()=>{
  const s=get('shtatka-session',{})||{},b=$('#kepBtn');
  if(!s.inn){toast('Сначала пройдите регистрацию.');return;}
  b.disabled=true;kst('Ждём подпись… плагин попросит ПИН-код токена.');
  const r=await E.run('register',{inn:s.inn});b.disabled=false;
  if(!r.ok){kst(r.message,'bad');return;}
  if(r.confirmed){markVerified(r);kst('Подпись принята: '+r.identity.fio+(r.identity.title?', '+r.identity.title:'')+'. Данные совпали с ЕГРЮЛ.','ok');toast('Компания подтверждена.');return;}
  put('shtatka-session',Object.assign(s,{kepIdentity:{fio:r.identity.fio,kind:r.identity.kind,thumbprint:r.identity.thumbprint,at:new Date().toISOString()}}));
  kst('Личность подтверждена: '+r.identity.fio+'. Чтобы подписывать за компанию, нужна доверенность.','ok');$('#mchd').hidden=false;
});
$('#mchdFiles').addEventListener('change',async e=>{
  const fl=[...e.target.files];if(!fl.length)return;e.target.value='';
  const xml=fl.find(f=>/\.xml$/i.test(f.name)),sig=fl.find(f=>/\.(sig|p7s|sgn|bin)$/i.test(f.name));
  if(!xml||!sig){$('#mchdSt').textContent='Нужны оба файла: доверенность .xml и подпись руководителя (.sig, .p7s или .sgn).';return;}
  const txt=await xml.text(),inn=((get('shtatka-session',{})||{}).inn)||'';
  if(inn&&!txt.includes(inn)){$('#mchdSt').textContent='В доверенности нет ИНН вашей компании ('+inn+'). Проверьте, тот ли файл.';return;}
  const s=get('shtatka-session',{})||{};put('shtatka-session',Object.assign(s,{mchd:{xml:xml.name,sig:sig.name,at:new Date().toISOString(),status:'pending'}}));
  $('#mchdSt').textContent='Доверенность принята и ждёт проверки в реестре ФНС. Подтверждение компании придёт после проверки.';
});
$('#kepLogin').addEventListener('click',async()=>{
  const r=await E.run('login');if(!r.ok){toast(r.message);return;}
  const inn=r.identity.inn||r.identity.personInn,regs=get('shtatka-registrations',[])||[];
  const hit=regs.find(x=>x&&x.company&&x.company.inn===inn);
  if(hit){const c=hit.company;put('shtatka-session',{company:c.name||'',inn:c.inn,co:{ip:!!c.ip,okved:c.okved||null,msp:c.msp==null?null:c.msp,taxSystem:c.taxSystem||null},fio:hit.contact.fio,role:hit.contact.role,at:new Date().toISOString(),verified:!!r.confirmed,verifiedBy:{method:'kep',fio:r.identity.fio,thumbprint:r.identity.thumbprint,at:new Date().toISOString()},kepToken:r.token});location.href='cabinet.html';return;}
  if(r.identity.inn){$('#inn').value=r.identity.inn;show('f1');toast('Подпись принята: '+r.identity.fio+'. Кабинета с этим ИНН в браузере нет — зарегистрируйтесь, подпись подтвердит компанию.');}
  else toast('Подпись принята, но в ней нет ИНН организации. Введите ИНН компании при регистрации.');
});
$('#copyLink').addEventListener('click',async()=>{
  const url=location.href.split('#')[0]+'#verify';
  try{await navigator.clipboard.writeText(url);toast('Ссылка скопирована. В рабочей версии руководитель увидит по ней вашу заявку и подпишет её.');}
  catch(e){toast('Ссылка: '+url);}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-soon]');if(b){e.preventDefault();toast(b.dataset.soon||'Подключим на следующем шаге');}});
$('#loginLink').addEventListener('click',()=>{const s=get('shtatka-session',null);if(s){location.href='cabinet.html';return;}toast('Вход по коду из СМС подключим вместе с сервером.');});

if(location.hash==='#verify'&&get('shtatka-session',null))openDone(false);

})();
