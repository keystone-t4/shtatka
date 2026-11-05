/* Разделы, которые считаются из карточек сотрудников: Документы и сроки, Воинский учёт, Иностранцы, Больничные,
   Зарплата, Архив, Законы и МРОТ. Сами данные не вносятся здесь: они приходят из раздела «Люди» (hr-core.js). */
(function(){
const H=window.SHTATKA_HOME,UI=window.SHTATKA_UI,R=window.SHTATKA_HR,esc=UI.esc,toast=UI.toast;
const $=s=>document.querySelector(s);
const d=R.d,page=document.body.dataset.page;
const rub=n=>Math.round(n).toLocaleString('ru-RU')+' ₽';
const PLU=(n,a,b,c)=>{const m=n%100,k=n%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
const link=(e,tab)=>`people.html#c=${e.id}${tab?'&tab='+tab:''}`;
const nameCell=e=>`<a class="nm" href="${link(e)}"><b>${esc(e.fio)}</b><small>${esc(e.position||'')}</small></a>`;
const empty=t=>`<div class="emptyx"><p>${t}</p><a class="b d" href="people.html#add">Принять сотрудника</a></div>`;
const tbl=(cols,rows)=>`<div class="tw"><table class="tbl"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const mode=R.demo()?'<p class="note2">Это пример на вымышленных сотрудниках. Принимайте и увольняйте как угодно: изменения видны во всех разделах. Ваши данные появятся после регистрации.</p>':'';
const set=(t,s,a)=>{$('#hT').textContent=t;$('#hS').textContent=s;$('#hA').innerHTML=a||'';};
const out=h=>{$('#hr').innerHTML=mode+h;};
const taskLine=(x,show)=>{const late=x.due<d.today();return `<div class="tk ${late?'late':''}"><label><input type="checkbox" data-task="${x.id}" data-eid="${x.eid}"${x.done?' checked':''}><span><b>${esc(x.title)}</b><small><a href="${'people.html#c='+x.eid}">${esc(x.fio)}</a> · ${esc(x.law)}</small></span></label><span class="pill ${x.done?'ok':late?'crit':'info'}">${x.done?'готово':(late?'просрочено, ':'до ')+d.fmt(x.due)}</span></div>`;};

function csv(name,head,rows){const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const t='\ufeff'+[head,...rows].map(r=>r.map(q).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();toast('Файл скачан: откройте в Excel.');}
const exp=(id,label)=>`<button type="button" class="b" data-exp="${id}">${label||'Скачать для Excel'}</button>`;
const P={
docs(){
  set('Документы и сроки','Все обязательные действия по сотрудникам со сроками из закона. Список создаётся сам при приёме и увольнении.');
  const t=R.allTasks().sort((a,b)=>a.due<b.due?-1:1),open=t.filter(x=>!x.done),td=d.today(),wk=d.addDays(td,7);
  if(!R.emps().length)return out(empty('Сроки появятся, когда вы примете первого сотрудника.'));
  const grp=[['Просрочено',open.filter(x=>x.due<td)],['На этой неделе',open.filter(x=>x.due>=td&&x.due<=wk)],['Позже',open.filter(x=>x.due>wk)],['Сделано',t.filter(x=>x.done).slice(0,8)]];
  out(grp.map(g=>g[1].length?`<section class="blk"><div class="bh"><h2>${g[0]} · ${g[1].length}</h2></div><div class="tl">${g[1].map(x=>taskLine(x)).join('')}</div></section>`:'').join('')||'<p class="muted">Задач нет.</p>'+`
  <section class="blk"><div class="bh"><h2>Документы сотрудников</h2></div><p class="muted">Откройте карточку: договор, приказы, согласие, личная карточка, сведения для военкомата и МВД собираются автоматически.</p>
  <div class="chips">${R.active().map(e=>`<a class="pill info" href="${link(e,'docs')}">${esc(e.fio.split(' ').slice(0,2).join(' '))}</a>`).join('')}</div></section>`);
},
military(){
  const all=R.active();
  set('Воинский учёт','Кто из сотрудников подлежит учёту, считается из пола, возраста и гражданства.',exp('mil'));
  if(!all.length)return out(empty('Воинский учёт появится, когда вы примете сотрудников.'));
  const rows=all.map(e=>({e,m:R.mil(e)}));
  const inn=rows.filter(r=>r.m.st==='in'),chk=rows.filter(r=>r.m.st==='check'||r.m.st==='out'),no=rows.filter(r=>r.m.st==='no');
  const y=new Date().getFullYear();
  const row=r=>{const t=r.e.tasks.find(x=>x.mod==='military'&&!x.done);return `<tr><td>${nameCell(r.e)}</td><td>${R.age(r.e.birth)==null?'—':R.age(r.e.birth)}</td><td><span class="pill ${r.m.st==='in'?'info':r.m.st==='no'?'':'warn'}">${{in:'на учёте',check:'уточнить',out:'снять',no:'не ставится'}[r.m.st]}</span></td><td class="why">${esc(r.m.why)}</td><td>${t?`<span class="pill ${t.due<d.today()?'crit':'warn'}">сообщить до ${d.fmt(t.due)}</span>`:'—'}</td></tr>`;};
  out(`<section class="kpis"><div class="kpi"><b>${inn.length}</b><span>на учёте</span></div><div class="kpi ${chk.length?'crit':''}"><b>${chk.length}</b><span>уточнить</span></div><div class="kpi"><b>${no.length}</b><span>не подлежат</span></div></section>
  <section class="blk"><div class="bh"><h2>Кого мы ставим на учёт</h2></div><ul class="rules"><li>Мужчины, граждане РФ, от 18 лет до предельного возраста пребывания в запасе. Это не только до 30: призывники до 30 и военнообязанные запаса.</li><li>Предельный возраст зависит от состава: рядовые и сержанты ${R.soldierLimit(y)} лет в ${y} году (до 55 к 2028), младшие офицеры 60, старшие 65, высшие 70. Пока категорию не внесли, мы не снимаем с учёта сами, а просим уточнить.</li><li>Женщины только с военно-учётной специальностью. Иностранцы, негодные (категория Д) и постоянно живущие за границей не ставятся.</li><li>О приёме и об увольнении сообщаем в военкомат в течение 5 рабочих дней. План работы согласуется до конца года.</li></ul><p class="muted">Нормы: ФЗ № 53-ФЗ, Положение о воинском учёте (постановление № 719). Сверено с открытыми источниками 02.11.2026; перед запуском проверить юристом.</p></section>
  ${chk.length?`<section class="blk"><div class="bh"><h2>Требуют внимания</h2></div>${tbl(['Сотрудник','Возраст','Статус','Основание','Срок'],chk.map(row))}</section>`:''}
  <section class="blk"><div class="bh"><h2>На учёте · ${inn.length}</h2></div>${inn.length?tbl(['Сотрудник','Возраст','Статус','Основание','Срок'],inn.map(row)):'<p class="muted">Никто не подлежит учёту.</p>'}</section>
  <section class="blk"><div class="bh"><h2>Не подлежат · ${no.length}</h2></div>${no.length?tbl(['Сотрудник','Возраст','Статус','Основание','Срок'],no.map(row)):'<p class="muted">—</p>'}</section>`);
},
foreign(){
  const all=R.active().filter(e=>R.foreign(e));
  set('Иностранцы','Работники без гражданства РФ: документы на работу, сроки и уведомления в МВД.',exp('for'));
  if(!R.active().length)return out(empty('Раздел заполнится сам, как только вы примете иностранного сотрудника.'));
  if(!all.length)return out('<div class="emptyx"><p>Иностранных сотрудников нет. Если примете, отметьте гражданство в карточке: он появится здесь, а уведомление МВД и срок патента попадут в сроки.</p></div>');
  const row=e=>{const f=R.foreign(e),t=e.tasks.find(x=>x.mod==='foreign'&&!x.done&&x.key.startsWith('mvd'));
    return `<tr><td>${nameCell(e)}</td><td>${esc(e.country||'')}<small class="sub2">${esc(R.REGIME[e.regime].split(' (')[0])}</small></td><td>${esc(e.permitNo||'—')}</td><td>${e.permitUntil?d.fmt(e.permitUntil):'—'}</td><td><span class="pill ${f.lvl==='ok'?'ok':f.lvl}">${esc(f.msg)}</span></td><td>${t?`<span class="pill ${t.due<d.today()?'crit':'warn'}">МВД до ${d.fmt(t.due)}</span>`:'<span class="pill ok">подано</span>'}</td></tr>`;};
  out(`<section class="blk">${tbl(['Сотрудник','Страна','Документ','Действует до','Состояние','Уведомление'],all.map(row))}</section>
  <section class="blk"><div class="bh"><h2>Что важно</h2></div><ul class="rules"><li>Уведомление в МВД о приёме и о прекращении договора: 3 рабочих дня. Штраф юрлицу до 1 млн ₽ и приостановка деятельности до 90 дней (ст. 18.15 КоАП).</li><li>Граждане ЕАЭС работают без патента, но уведомление подаётся.</li><li>С 01.09.2026 в уведомлении указывается срок действия договора и прикладывается согласие иностранца на обработку данных.</li><li>За месяц до окончания патента или разрешения предупредим здесь.</li></ul><p class="muted">Сверено с открытыми источниками 02.11.2026; перед запуском проверить юристом.</p></section>`);
},
sick(){
  const all=R.active();
  set('Больничные','Кто болеет сейчас и сколько дней уходит в расчёт зарплаты.');
  if(!all.length)return out(empty('Больничные появятся, когда в штате будут сотрудники.'));
  const now=all.filter(e=>R.onSick(e)),rows=[];
  all.forEach(e=>e.sick.forEach(s=>rows.push({e,s})));rows.sort((a,b)=>a.s.from<b.s.from?1:-1);
  out(`<section class="kpis"><div class="kpi ${now.length?'warn':''}"><b>${now.length}</b><span>болеют сегодня</span></div><div class="kpi"><b>${rows.length}</b><span>листов всего</span></div></section>
  <section class="blk"><div class="bh"><h2>Листы нетрудоспособности</h2></div>${rows.length?tbl(['Сотрудник','С','По','Номер ЭЛН','Статус'],rows.map(r=>`<tr><td>${nameCell(r.e)}</td><td>${d.fmt(r.s.from)}</td><td>${d.fmt(r.s.to)}</td><td>${esc(r.s.no||'—')}</td><td><span class="pill ${r.s.from<=d.today()&&r.s.to>=d.today()?'warn':''}">${r.s.from<=d.today()&&r.s.to>=d.today()?'болеет':'закрыт'}</span></td></tr>`)):'<p class="muted">Больничных нет. Добавляйте их в карточке сотрудника, вкладка «Больничные».</p>'}</section>
  <section class="blk"><ul class="rules"><li>Первые 3 дня больничного оплачивает работодатель, дальше выплачивает СФР. Мы учитываем это в расчёте зарплаты как оценку.</li><li>Лист нетрудоспособности электронный: попросите у сотрудника номер.</li></ul></section>`);
},
payroll(){
  const now=new Date();let y=now.getFullYear(),m=now.getMonth();
  const mon=new Date(y,m,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  set('Зарплата','Расчёт на команду из окладов, отработанных дней и больничных. Оценка для планирования, не замена бухгалтерии.',exp('pay','Скачать для бухгалтера'));
  const rows=R.payroll(y,m);
  if(!rows.length)return out(empty('Расчёт появится, когда у сотрудников будут оклады.'));
  const tot=k=>rows.reduce((a,r)=>a+r[k],0),co=H.state().company||{};
  out(`<section class="kpis"><div class="kpi"><b>${rub(tot('gross'))}</b><span>начислено за ${esc(mon)}</span></div><div class="kpi"><b>${rub(tot('pay'))}</b><span>к выплате на руки</span></div><div class="kpi"><b>${rub(tot('contrib'))}</b><span>взносы, оценка 30,2%</span></div></section>
  <p class="muted">Дни выплаты: ${co.pay?esc(co.pay):'не указаны, заполните анкету компании'}. Норма месяца: ${rows[0].norm} раб. дн. (без учёта праздников).</p>
  <section class="blk">${tbl(['Сотрудник','Оклад','Отработано','Больничный','Начислено','НДФЛ','К выплате'],rows.map(r=>`<tr><td>${nameCell(r.e)}${r.low?'<small class="warnx">Оклад ниже МРОТ</small>':''}${r.e.out?'<small class="sub2">уволен '+d.fmt(r.e.out.date)+'</small>':''}</td><td>${rub(r.e.salary)}</td><td>${r.worked} из ${r.norm}</td><td>${r.sick?r.sick+' дн.':'—'}</td><td>${rub(r.gross)}</td><td>${rub(r.ndfl)}<small class="sub2">ставка ${Math.round(r.rate*100)}%, с начала года ${rub(r.ytd)}</small></td><td><b>${rub(r.pay)}</b></td></tr>`))}</section>
  <section class="blk"><ul class="rules"><li>Начислено = оклад × отработанные дни ÷ норма. Для больничных учтены первые 3 дня за счёт работодателя по упрощённому среднему заработку.</li><li>НДФЛ по прогрессивной шкале нарастающим итогом с начала года: 13% с дохода до 2,4 млн ₽, 15% на часть от 2,4 до 5 млн, 18% от 5 до 20 млн, 20% от 20 до 50 млн, 22% свыше 50 млн. В месяце, где доход переходит порог, ставка выше. Вычеты, северные надбавки и патентников не учитываем. Прошлые месяцы считаем по текущему окладу. Проверить по ст. 224 НК РФ.</li><li>Страховые взносы и льготы малого бизнеса зависят от вашей ситуации: уточните у бухгалтера.</li><li>Принятые и уволенные в месяце считаются за фактические дни. ГПХ и самозанятые сюда не входят.</li></ul></section>`);
},
archive(){
  const a=R.archived(),yrs=R.state().archiveYears||5;
  set('Архив','Уволенные сотрудники. Они не видны в штате, зарплате и учётах, но данные хранятся, пока это нужно по закону и для защиты от споров.');
  const opts=[[1,'1 год: срок обращения в суд по увольнению (ст. 392 ТК)'],[3,'3 года: общий срок исковой давности'],[5,'5 лет: проверки по взносам и налогам (рекомендуем)'],[10,'10 лет'],[50,'50 лет: срок хранения личных дел по Перечню Росархива']];
  out(`<section class="blk"><div class="bh"><h2>Сколько хранить в приложении</h2></div>
  <label class="fld">Срок<select id="aYrs">${opts.map(o=>`<option value="${o[0]}"${o[0]===yrs?' selected':''}>${o[1]}</option>`).join('')}</select></label>
  <ul class="rules"><li>Считается от даты увольнения. По истечении срока мы предложим удалить данные, сами ничего не удаляем.</li><li>Закон требует хранить кадровые документы дольше: личные дела и приказы по личному составу до 50 лет, по Перечню Росархива (приказ № 236). Это требование к организации, а не к приложению: перед удалением скачайте комплект документов сотрудника и храните его у себя.</li><li>Персональные данные нельзя держать дольше, чем нужно для цели (152-ФЗ): поэтому срок короче 50 лет и под контролем вас.</li></ul><p class="muted">Нормы сверены с открытыми источниками 02.11.2026: срок «5 лет» наша рекомендация, а не требование закона; решение принимает юрист.</p></section>
  <section class="blk"><div class="bh"><h2>Бывшие сотрудники · ${a.length}</h2></div>${a.length?tbl(['Сотрудник','Уволен','Основание','Хранить до','Стаж у нас',''],a.map(e=>{const p=R.purgeOn(e),late=p<d.today();return `<tr><td>${nameCell(e)}</td><td>${d.fmt(e.out.date)}</td><td>${esc(R.FIRE[e.out.reason].t)}<small class="sub2">${esc(R.FIRE[e.out.reason].a)}</small></td><td><span class="pill ${late?'warn':''}">${d.fmt(p)}</span></td><td>${R.fmtY(R.stazh(e).own)}</td><td class="act"><a class="b" href="${link(e,'docs')}">Документы</a><button type="button" class="b" data-restore="${e.id}">Вернуть</button><button type="button" class="b" data-purge="${e.id}">Удалить</button></td></tr>`;})):'<p class="muted">Архив пуст. Уволенные сотрудники появятся здесь сами.</p>'}</section>`);
},
laws(){
  const all=R.active(),M=R.MROT;
  set('Законы и МРОТ','Что в законе касается именно вашей команды. Сверено с открытыми источниками 02.11.2026.');
  const men=all.some(e=>R.mil(e).st!=='no'),fr=all.some(e=>R.foreign(e)),low=all.filter(e=>e.salary&&e.salary<R.mrotNow()),y=all.some(e=>R.age(e.birth)!=null&&R.age(e.birth)<18);
  const cards=[
   ['ЕФС-1: приём и увольнение','Сведения о приёме и об увольнении подаются не позднее следующего рабочего дня после приказа. Переводы и другие события подаются позже, до 25 числа следующего месяца. Работнику при увольнении выдают сведения о трудовой деятельности (СТД-Р) или трудовую книжку.','ст. 66.1, 84.1 ТК; проверить срок для переводов',true],
   ['Зарплата и расчёт при увольнении','Зарплата выплачивается не реже чем каждые полмесяца. Расчёт и компенсация за неиспользованный отпуск выплачиваются в последний рабочий день.','ст. 136, 140, 127 ТК',true],
   ['Воинский учёт в организации','Мужчины-граждане от 18 лет до предельного возраста, женщины с ВУС. Сообщать о приёме и увольнении в течение 5 рабочих дней.','ФЗ № 53-ФЗ; постановление № 719',men],
   ['Иностранные работники','Уведомление МВД в течение 3 рабочих дней. С 01.09.2026 указывается срок договора и прикладывается согласие иностранца на обработку данных.','115-ФЗ, ст. 18.15 КоАП',fr],
   ['Работники младше 18 лет','Обязательный медосмотр, сокращённая рабочая неделя, испытательный срок запрещён.','ст. 69, 70, 92, 266 ТК',y],
   ['Согласие на персональные данные','Согласие оформляется отдельным документом с 01.09.2025. Хранить данные уволенных можно только в пределах срока и цели.','ст. 9 и 5 152-ФЗ',true],
   ['Хранение документов','Личные дела и приказы по личному составу хранятся до 50 лет по Перечню Росархива. Срок отсчитывается с 1 января года после увольнения.','приказ Росархива № 236',true]];
  out(`<section class="blk"><div class="bh"><h2>МРОТ</h2></div>
  <div class="mr"><div><span>С 01.01.2026, федеральный</span><b>${rub(M.y2026)}</b></div><div><span>С 01.01.2027, по плану</span><b>${rub(M.y2027)}</b><small>озвучен Минфином 24.09.2026, закон проверить</small></div></div>
  <label class="fld">Региональный МРОТ вашего региона, ₽ (${esc(R.state().reg)})<input id="mReg" type="number" min="0" value="${R.state().mrotRegion||''}" placeholder="${M.y2026}"></label>
  <p class="muted">Региональный размер в Санкт-Петербурге и других регионах мы не берём из головы: внесите значение из соглашения вашего региона. Применяется ${rub(R.mrotNow())}.</p>
  ${low.length?`<div class="st out"><b>Оклад ниже МРОТ: ${low.length} ${PLU(low.length,'сотрудник','сотрудника','сотрудников')}</b><span>${low.map(e=>esc(e.fio.split(' ')[0])).join(', ')}. Доплатите до МРОТ: ниже платить нельзя.</span></div>`:'<div class="st in"><b>Все оклады не ниже МРОТ</b><span>Проверка идёт по значению выше.</span></div>'}</section>
  <section class="blk"><div class="bh"><h2>Касается вас</h2></div><div class="lw">${cards.filter(c=>c[3]).map(c=>`<article><h3>${esc(c[0])}</h3><p>${esc(c[1])}</p><small>${esc(c[2])}</small></article>`).join('')}</div></section>
  <p class="muted">Это справочная памятка, а не юридическая консультация. Нормы и размеры штрафов меняются: перед применением проверяйте по официальным текстам.</p>`);
}
};

document.addEventListener('change',ev=>{
  const c=ev.target.closest('[data-task]');if(c){R.doneTask(c.dataset.eid,c.dataset.task,c.checked);P[page]();return;}
  if(ev.target.id==='aYrs'){R.setArchiveYears(+ev.target.value);P.archive();toast('Срок хранения изменён.');}
  if(ev.target.id==='mReg'){R.setMrotRegion(+ev.target.value||null);P.laws();toast('Региональный МРОТ сохранён.');}
});
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t)return;
  if(t.dataset.exp==='mil'){csv('voinskiy-uchet.csv',['ФИО','Дата рождения','Возраст','Должность','Статус','Основание','Военный билет','Звание','ВУС','Категория запаса','Годность'],R.active().map(e=>{const m=R.mil(e);return [e.fio,e.birth,R.age(e.birth),e.position,{in:'на учёте',check:'уточнить',out:'снять',no:'не ставится'}[m.st],m.why,e.milDoc||'',e.rank||'',e.vus||'',R.MILCAT[e.milCat]||'',R.FIT[e.fit]||''];}));return;}
  if(t.dataset.exp==='for'){csv('inostrancy.csv',['ФИО','Страна','Режим','Документ','Действует до','Начало работы','Состояние'],R.active().filter(e=>R.foreign(e)).map(e=>[e.fio,e.country,R.REGIME[e.regime],e.permitNo||'',e.permitUntil||'',e.start,R.foreign(e).msg]));return;}
  if(t.dataset.exp==='pay'){const n=new Date();csv('zarplata-'+n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'.csv',['ФИО','Должность','Оклад','Норма дней','Отработано','Больничных дней','Начислено','НДФЛ','К выплате','Взносы (оценка)'],R.payroll(n.getFullYear(),n.getMonth()).map(r=>[r.e.fio,r.e.position,r.e.salary,r.norm,r.worked,r.sick,r.gross,r.ndfl,r.pay,r.contrib]));return;}
  if(t.dataset.restore){R.restore(t.dataset.restore);P.archive();toast('Сотрудник возвращён в штат.');}
  if(t.dataset.purge){if(t.dataset.arm){R.purge(t.dataset.purge);P.archive();toast('Данные сотрудника удалены.');}else{t.dataset.arm='1';t.textContent='Точно удалить?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='Удалить';}},3000);}}
});
(P[page]||P.docs)();
})();
