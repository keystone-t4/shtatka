/* Анкета сотрудника по ссылке: человек сам фотографирует паспорт, СНИЛС и документы по должности.
   Ссылка: anketa.html#i=<приглашение в base64url> (без сервера: всё нужное лежит в самой ссылке) или anketa.html?t=<токен> (с сервером: GET {apiUrl}/anketa/{токен}).
   Отправка: POST {apiUrl}/anketa/{id}; без сервера — в «почтовый ящик» этого браузера и файлом для пересылки работодателю. */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cfg=window.SHTATKA_CONFIG||{},PP=window.SHTATKA_PASSPORT,DZ=window.SHTATKA_DOSSIER;
let tt;const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),3600);};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const DOC={
 med:['Медицинская книжка или медзаключение','Без неё не допускают к смене: работа с продуктами, людьми или транспортом.',true,'Нет, оформлю'],
 drv:['Водительское удостоверение','Подтверждает право управлять транспортом нужной категории.',true,'Нет'],
 edu:['Диплом или удостоверение о квалификации','Подтверждает допуск к этой работе.',true,'Нет'],
 crim:['Справка о несудимости','Нужна для работы с детьми. Заказать можно на Госуслугах.',false,'Нет, закажу'],
 drug:['Справка о наказании за наркотики','Нужна для работы с детьми. Заказать можно на Госуслугах.',false,'Нет, закажу'],
 mil:['Военный билет или удостоверение призывника','Работодатель обязан вести воинский учёт.',false,'У меня нет'],
 etk:['Трудовая книжка или сведения о трудовой деятельности','Нужны для стажа. Сведения (СТД-Р) можно скачать на Госуслугах.',false,'Это моя первая работа'],
 fpass:['Национальный паспорт и перевод','Страница с фото. Нотариальный перевод можно добавить позже.',false,''],
 patent:['Патент','Страница с фото и страница с регионом и профессией.',true,'Патента ещё нет'],
 permit:['Разрешение на работу','',true,'Нет'],
 rvp:['РВП или вид на жительство','',true,'Нет'],
 migcard:['Миграционная карта','',true,''],
 reg:['Уведомление о прибытии (регистрация)','',true,''],
 dms:['Полис ДМС','Для высококвалифицированных специалистов.',true,'Нет']
};
const files={};         // key → [{name,mime,blob}]
let inv=null,sex='m';
const b64u=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(escape(atob(s)));};
async function loadInvite(){
  const h=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search);
  try{
    if(h.get('i'))return JSON.parse(b64u(h.get('i')));
    if(q.get('t')&&cfg.apiUrl){const r=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/anketa/'+encodeURIComponent(q.get('t')));if(!r.ok)return null;return await r.json();}
  }catch(e){}
  return null;
}
function tile(k,t){return `<div class="up" data-up="${k}"><b>${esc(t)}</b><div class="up-b"><label class="b cam">Снять<input type="file" accept="image/*" capture="environment" data-file="${k}" hidden></label><label class="b">Из галереи<input type="file" accept="image/*,application/pdf" data-file="${k}" hidden></label></div><small class="st" id="st_${k}"></small></div>`;}
function render(){
  const first=inv.first?', '+inv.first:'';
  $('#hi').textContent='Здравствуйте'+first+'!';
  $('#why').textContent=(inv.org||'Работодатель')+' оформляет вас'+(inv.pos?' на должность «'+inv.pos+'»':'')+'. Заполните анкету сами: это 5–7 минут. Паспорт можно просто сфотографировать.';
  $('#orgName').textContent=inv.org||'работодатель';
  $('#boxRu').hidden=!!inv.foreign;$('#boxFor').hidden=!inv.foreign;
  const bring=['паспорт (оригинал)'].concat((inv.need||[]).filter(k=>DOC[k]).map(k=>DOC[k][0].toLowerCase()));
  $('#bring').innerHTML='<li><b>В день выхода возьмите оригиналы:</b> '+esc(bring.join(', '))+'.</li>';
  const need=(inv.need||[]).filter(k=>DOC[k]);
  $('#boxDocs').hidden=!need.length;
  $('#docsWhy').textContent='Эти документы нужны именно для этой работы. Если чего-то нет, отметьте — работодатель подскажет, что делать.';
  $('#docs').innerHTML=need.map(k=>{const d=DOC[k];return `<div class="doc" data-doc="${k}"><div><b>${esc(d[0])}</b>${d[1]?`<br><small>${esc(d[1])}</small>`:''}</div>
    <div class="up-b"><label class="b cam">Снять<input type="file" accept="image/*" capture="environment" data-file="${k}" hidden></label><label class="b">Из галереи<input type="file" accept="image/*,application/pdf" data-file="${k}" hidden></label></div><small class="st" id="st_${k}"></small>
    ${d[2]?`<label class="fld">Действует до<input type="date" data-until="${k}"></label>`:''}
    ${d[3]?`<label class="chk"><input type="checkbox" data-none="${k}"> <span>${esc(d[3])}</span></label>`:''}</div>`;}).join('');
  if(inv.foreign)$('#forTiles').innerHTML=need.length?'':tile('fpass','Национальный паспорт, страница с фото');
  if(!matchMedia('(pointer:coarse)').matches)$$('.cam').forEach(x=>x.hidden=true);
  if(!PP.url())$('#ocrNote').textContent='Сфотографируйте страницы паспорта, а данные введите ниже. Работодатель сверит их с фото.';
  $('#form').hidden=false;
}
/* маски */
$('#pass').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,10);e.target.value=n.length>4?n.slice(0,4)+' '+n.slice(4):n;});
$('#pcode').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,6);e.target.value=n.length>3?n.slice(0,3)+'-'+n.slice(3):n;});
$('#snils').addEventListener('input',e=>{const n=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=[n.slice(0,3),n.slice(3,6),n.slice(6,9)].filter(Boolean).join('-')+(n.length>9?' '+n.slice(9):'');});
const milBox=()=>{const m=$('[data-doc="mil"]');if(m)m.hidden=sex==='f';};
$('#form').addEventListener('click',e=>{const b=e.target.closest('[data-sex]');if(!b)return;sex=b.dataset.sex;$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x===b));milBox();});
const MAP={surname:'#sur',name:'#name',middle:'#mid',birth:'#birth',birthPlace:'#bplace',issueDate:'#pdate',issuedBy:'#pby',code:'#pcode',address:'#addr',regDate:'#adate',snils:'#snils'};
function applyFields(f){let n=0;const put=(s,v)=>{if(!v)return;const el=$(s);el.value=v;el.classList.add('auto');n++;};
  Object.entries(MAP).forEach(([k,s])=>put(s,f[k]));if(f.series||f.number)put('#pass',(f.series||'')+(f.number?' '+f.number:''));
  if(f.sex){sex=f.sex;$$('[data-sex]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.sex===sex));milBox();n++;}return n;}
$('#form').addEventListener('input',e=>e.target.classList&&e.target.classList.remove('auto'));
$('#form').addEventListener('change',async e=>{
  const nn=e.target.closest('[data-none]');if(nn){const box=nn.closest('.doc');box.style.opacity=nn.checked?.6:1;return;}
  const inp=e.target.closest('[data-file]');if(!inp||!inp.files||!inp.files[0])return;
  const k=inp.dataset.file,st=$('#st_'+k),file=inp.files[0];inp.value='';
  st.className='st';st.textContent='Готовим файл…';
  let prep;try{prep=await PP.prepare(file);}catch(x){prep={error:'Не удалось прочитать файл.'};}
  if(prep.error){st.className='st bad';st.textContent=prep.error;return;}
  (files[k]=files[k]||[]).push({name:prep.name,mime:prep.mime==='PDF'?'application/pdf':'image/jpeg',blob:prep.blob});
  st.className='st ok';st.textContent='Фото приложено ('+files[k].length+')';
  if(['main','reg','snils'].includes(k)&&PP.url()){
    st.textContent='Приложено. Читаем данные…';const r=await PP.recognize(k,prep);prep.content=null;
    if(r.ok&&!r.demo){const n=applyFields(r.fields||{});st.className='st '+(n?'ok':'bad');st.textContent=n?'Заполнено полей: '+n+'. Проверьте подсвеченные.':'Данные не нашли: введите вручную.';}
    else{st.className='st ok';st.textContent='Приложено. Данные введите вручную.';}
  }
});
const err=t=>{$('#err').hidden=!t;$('#err').textContent=t||'';if(t)$('#err').scrollIntoView({block:'center',behavior:'smooth'});};
const val=s=>$(s).value.trim();
function collect(){
  const ru=!inv.foreign,pn=val('#pass').replace(/\D/g,'');
  const person=ru?{surname:val('#sur'),name:val('#name'),middle:val('#mid'),sex,birth:val('#birth'),birthPlace:val('#bplace'),series:pn.slice(0,4),number:pn.slice(4,10),issueDate:val('#pdate'),issuedBy:val('#pby'),code:val('#pcode'),regAddress:val('#addr'),regDate:val('#adate')}
   :{surname:val('#fsur'),name:val('#fname'),middle:val('#fmid'),birth:val('#fbirth'),country:val('#fcountry')};
  Object.assign(person,{snils:val('#snils'),noSnils:$('#noSnils').checked,innP:val('#inn').replace(/\D/g,''),phone:val('#phone'),email:val('#mail')});
  const docs={};
  (inv.need||[]).filter(k=>DOC[k]).forEach(k=>{const none=$(`[data-none="${k}"]`),u=$(`[data-until="${k}"]`);
    docs[k]={state:(files[k]||[]).length?'copy':(none&&none.checked?'none':'skip'),until:u?u.value:''};});
  return {person,docs};
}
function snilsOk(v){return !v||(PP.snilsOk&&PP.snilsOk(v));}
const rd=blob=>new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.readAsDataURL(blob);});
$('#form').addEventListener('submit',async e=>{
  e.preventDefault();err('');
  if(!$('#cons').checked)return err('Поставьте галочку согласия: без него мы не можем принять данные.');
  const {person,docs}=collect();
  if(!person.surname||!person.name)return err('Напишите фамилию и имя.');
  if(!person.birth)return err('Укажите дату рождения.');
  if(!inv.foreign&&(person.series+person.number).length!==10)return err('Серия и номер паспорта — 10 цифр. Например, 4012 345678.');
  if(!person.phone||person.phone.replace(/\D/g,'').length<10)return err('Введите телефон, чтобы работодатель мог связаться.');
  if(!snilsOk(person.snils))return err('СНИЛС: в номере ошибка. Проверьте 11 цифр или оставьте пустым.');
  if(person.innP&&person.innP.length!==12)return err('ИНН физлица — 12 цифр или оставьте пустым.');
  const b=$('#send');b.disabled=true;b.textContent='Отправляем…';
  const payload={v:1,inviteId:inv.id,empId:inv.emp||null,at:new Date().toISOString(),consent:{given:true,at:new Date().toISOString(),version:cfg.docsVersion||''},foreign:!!inv.foreign,person,docs};
  const fl={};for(const [k,arr] of Object.entries(files)){fl[k]=[];for(const f of arr)fl[k].push({name:f.name,mime:f.mime,b64:await rd(f.blob)});}
  payload.files=fl;
  let sent=false,fileBlob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  if(cfg.apiUrl&&inv.id){try{const r=await fetch(cfg.apiUrl.replace(/\/$/,'')+'/anketa/'+encodeURIComponent(inv.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});sent=r.ok;}catch(x){}
    if(!sent){b.disabled=false;b.textContent='Отправить работодателю';return err('Не получилось отправить: нет связи с сервером. Попробуйте ещё раз через минуту.');}}
  else{try{const m=await DZ.putFile(fileBlob,'anketa');const ix=JSON.parse(localStorage.getItem('shtatka-anketa-inbox')||'[]');ix.push({fid:m.id,name:[person.surname,person.name].join(' '),at:payload.at,inviteId:inv.id});localStorage.setItem('shtatka-anketa-inbox',JSON.stringify(ix));}catch(x){}}
  $('#form').hidden=true;$('#done').hidden=false;
  $('#doneText').textContent=sent?'Анкета отправлена. Возьмите в день выхода оригиналы документов — работодатель с вами свяжется.':'Анкета сохранена. Пока сервер не подключён, передайте её работодателю файлом ниже.';
  $('#doneFile').hidden=sent;
  const name='anketa-'+(person.surname||'sotrudnik')+'.shtatka.json';
  $('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(fileBlob);a.download=name;document.body.appendChild(a);a.click();a.remove();};
  $('#share').onclick=async()=>{try{const f=new File([fileBlob],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:'Анкета'});else $('#save').click();}catch(x){}};
  window.scrollTo({top:0});
});
(async()=>{inv=await loadInvite();
  if(!inv||(inv.exp&&inv.exp<new Date().toISOString().slice(0,10))){$('#bad').hidden=false;return;}
  render();})();
})();
