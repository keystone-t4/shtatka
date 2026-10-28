/* Страница «Настроить главную»: варианты, конструктор, структура компании, оформление. */
(function(){
const {W,GROUPS,TPL,DEMO,UT}=window.SHTATKA_WIDGETS,H=window.SHTATKA_HOME;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const SIZE={s:'s3',m:'s6',l:'s12'},SZ={s:'S',m:'M',l:'L'},FR={s:'¼',m:'½',l:'весь ряд'};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const S=H.state(),DRAFT='shtatka-home-draft';
const jget=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const PLU=(n,a,b,c)=>{const m=n%100,d=n%10;return (m>10&&m<20)?c:d===1?a:(d>=2&&d<=4)?b:c;};
let tt;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),3000);}
H.applyUi();

/* ---------- черновик конструктора ---------- */
let D=null,base=null;     // D — то, что на экране; base — снимок источника для сравнения
const snap=d=>JSON.stringify([d.name,d.demo,d.layout]);
function startDraft(id,keepName){
  const r=H.resolve(id)||H.resolve('tpl:base');
  D={src:r.id,id:r.variant?r.variant.id:null,name:r.builtin?(r.name+', моя версия'):r.name,demo:r.demo,layout:JSON.parse(JSON.stringify(r.layout))};
  base=snap({name:D.name,demo:D.demo,layout:r.layout});saveDraft();
}
function saveDraft(){jset(DRAFT,{D,base});}
function loadDraft(){const d=jget(DRAFT,null);if(d&&d.D&&Array.isArray(d.D.layout)){D=d.D;D.layout=H.clean(D.layout);base=d.base;if(!DEMO[D.demo]&&D.demo!=='base')D.demo='base';return true;}return false;}
const dirty=()=>snap(D)!==base;

/* ---------- вкладки ---------- */
function tab(name){
  if(!$('#p-'+name))name='variants';
  $$('.pane').forEach(p=>p.hidden=p.id!=='p-'+name);
  $$('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===name));
  if(name==='builder')renderBuilder();
  if(name==='variants')renderVariants();
  if(name==='structure')renderUnits();
  if(name==='menu')renderMenu();
  if(location.hash!=='#'+name)history.replaceState(null,'','#'+name);
  window.scrollTo(0,0);
}

/* ---------- 1. варианты ---------- */
const nameOf=id=>{const r=H.resolve(id);return r?r.name:'—'};
function renderStart(){$('#startName').textContent=nameOf(S.start);}
function renderVariants(){
  renderStart();
  $('#gal').innerHTML=TPL.map(t=>{const on=S.start==='tpl:'+t.id;
    return `<article class="card${on?' on':''}"><button type="button" class="th" data-view="${t.id}" aria-label="Посмотреть вариант «${esc(t.title)}»"><img src="tplshots/${t.id}.jpg" alt="Макет главной: ${esc(t.title)}" loading="lazy"></button>
     <div class="cb">${on?'<span class="tag">Начальный экран</span>':''}<h3>${esc(t.title)}</h3><p class="sub">${esc(t.sub)} · ${t.list.length} ${PLU(t.list.length,'блок','блока','блоков')}</p>
     <div class="acts"><button type="button" class="b" data-view="${t.id}">Посмотреть</button><button type="button" class="b" data-take="tpl:${t.id}">Взять за основу</button><button type="button" class="b l" data-pin="tpl:${t.id}"${on?' disabled':''}>★ Начальным</button></div></div></article>`;}).join('')+
   `<article class="card blank"><div class="th">+</div><div class="cb"><h3>С нуля</h3><p class="sub">Пустая главная: добавьте только то, что нужно вам.</p><div class="acts"><button type="button" class="b d" data-blank>Собрать самому</button></div></div></article>`;
  const m=S.variants;
  $('#mine').innerHTML=m.length?m.map(v=>{const on=S.start==='my:'+v.id;
    const mini=v.layout.map(x=>{const w=W[x.id];return `<i class="${w.tone==='dark'?'d':w.tone==='lamp'?'l':''}" style="grid-column:span ${{s:3,m:6,l:12}[x.size]}"></i>`}).join('');
    return `<article class="card${on?' on':''}"><div class="mini" aria-hidden="true">${mini}</div><div class="cb">${on?'<span class="tag">Начальный экран</span>':''}<h3>${esc(v.name)}</h3><p class="sub">${v.layout.length} ${PLU(v.layout.length,'блок','блока','блоков')} · ${new Date(v.at).toLocaleDateString('ru-RU')}</p>
     <div class="acts"><button type="button" class="b" data-take="my:${v.id}">Править</button><button type="button" class="b l" data-pin="my:${v.id}"${on?' disabled':''}>★ Начальным</button><button type="button" class="b" data-del="${v.id}">Удалить</button></div></div></article>`;}).join('')
   :'<p class="lab">Пока пусто. Возьмите готовый вариант за основу, поправьте и нажмите «Сохранить вариант».</p>';
}
const dlg=$('#dlg');let dlgId=null;
function openView(id){
  const t=TPL.find(x=>x.id===id);if(!t)return;dlgId='tpl:'+id;
  $('#dT').textContent=t.title;$('#dS').textContent=t.sub;$('#dImg').src='tplshots/'+id+'.jpg';
  $('#dList').innerHTML=H.fromTpl(t).map(x=>`<li>${esc(W[x.id].title)} <small>· ${FR[x.size]}</small></li>`).join('');
  $('#dPin').disabled=S.start===dlgId;
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
}
function pin(id){
  if(H.setStart(id)){toast('Начальный экран: «'+nameOf(id)+'». Он откроется при входе в кабинет.');renderVariants();renderBuilder();}
}

/* ---------- 2. конструктор ---------- */
function renderBuilder(){
  if(!D)startDraft(S.start);
  H.units();
  $('#vName').value=D.name;
  $('#vDemo').innerHTML=TPL.map(t=>`<option value="${t.id}"${t.id===D.demo?' selected':''}>${esc(t.title)}</option>`).join('');
  renderPalette();renderCanvas();renderState();
}
function renderState(){
  const d=dirty(),el=$('#bstate');
  el.className='bst'+(d?' dirty':'');
  el.textContent=d?'Есть несохранённые изменения':(D.src&&D.src.startsWith('tpl:')?'Основа: «'+nameOf(D.src)+'»':'Сохранено');
  $('#cnt').textContent='Блоков: '+D.layout.length;
  const us=H.units(),sg=$('#suggest');
  if(us.length>1&&!D.layout.some(x=>x.id==='units')){sg.hidden=false;sg.innerHTML=`<span>У вас ${us.length} ${PLU(us.length,'подразделение','подразделения','подразделений')}. Блок «По подразделениям» покажет, что на каждом из них.</span><button type="button" class="b" data-add="units">Добавить блок</button>`;}
  else sg.hidden=true;
  saveDraft();
}
function renderPalette(){
  const q=$('#pFind').value.trim().toLowerCase();
  $('#pal').innerHTML=GROUPS.map(g=>{
    const ws=Object.values(W).filter(w=>w.g===g&&(!q||w.title.toLowerCase().includes(q)));
    return ws.length?`<h4>${esc(g)}</h4>`+ws.map(w=>{const inn=D.layout.some(x=>x.id===w.id);
      return `<div class="pi2${inn?' in':''}" ${inn?'':`draggable="true" data-new="${w.id}"`}><span>${esc(w.title)}<small>размеры: ${w.sizes.map(s=>SZ[s]).join(' · ')}</small></span><button type="button" ${inn?`data-rm="${w.id}" aria-label="Убрать блок «${esc(w.title)}»" title="Убрать">✓`:`data-add="${w.id}" aria-label="Добавить блок «${esc(w.title)}»" title="Добавить">+`}</button></div>`;}).join(''):'';}).join('')||'<p class="lab">Ничего не найдено</p>';
}
function renderCanvas(){
  const dm=DEMO[D.demo]||{};
  $('#grid').innerHTML=D.layout.length?D.layout.map((x,i)=>{const w=W[x.id],tone=w.tone?' tone-'+w.tone:'',kpi=w.sizes[0]==='s'?' kpi':'';
    const sz=w.sizes.length>1?w.sizes.map(s=>`<button type="button" data-size="${s}" aria-pressed="${x.size===s}" title="Размер ${s==='s'?'малый':s==='m'?'средний':'широкий'}">${SZ[s]}</button>`).join(''):'';
    return `<article class="w ${SIZE[x.size]}${tone}${kpi}" data-id="${x.id}" draggable="true" aria-label="${esc(w.title)}"><div class="wt"><b title="Перетащить: ${esc(w.title)}">⠿</b>${sz}<button type="button" data-move="-1" aria-label="Сдвинуть раньше" ${i===0?'disabled':''}>◀</button><button type="button" data-move="1" aria-label="Сдвинуть позже" ${i===D.layout.length-1?'disabled':''}>▶</button><button type="button" data-del aria-label="Убрать блок">✕</button></div>${w.html({t:D.demo,d:dm})}</article>`;}).join('')
    :'<div class="empty"><b>Здесь пока пусто.</b><br>Добавьте блоки из списка слева или выберите готовый вариант на первой вкладке.</div>';
}
function changed(){renderPalette();renderCanvas();renderState();}
function add(id){if(!W[id]||D.layout.some(x=>x.id===id))return;D.layout.push({id,size:W[id].size});changed();}
function persistVariant(){
  const n=$('#vName').value.trim();
  if(!n){$('#vName').focus();toast('Назовите вариант, чтобы сохранить');return null;}
  D.name=n;const v=H.saveVariant({id:D.id,name:D.name,layout:D.layout,demo:D.demo});
  D.id=v.id;D.src='my:'+v.id;base=snap(D);renderState();renderStart();return v;
}

/* перетаскивание */
let dragId=null,dragNew=null;const grid=$('#grid');
grid.addEventListener('dragstart',e=>{const a=e.target.closest('.w');if(!a)return;dragId=a.dataset.id;a.classList.add('drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(x){}});
$('#pal').addEventListener('dragstart',e=>{const a=e.target.closest('[data-new]');if(!a)return;dragNew=a.dataset.new;e.dataTransfer.effectAllowed='copy';try{e.dataTransfer.setData('text/plain',dragNew)}catch(x){}});
document.addEventListener('dragend',()=>{dragId=dragNew=null;$$('.w,.grid').forEach(w=>w.classList.remove('drag','over'));});
grid.addEventListener('dragover',e=>{if(!dragId&&!dragNew)return;e.preventDefault();const a=e.target.closest('.w');$$('.w.over,.grid.over').forEach(w=>w.classList.remove('over'));if(a&&a.dataset.id!==dragId)a.classList.add('over');else if(!a)grid.classList.add('over');});
grid.addEventListener('drop',e=>{
  if(!dragId&&!dragNew)return;e.preventDefault();const a=e.target.closest('.w');
  if(dragNew){if(!D.layout.some(x=>x.id===dragNew)){const item={id:dragNew,size:W[dragNew].size},to=a?D.layout.findIndex(x=>x.id===a.dataset.id):-1;if(to>-1)D.layout.splice(to,0,item);else D.layout.push(item);changed();}return;}
  if(!a)return;const from=D.layout.findIndex(x=>x.id===dragId),to=D.layout.findIndex(x=>x.id===a.dataset.id);
  if(from>-1&&to>-1&&from!==to){const [m]=D.layout.splice(from,1);D.layout.splice(to,0,m);changed();}
});

/* ---------- 3. структура ---------- */
function renderUnits(){
  $('#exSel').innerHTML=TPL.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('');
  const us=H.units();
  $('#units').innerHTML=us.length?us.map(u=>`<div class="ur" data-u="${u.id}"><input data-uf="name" value="${esc(u.name)}" aria-label="Название" placeholder="Название"><select data-uf="type" aria-label="Тип">${Object.keys(UT).map(k=>`<option value="${k}"${u.type===k?' selected':''}>${UT[k]}</option>`).join('')}</select><input data-uf="staff" type="number" min="0" max="99999" value="${u.staff}" aria-label="Человек" placeholder="Людей"><button type="button" class="b x ud" data-udel="${u.id}" aria-label="Удалить подразделение">✕</button></div>`).join(''):'<p class="lab">Пока ничего нет. Добавьте вручную или подставьте пример.</p>';
  const sum=us.reduce((a,u)=>a+(+u.staff||0),0);
  $('#uSum').textContent=us.length?('Подразделений: '+us.length+' · людей по списку: '+sum):'';
}
let exArmed=false;

/* ---------- 4. меню ---------- */
function renderMenu(){
  $('#mlist').innerHTML=S.menu.map((m,i)=>{const it=H.MENU.find(x=>x.id===m.id);
    return `<div class="mr${m.on?'':' off'}"><label><input type="checkbox" data-mon="${m.id}"${m.on?' checked':''}${it.fixed?' disabled':''}> ${esc(it.title)}${it.href?'':' <small>скоро</small>'}</label>
     <span><button type="button" class="b" data-mmove="-1" data-mid="${m.id}" aria-label="Выше" ${i<=1||it.fixed?'disabled':''}>▲</button><button type="button" class="b" data-mmove="1" data-mid="${m.id}" aria-label="Ниже" ${i===S.menu.length-1||it.fixed?'disabled':''}>▼</button></span></div>`;}).join('');
  $('#stepsShow').checked=!S.onboard.hideChecklist;
}

/* ---------- события ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a');if(!t)return;
  const d=t.dataset;
  if(d.tab){tab(d.tab);return;}
  if(d.view){openView(d.view);return;}
  if(d.take){startDraft(d.take);tab('builder');toast('Вариант открыт в конструкторе');return;}
  if(d.blank!==undefined){D={src:null,id:null,name:'Моя главная',demo:'base',layout:[]};base=snap(D);saveDraft();tab('builder');return;}
  if(d.pin){pin(d.pin);return;}
  if(d.del){if(t.dataset.arm){H.deleteVariant(d.del);if(D&&D.id===d.del){D.id=null;D.src=null;}renderVariants();}else{t.dataset.arm='1';t.textContent='Точно удалить?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='Удалить';}},3000);}return;}
  if(d.add){add(d.add);return;}
  if(d.rm){D.layout=D.layout.filter(x=>x.id!==d.rm);changed();return;}
  const art=t.closest('#grid .w');
  if(art){const i=D.layout.findIndex(x=>x.id===art.dataset.id);
    if(d.size){D.layout[i].size=d.size;changed();return;}
    if(d.move){const j=i+Number(d.move);if(j>=0&&j<D.layout.length){[D.layout[i],D.layout[j]]=[D.layout[j],D.layout[i]];changed();}return;}
    if(t.hasAttribute('data-del')){D.layout.splice(i,1);changed();return;}}
  if(d.mmove){const i=S.menu.findIndex(x=>x.id===d.mid),k=i+Number(d.mmove);if(k>=1&&k<S.menu.length){[S.menu[i],S.menu[k]]=[S.menu[k],S.menu[i]];H.persist();renderMenu();}return;}
  if(d.themeSet){S.ui.theme=d.themeSet;H.persist();syncLook();return;}
  if(d.brandSet){S.ui.brand=d.brandSet;H.persist();syncLook();return;}
  if(d.udel){S.units=S.units.filter(u=>u.id!==d.udel);if(S.scope===d.udel)S.scope=null;H.persist();renderUnits();renderState();return;}
  switch(t.id){
    case 'bSave':{const v=persistVariant();if(v)toast('Вариант «'+v.name+'» сохранён');break;}
    case 'bPin':{
      if(!dirty()&&D.src){pin(D.src);break;}
      const v=persistVariant();if(v)pin('my:'+v.id);break;}
    case 'bReset':{if(D.src&&H.resolve(D.src))startDraft(D.src);else{D.layout=[];D.name='Моя главная';base=snap(D);}renderBuilder();toast('Вернули к основе');break;}
    case 'dX':dlg.close();break;
    case 'dTake':dlg.close();startDraft(dlgId);tab('builder');break;
    case 'dPin':dlg.close();pin(dlgId);break;
    case 'uAdd':S.units.push({id:H.uid(),name:'',type:'point',staff:0});H.persist();renderUnits();{const r=$$('.ur input[data-uf=name]');r[r.length-1].focus();}break;
    case 'exGo':{
      if(S.units.length&&!exArmed){exArmed=true;t.textContent='Заменить текущий список?';setTimeout(()=>{exArmed=false;t.textContent='Подставить пример';},3500);break;}
      exArmed=false;t.textContent='Подставить пример';S.units=H.example($('#exSel').value);S.scope=null;H.persist();renderUnits();toast('Пример подставлен: поправьте названия и числа под себя');break;}
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='vName'){D.name=t.value;renderState();return;}
  if(t.id==='pFind'){renderPalette();return;}
  const row=t.closest('.ur');if(row&&t.dataset.uf){const u=S.units.find(x=>x.id===row.dataset.u);if(!u)return;u[t.dataset.uf]=t.dataset.uf==='staff'?Math.max(0,parseInt(t.value,10)||0):t.value;H.persist();
    const sum=S.units.reduce((a,x)=>a+(+x.staff||0),0);$('#uSum').textContent='Подразделений: '+S.units.length+' · людей по списку: '+sum;}
});
document.addEventListener('change',e=>{
  if(e.target.id==='vDemo'){D.demo=e.target.value;changed();return;}
  if(e.target.dataset.mon){const m=S.menu.find(x=>x.id===e.target.dataset.mon);if(m){m.on=e.target.checked;H.persist();renderMenu();toast(m.on?'Раздел добавлен в меню':'Раздел скрыт из меню');}return;}
  if(e.target.id==='stepsShow'){S.onboard.hideChecklist=!e.target.checked;H.persist();}
});
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
function syncLook(){H.applyUi();$$('[data-theme-set]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.themeSet===S.ui.theme));$$('[data-brand-set]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.brandSet===S.ui.brand));}

if(innerWidth<1100)$('#palD').open=false;
if(!loadDraft())startDraft(S.start);
syncLook();renderStart();
addEventListener('hashchange',()=>tab(location.hash.slice(1)));
tab(location.hash.slice(1)||'variants');
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
