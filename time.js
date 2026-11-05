/* Страница «График смен»: сетка на компьютере, день за днём на телефоне. Логика — schedule.js */
(function(){
const R=window.SHTATKA_HR,C=window.SHTATKA_SCH,UI=window.SHTATKA_UI,d=R.d,esc=UI.esc,toast=UI.toast;
const $=s=>document.querySelector(s);
const DN=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MN=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
let at=d.today(),sel=d.today(),mob=matchMedia('(max-width:700px)').matches;
const dm=ds=>{const x=d.D(ds);return x.getDate()+' '+MN[x.getMonth()];};
const wd=ds=>DN[(d.D(ds).getDay()+6)%7];
const fmtH=h=>(Math.round(h*10)/10).toLocaleString('ru-RU');
const ti=v=>C.types().findIndex(t=>t.id===v);
function cellTxt(e,ds){
  if(R.onSick(e,ds))return {cls:'sick',t:'б/л',dis:true,aria:'больничный'};
  const v=C.cell(e,ds);if(v==='off')return {cls:'off',t:'вых',aria:'выходной'};
  const t=C.typeOf(v);if(t)return {cls:'t'+Math.min(ti(v),3),t:C.short(t),sub:t.name,aria:t.name+' '+C.short(t)};
  return {cls:'',t:'+',aria:'не назначено'};
}
function next(e,ds){
  if(R.onSick(e,ds))return;
  const ids=C.types().map(t=>t.id).concat(['off','']),cur=C.cell(e,ds),i=ids.indexOf(cur);
  C.set(e,ds,ids[(i+1)%ids.length]);
}
function toolbar(days){
  return `<div class="sc-bar"><div class="sc-wk"><button type="button" class="b" data-w="-7" aria-label="Предыдущая неделя">←</button><b>${dm(days[0])} – ${dm(days[6])}</b><button type="button" class="b" data-w="7" aria-label="Следующая неделя">→</button></div>
  <button type="button" class="b" data-act="now">Сегодня</button><span class="grow"></span>
  <button type="button" class="b" data-act="copy">Как на прошлой неделе</button>
  ${C.staff().some(e=>e.workMode==='2/2')?'<button type="button" class="b" data-act="p22">Заполнить 2/2</button>':''}
  <button type="button" class="b" data-act="clear">Очистить неделю</button></div>`;
}
function legend(){return `<div class="sc-legend">${C.types().map((t,i)=>`<span class="sc-c t${Math.min(i,3)}" style="width:auto;min-width:0;min-height:0">${esc(t.name)} ${C.short(t)}</span>`).join('')}<span class="sc-c off" style="width:auto;min-width:0;min-height:0">вых — выходной</span><span class="sc-c sick" style="width:auto;min-width:0;min-height:0">б/л — больничный</span></div>`;}
function warns(list,days){
  const w=[];list.forEach(e=>C.warn(e,days).forEach(m=>w.push(`<div><b>${esc(e.fio.split(' ').slice(0,2).join(' '))}.</b> ${esc(m)}</div>`)));
  const hol=days.filter(C.isHol);
  if(hol.length&&list.some(e=>hol.some(x=>C.typeOf(C.cell(e,x)))))w.push(`<div><b>Праздничный день в графике (${hol.map(x=>dm(x)).join(', ')}).</b> Работа в праздник оплачивается не менее чем в двойном размере или с отгулом (ст. 153 ТК). Не забудьте приказ.</div>`);
  return w.length?`<div class="sc-warn" id="scWarn">${w.join('')}</div>`:'';
}
function dayCount(list,ds){return list.filter(e=>!R.onSick(e,ds)&&C.typeOf(C.cell(e,ds))).length;}
function grid(list,days){
  const t=d.today();
  return `<div class="sc-grid"><table class="sc-t"><thead><tr><th>Сотрудник</th>${days.map(x=>`<th class="${x===t?'today':''}${C.isHol(x)?' hol':''}">${wd(x)}<small>${d.fmt(x).slice(0,5)}${C.isHol(x)?' · праздник':''}</small></th>`).join('')}<th>Часов</th></tr></thead><tbody>
  ${list.map(e=>{const hrs=days.reduce((a,x)=>{const tp=C.typeOf(C.cell(e,x));return a+(tp&&!R.onSick(e,x)?C.hrs(tp):0);},0),bad=C.warn(e,days).length>0;
    return `<tr><td><a class="sc-nm" href="people.html#c=${e.id}&tab=sch" style="text-decoration:none;color:inherit"><b>${esc(e.fio.split(' ').slice(0,2).join(' '))}</b><small>${esc(e.position||'')}</small></a></td>${days.map(x=>{const c=cellTxt(e,x);
      return `<td><button type="button" class="sc-c ${c.cls}${bad&&c.cls&&c.cls[0]==='t'?'':''}" data-e="${e.id}" data-d="${x}" aria-label="${esc(e.fio)}, ${dm(x)}: ${esc(c.aria)}"${c.dis?' disabled':''}>${c.t}</button></td>`;}).join('')}<td><b>${fmtH(hrs)}</b></td></tr>`;}).join('')}
  </tbody><tfoot><tr class="sc-sum"><td>Выходят</td>${days.map(x=>{const n=dayCount(list,x);return `<td class="${n?'':'zero'}">${n}</td>`;}).join('')}<td></td></tr></tfoot></table></div>`;
}
function phone(list,days){
  if(!days.includes(sel))sel=days[0];
  const ids=C.types();
  return `<div class="sc-days" role="tablist">${days.map(x=>{const n=dayCount(list,x);return `<button type="button" role="tab" class="sc-day${n?'':' zero'}${C.isHol(x)?' hol':''}" data-sel="${x}" aria-selected="${x===sel}">${wd(x)}<b>${d.D(x).getDate()}</b><i>${n?n+' чел.':'никого'}</i></button>`;}).join('')}</div>
  <p class="sc-note"><b>${wd(sel)}, ${dm(sel)}</b>${C.isHol(sel)?' · праздничный день':''}. Нажмите на смену, чтобы назначить.</p>
  ${list.map(e=>{const v=C.cell(e,sel),sick=R.onSick(e,sel);
    return `<div class="sc-p"><div><b>${esc(e.fio.split(' ').slice(0,2).join(' '))}</b><small>${esc(e.position||'')}</small></div><div class="sc-opts">${sick?'<button type="button" class="sc-o" disabled>Больничный</button>':
    ids.map(t=>`<button type="button" class="sc-o" data-e="${e.id}" data-d="${sel}" data-v="${t.id}" aria-pressed="${v===t.id}">${esc(t.name)} ${C.short(t)}</button>`).join('')+`<button type="button" class="sc-o" data-e="${e.id}" data-d="${sel}" data-v="off" aria-pressed="${v==='off'}">Выходной</button>`}</div></div>`;}).join('')}`;
}
function typesEditor(){
  return `<details class="blk" id="scTypes"><summary><b>Виды смен</b> <span class="muted">— название и время</span></summary><div class="sc-types">${C.types().map((t,i)=>`<div class="r" data-i="${i}"><input data-f="name" value="${esc(t.name)}" aria-label="Название смены"><input data-f="from" type="time" value="${t.from}" aria-label="Начало"><input data-f="to" type="time" value="${t.to}" aria-label="Конец"><button type="button" class="b" data-del="${i}" aria-label="Удалить смену"${C.types().length<2?' disabled':''}>×</button></div>`).join('')}</div>
  <button type="button" class="b" data-act="addType">Добавить смену</button><p class="sc-note">Смена, которая заканчивается после полуночи, считается как одна смена (например 20:00–08:00).</p></details>`;
}
function hoursBlock(){
  const x=d.D(at),y=x.getFullYear(),m=x.getMonth(),list=C.staff();
  return `<section class="blk sc-hrs"><div class="bh"><h2>Часы за ${['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'][m]}</h2><button type="button" class="b" data-act="csv">Скачать для Excel</button></div>
  <p class="sc-note">Для расчёта зарплаты: ночные часы (22:00–06:00) оплачиваются с повышением, праздничные — не менее чем вдвое. Норма — по 8 часов в рабочий день, для сменной работы сверка идёт за учётный период.</p>
  <div class="tw"><table class="tbl"><thead><tr><th>Сотрудник</th><th>Смен</th><th>Часов</th><th>Норма</th><th>Ночных</th><th>В праздники</th></tr></thead><tbody>${list.map(e=>{const s=C.month(e,y,m);
    return `<tr><td>${esc(e.fio.split(' ').slice(0,2).join(' '))}</td><td>${s.shifts}</td><td>${fmtH(s.hours)}</td><td>${s.norm}</td><td>${fmtH(s.night)}</td><td>${fmtH(s.holHours)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function empty(){
  const o=C.others();
  return `<section class="blk"><div class="bh"><h2>График смен не нужен</h2></div><p>Судя по сфере и режиму работы, у вас рабочая неделя 5/2: все приходят в одни и те же часы. Отдельный график смен не требуется.</p>
  <p class="muted">Если у части людей всё же сменная работа, включите график. Он появится и в карточках сотрудников.</p>
  <button type="button" class="b d" data-act="on">Включить график смен</button></section>`;
}
function render(){
  const E=R.emps();
  $('#hS').textContent='Кто и когда выходит на работу. Нажмите на ячейку, чтобы назначить смену.';
  const demoNote=R.demo()?'<p class="note2">Это пример на вымышленных сотрудниках. Ваши данные появятся после регистрации.</p>':'';
  if(!E.length){$('#hr').innerHTML=demoNote+`<div class="emptyx"><p>График строится по сотрудникам. Сначала примите первого.</p><a class="b d" href="people.html#add">Принять сотрудника</a></div>`;return;}
  if(!C.active()){$('#hr').innerHTML=demoNote+empty();return;}
  const days=C.week(at),list=C.staff();
  if(!list.length){$('#hr').innerHTML=demoNote+`<div class="emptyx"><p>В графике пока никого. Сотрудник попадает сюда, когда ему выбран сменный режим работы или график 2/2. Откройте карточку и включите «В графике смен».</p><a class="b d" href="people.html">К сотрудникам</a></div>`;return;}
  const oth=C.others();
  $('#hr').innerHTML=demoNote+toolbar(days)+legend()+(mob?phone(list,days):grid(list,days))+warns(list,days)+
   (oth.length?`<p class="sc-note">Не в графике (работают по 5/2 или на удалёнке): ${oth.map(e=>esc(e.fio.split(' ').slice(0,2).join(' '))).join(', ')}. Чтобы добавить, откройте карточку сотрудника.</p>`:'')+
   typesEditor()+hoursBlock();
}
function csv(){
  const x=d.D(at),y=x.getFullYear(),m=x.getMonth(),list=C.staff();
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows=[['ФИО','Должность','Смен','Часов','Норма','Ночных часов','Часов в праздники']].concat(list.map(e=>{const s=C.month(e,y,m);return [e.fio,e.position,s.shifts,s.hours,s.norm,s.night,s.holHours];}));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download='chasy-'+y+'-'+String(m+1).padStart(2,'0')+'.csv';document.body.appendChild(a);a.click();a.remove();toast('Файл скачан: откройте в Excel.');
}
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t)return;
  if(t.dataset.w){at=d.addDays(at,+t.dataset.w);sel=C.week(at)[0];render();return;}
  if(t.dataset.sel){sel=t.dataset.sel;render();return;}
  if(t.dataset.v){const e=R.get(t.dataset.e);C.set(e,t.dataset.d,C.cell(e,t.dataset.d)===t.dataset.v?'':t.dataset.v);render();return;}
  if(t.classList.contains('sc-c')&&t.dataset.e){next(R.get(t.dataset.e),t.dataset.d);const y=window.scrollY;render();window.scrollTo(0,y);return;}
  if(t.dataset.del!=null){const v=C.types().slice();const [gone]=v.splice(+t.dataset.del,1);C.saveTypes(v);R.state().sch.cells&&Object.keys(R.state().sch.cells).forEach(k=>{if(R.state().sch.cells[k]===gone.id)delete R.state().sch.cells[k];});R.save();render();document.getElementById('scTypes').open=true;return;}
  const a=t.dataset.act;if(!a)return;
  if(a==='now'){at=d.today();sel=d.today();render();}
  else if(a==='copy'){const n=C.copyWeek(d.addDays(at,-7),at);toast(n?'Скопировано смен: '+n+'.':'На прошлой неделе ничего не назначено.');render();}
  else if(a==='clear'){if(t.dataset.arm){C.clearWeek(at);render();toast('Неделя очищена.');}else{t.dataset.arm='1';t.textContent='Точно очистить?';setTimeout(()=>{t.dataset.arm='';t.textContent='Очистить неделю';},3000);}}
  else if(a==='p22'){const n=C.fill22(C.week(at)[0],4);toast('График 2/2 заполнен на 4 недели.');render();}
  else if(a==='on'){C.enable(true);render();}
  else if(a==='csv')csv();
  else if(a==='addType'){const v=C.types().slice();v.push({id:'t'+Date.now().toString(36),name:'Смена '+(v.length+1),from:'09:00',to:'18:00'});C.saveTypes(v);render();document.getElementById('scTypes').open=true;}
});
document.addEventListener('change',ev=>{
  const i=ev.target.closest('.r[data-i]');if(!i||!ev.target.dataset.f)return;
  const v=C.types().map(t=>Object.assign({},t));const t=v[+i.dataset.i];t[ev.target.dataset.f]=ev.target.value||t[ev.target.dataset.f];C.saveTypes(v);render();document.getElementById('scTypes').open=true;
});
matchMedia('(max-width:700px)').addEventListener('change',e=>{mob=e.matches;render();});
render();
})();
