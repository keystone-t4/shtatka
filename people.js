/* Раздел «Люди»: принять нового, загрузить действующих по договорам, бесплатная проверка шаблона договора.
   Пока сервера нет, сотрудники хранятся в этом браузере. Данные сотрудников вносятся только после подтверждения компании. */
(function(){
const H=window.SHTATKA_HOME,UI=window.SHTATKA_UI,esc=UI.esc,toast=UI.toast;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cfg=window.SHTATKA_CONFIG||{};
const CON={open:'Трудовой бессрочный',fixed:'Трудовой срочный',gph:'Договор ГПХ',self:'Самозанятый'};
const PLU=(n,a,b,c)=>{const m=n%100,d=n%10;return (m>10&&m<20)?c:d===1?a:(d>=2&&d<=4)?b:c;};
const real=H.real();
let bypass=false;try{bypass=sessionStorage.getItem('shtatka-demo-bypass')==='1'}catch(e){}
const canEdit=()=>!real||H.verified()||bypass;
let kind='new',upMode='upload',pending=null;

function render(){
  const e=H.employees(),n=e.length;
  $('#gate').hidden=!real||H.verified()||bypass;
  $('#empty').hidden=n>0;$('#list').hidden=!n;$('#pActs').hidden=!n;
  $('#pSub').textContent=n?('В штате '+n+' '+PLU(n,'человек','человека','человек')+'.'):'Сотрудников пока нет. Выберите, с чего начать.';
  const units=H.units();
  $('#list').innerHTML=e.map(x=>{const p=x.fio.split(/\s+/);const u=units.find(y=>y.id===x.unit);
    return `<div class="er"><span class="av">${esc(((p[0]||'')[0]||'')+((p[1]||'')[0]||''))}</span>
     <div><b>${esc(x.fio)}</b><small>${esc(x.position||'')}${u?' · '+esc(u.name):''}</small></div>
     <div class="hide-m"><small>${esc(CON[x.contract]||'')}${x.start?' · '+(x.kind==='existing'?'работает с ':'выход ')+new Date(x.start).toLocaleDateString('ru-RU'):''}</small></div>
     <span class="pill ${x.kind==='existing'?'info':'warn'}">${x.kind==='existing'?'проверить договор':'ждёт анкету'}</span>
     <button type="button" class="x" data-del="${x.id}">Удалить</button></div>`;}).join('');
}
function open(id){const d=$(id);if(d.showModal)d.showModal();else d.setAttribute('open','');}
function close(d){if(d.open)d.close();}
function want(what){
  if(what==='check'){openUpload('check');return;}
  if(!canEdit()){pending=what;$('#gDemo').hidden=$('#gSkip').hidden=!!cfg.apiUrl;open('#dGate');return;}
  if(what==='add')openAdd('new');else openUpload('upload');
}
function openAdd(k){
  kind=k;$$('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===k));
  $('#eStartL').textContent=k==='existing'?'Работает с':'Дата выхода';
  $('#eNote').textContent=k==='existing'?'Данные возьмите из его договора. Паспорт и адрес сотрудник проверит сам по ссылке.':'Паспорт, адрес и реквизиты сотрудник внесёт сам по ссылке с телефона.';
  $('#eUnit').innerHTML='<option value="">Без подразделения</option>'+H.units().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  $('#eUnit').closest('.fld').hidden=!H.units().length;
  if(!$('#eStart').value)$('#eStart').value=new Date().toISOString().slice(0,10);
  $('#eErr').hidden=true;open('#dAdd');$('#eFio').focus();
}
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

document.addEventListener('click',e=>{
  const t=e.target.closest('button,a');if(!t)return;
  if(t.dataset.open){want(t.dataset.open);return;}
  if(t.hasAttribute('data-close')){close(t.closest('dialog'));return;}
  if(t.dataset.kind){openAdd(t.dataset.kind);return;}
  if(t.dataset.del){if(t.dataset.arm){H.removeEmployee(t.dataset.del);render();}else{t.dataset.arm='1';t.textContent='Точно удалить?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='Удалить';}},3000);}return;}
  if(t.id==='gSkip'){bypass=true;try{sessionStorage.setItem('shtatka-demo-bypass','1')}catch(x){}close($('#dGate'));render();if(pending)want(pending);return;}
  if(t.id==='upManual'){close($('#dUp'));openAdd('existing');return;}
});
$('#fAdd').addEventListener('submit',e=>{
  e.preventDefault();const fio=$('#eFio').value.trim(),pos=$('#ePos').value.trim();
  if(fio.split(/\s+/).length<2||!pos){$('#eErr').hidden=false;$('#eErr').textContent=!pos&&fio?'Укажите должность.':'Напишите фамилию и имя.';return;}
  H.addEmployee({fio,position:pos,contract:$('#eCon').value,start:$('#eStart').value,unit:$('#eUnit').value,phone:$('#ePhone').value.trim(),kind});
  ['#eFio','#ePos','#ePhone'].forEach(s=>$(s).value='');close($('#dAdd'));render();
  toast(kind==='existing'?'Сотрудник добавлен. Проверку договора подключим вместе с сервером.':'Сотрудник добавлен. Ссылку на анкету отправим, когда подключим сервер.');
});
$('#upFiles').addEventListener('change',e=>gotFiles(e.target.files));
const drop=$('#drop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');gotFiles(e.dataTransfer.files);});
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));

render();
const hash=location.hash.slice(1);if(hash==='add'||hash==='upload'||hash==='check')setTimeout(()=>want(hash),200);
})();
