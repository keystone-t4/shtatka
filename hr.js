/* Разделы, которые считаются из карточек сотрудников: Документы и сроки, Воинский учёт, Иностранцы, Больничные,
   Зарплата, Архив, Законы и МРОТ. Сами данные не вносятся здесь: они приходят из раздела «Сотрудники» (hr-core.js). */
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
  set('Иностранцы','Раздел в работе.');
  out('<div class="emptyx"><p><b>Иностранцы: в работе.</b></p><p>Проверку документов на право работы, сроки и уведомления мы подключим отдельным шагом: тема сложная, делаем её аккуратно. Пока иностранного сотрудника можно принять в разделе «Сотрудники»: выберите «Иностранный паспорт» и укажите страну. Договор и личное дело оформятся как обычно.</p></div>');
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
  set('Зарплата','Начисления, НДФЛ, страховые взносы и травматизм по правилам 2026 года и данным вашей компании. Оценка для планирования, не замена бухгалтерии.',exp('pay','Скачать для бухгалтера'));
  const rows=R.payroll(y,m),co=rows.co||R.payCo(),t=rows.tariff,C=window.SHTATKA_COMPANY,PR=window.SHTATKA_PAYROLL,ses=H.session()||{};
  const tot=k=>rows.reduce((a,r)=>a+(r[k]||0),0),ca=H.state().company||{},ai=rows.ausnInjury||0;
  const opt=(v,l,cur)=>`<option value="${v}"${String(cur==null?'':cur)===v?' selected':''}>${l}</option>`;
  const set1=`<section class="blk" id="pCo"><div class="bh"><h2>Компания и тариф взносов</h2><span class="pill ${co.sources&&co.sources.length?'ok':''}">${co.sources&&co.sources.length?esc(co.sources.join(', '))+' · '+new Date(co.checkedAt).toLocaleDateString('ru-RU'):'заполните или загрузите по ИНН'}</span></div>
   <div class="fld2"><label class="fld">ИНН<input id="pInn" inputmode="numeric" maxlength="12" value="${esc(co.inn||ses.inn||'')}" placeholder="10 или 12 цифр"></label><div class="fld"><span>&nbsp;</span><button type="button" class="b d" id="pFind" style="height:46px">Загрузить из ЕГРЮЛ</button></div></div>
   ${co.name?`<p class="muted"><b>${esc(co.name)}</b>${co.okvedName?' · ОКВЭД '+esc(co.okved)+' — '+esc(co.okvedName):''}</p>`:''}
   <p class="err" id="pErr" hidden></p>
   <div class="fld2"><label class="fld">Реестр МСП<select id="pMsp">${opt('','Нет данных',co.msp)}${opt('micro','Микропредприятие',co.msp)}${opt('small','Малое предприятие',co.msp)}${opt('medium','Среднее предприятие',co.msp)}${opt('none','Не состоит',co.msp)}</select></label>
   <label class="fld">Основной ОКВЭД<input id="pOkved" value="${esc(co.okved||'')}" placeholder="Например, 56.10"></label></div>
   <div class="fld2"><label class="fld">Налоговый режим<select id="pTax">${opt('osn','ОСНО',co.taxSystem)}${opt('usn','УСН',co.taxSystem)}${opt('ausn','АУСН',co.taxSystem)}${opt('eshn','ЕСХН',co.taxSystem)}${opt('psn','ПСН (ИП)',co.taxSystem)}</select></label>
   <label class="fld">Травматизм, % (из уведомления СФР)<input id="pInj" type="number" min="0.2" max="8.5" step="0.1" value="${esc(co.injury)}"></label></div>
   <div class="fld2"><label class="fld">Скидка к травматизму, % (решение СФР, до 40)<input id="pDisc" type="number" min="0" max="40" step="1" value="${esc(co.injuryDisc||0)}"></label><div></div></div>
   <label class="chk"><input type="checkbox" id="p70"${co.share70?' checked':''}> Доход от основного вида деятельности — не меньше 70 %</label>
   <label class="chk"><input type="checkbox" id="pIt"${co.it?' checked':''}> Аккредитованная IT-компания</label>
   ${t?`<div class="st ${t.kind==='general'?'':'in'}" style="margin-top:12px"><b>${esc(t.title)}</b><span>${(t.why||[]).map(esc).join(' · ')}</span></div>`:''}</section>`;
  if(!rows.length)return out(set1+empty('Расчёт появится, когда у сотрудников будут оклады.'));
  const F=PR?PR.R:{mrot:27093,base:2979000};
  out(`<section class="kpis"><div class="kpi"><b>${rub(tot('gross'))}</b><span>начислено за ${esc(mon)}</span></div><div class="kpi"><b>${rub(tot('pay'))}</b><span>к выплате на руки</span></div><div class="kpi"><b>${rub(tot('contrib'))}</b><span>страховые взносы</span></div><div class="kpi"><b>${rub(tot('injury')+ai)}</b><span>травматизм</span></div><div class="kpi"><b>${rub(tot('budget')+ai)}</b><span>в бюджет: НДФЛ, взносы, травматизм</span></div><div class="kpi"><b>${rub(tot('cost')+ai)}</b><span>расходы компании</span></div></section>
  ${set1}
  <p class="muted">Дни выплаты: ${ca.pay?esc(ca.pay):'не указаны, заполните анкету компании'}. Норма месяца: ${rows[0].norm} раб. дн. (без учёта праздников).</p>
  <section class="blk">${tbl(['Сотрудник','Оклад','Отработано','Начислено','НДФЛ','К выплате','Взносы','Травматизм','Расходы'],rows.map(r=>`<tr><td>${nameCell(r.e)}${r.low?'<small class="warnx">Оклад ниже МРОТ</small>':''}${r.headMin?'<small class="sub2">взносы с МРОТ: руководитель</small>':''}${r.e.out?'<small class="sub2">уволен '+d.fmt(r.e.out.date)+'</small>':''}</td><td>${rub(r.e.salary)}</td><td>${r.worked} из ${r.norm}${r.sick?'<small class="sub2">больничный '+r.sick+' дн.</small>':''}</td><td>${rub(r.gross)}</td><td>${rub(r.ndfl)}<small class="sub2">ставка ${Math.round(r.rate*100)}%, с начала года ${rub(r.ytd)}</small></td><td><b>${rub(r.pay)}</b></td><td>${rub(r.contrib)}<small class="sub2">основной ${rub(r.main)}${r.extra?', доп. '+Math.round(r.xRate*100)+'% '+rub(r.extra):''}</small><small class="sub2">база ${rub(r.base)}, с начала года ${rub(r.cumBase+r.base)}</small></td><td>${rub(r.injury)}</td><td>${rub(r.cost)}</td></tr>`))}</section>
  <section class="blk"><div class="bh"><h2>Взносы по слоям за ${esc(mon)}</h2></div>${tbl(['Слой','Что входит','Сумма'],[
   `<tr><td>1. Обязательное ядро</td><td>единый тариф по общим правилам: 30 % / 15,1 %</td><td>${rub(tot('mainGeneral'))}</td></tr>`,
   `<tr><td>2. Льгота компании</td><td>${esc(t?t.title:'')}</td><td>${tot('main')<tot('mainGeneral')?'−'+rub(tot('mainGeneral')-tot('main')):'нет'}</td></tr>`,
   `<tr><td>3. Надбавки</td><td>доп. тариф ОПС по СОУТ и спискам досрочной пенсии</td><td>${tot('extra')?rub(tot('extra')):'нет'}</td></tr>`,
   `<tr><td>Травматизм</td><td>ставка ${(rows.injRate*100).toFixed(2).replace('.',',')} %${co.injuryDisc?' с учётом скидки '+co.injuryDisc+' %':''}${ai?', АУСН: фиксированный':''}</td><td>${rub(tot('injury')+ai)}</td></tr>`,
   `<tr><td><b>Итого</b></td><td>взносы + травматизм</td><td><b>${rub(tot('contrib')+tot('injury')+ai)}</b></td></tr>`])}</section>
  <section class="blk"><div class="bh"><h2>Формулы</h2></div><ul class="rules">
   <li><b>Начислено</b> = оклад × отработанные дни ÷ норма дней + первые 3 дня больничного за счёт работодателя (оценка по среднему заработку).</li>
   <li><b>НДФЛ за месяц</b> = НДФЛ(доход с 1 января, включая месяц) − НДФЛ(доход до месяца). Шкала: 13 % до 2,4 млн ₽, 15 % — 2,4–5 млн, 18 % — 5–20 млн, 20 % — 20–50 млн, 22 % свыше (ст. 224 НК).</li>
   <li><b>База взносов</b> = начислено без больничного (пособие взносами не облагается, ст. 422 НК). За руководителя — не меньше МРОТ ${rub(F.mrot)} × дни в должности ÷ норма (ст. 421 НК).</li>
   <li class="${t&&t.kind==='general'?'on':''}"><b>Общий тариф</b> = 30 % × база в пределах ${rub(F.base)} с начала года + 15,1 % × база сверх (ст. 425 НК).</li>
   <li class="${t&&t.kind==='msp'?'on':''}"><b>МСП</b> (реестр МСП + основной ОКВЭД из перечня 4125-р + доход от него ≥ 70 %) = 30 % × min(база; 1,5 МРОТ = ${rub(F.mrot*1.5)}) + 15 % × остаток. Обрабатывающие производства (перечень 3689-р) — 7,6 % × остаток. Сверх предельной базы часть до 1,5 МРОТ — 15,1 % (ст. 427 НК).</li>
   <li class="${t&&t.kind==='it'?'on':''}"><b>IT-компании</b> = 15 % × база в пределах ${rub(F.base)} + 7,6 % × сверх.</li>
   <li class="${t&&t.kind==='ausn'?'on':''}"><b>АУСН</b>: взносов по единому тарифу нет, травматизм фиксированный — ${rub(F.ausnInjuryYear||2959)} в год.</li>
   <li><b>Доп. тариф ОПС</b> = база × ставка, без предельной базы (ст. 428 НК): по СОУТ класс 3.1 — 2 %, 3.2 — 4 %, 3.3 — 6 %, 3.4 — 7 %, 4 — 8 %, классы 1–2 — 0 %; без СОУТ — список № 1 — 9 %, список № 2 и др. — 6 %. Задаётся в карточке сотрудника.</li>
   <li><b>Травматизм</b> = начислено без больничного × ставка из уведомления СФР (0,2–8,5 % по классу риска основного ОКВЭД) × (1 − скидка, до 40 %).</li>
   <li><b>В бюджет</b> = НДФЛ + взносы + травматизм. <b>Расходы компании</b> = начислено + взносы + травматизм.</li></ul>
   <p class="muted">Прошлые месяцы года считаются по текущему окладу. Не учтены: вычеты НДФЛ, районные коэффициенты, нерезиденты и патентники. Ставки сверены 02.11.2026: МРОТ — 429-ФЗ, предельная база — постановление № 1705, тарифы — 425-ФЗ.</p></section>
  <section class="blk"><div class="bh"><h2>Сроки уплаты</h2></div><ul class="rules"><li>НДФЛ, удержанный 1–22 числа, — до 28 числа того же месяца; 23-го — конца месяца — до 5 числа следующего.</li><li>Страховые взносы — до 28 числа следующего месяца, единым налоговым платежом; уведомление — до 25 числа.</li><li>Травматизм — в СФР до 15 числа следующего месяца.</li><li>ГПХ и самозанятые сюда не входят. Принятые и уволенные в месяце считаются за фактические дни.</li></ul></section>`);
  bindPay();
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
  const men=all.some(e=>R.mil(e).st!=='no'),low=all.filter(e=>e.salary&&e.salary<R.mrotNow()),y=all.some(e=>R.age(e.birth)!=null&&R.age(e.birth)<18);
  const cards=[
   ['ЕФС-1: приём и увольнение','Сведения о приёме и об увольнении подаются не позднее следующего рабочего дня после приказа. Переводы и другие события подаются позже, до 25 числа следующего месяца. Работнику при увольнении выдают сведения о трудовой деятельности (СТД-Р) или трудовую книжку.','ст. 66.1, 84.1 ТК; проверить срок для переводов',true],
   ['Зарплата и расчёт при увольнении','Зарплата выплачивается не реже чем каждые полмесяца. Расчёт и компенсация за неиспользованный отпуск выплачиваются в последний рабочий день.','ст. 136, 140, 127 ТК',true],
   ['Воинский учёт в организации','Мужчины-граждане от 18 лет до предельного возраста, женщины с ВУС. Сообщать о приёме и увольнении в течение 5 рабочих дней.','ФЗ № 53-ФЗ; постановление № 719',men],
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

function bindPay(){
  const $$=id=>document.getElementById(id);if(!$$('pCo'))return;
  const read=()=>{R.setPayCo({msp:$$('pMsp').value||null,okved:$$('pOkved').value.trim(),taxSystem:$$('pTax').value,injury:Math.min(8.5,Math.max(0.2,+$$('pInj').value||0.2)),injuryDisc:Math.min(40,Math.max(0,+$$('pDisc').value||0)),share70:$$('p70').checked,it:$$('pIt').checked});P.payroll();};
  ['pMsp','pTax','p70','pIt'].forEach(id=>$$(id).addEventListener('change',read));
  ['pOkved','pInj','pDisc'].forEach(id=>$$(id).addEventListener('change',read));
  $$('pInn').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,12);});
  $$('pFind').addEventListener('click',async()=>{
    const C=window.SHTATKA_COMPANY,v=$$('pInn').value.trim(),er=$$('pErr'),b=$$('pFind');er.hidden=true;
    if(!C.innOk(v)){er.hidden=false;er.textContent='Проверьте ИНН: у компании 10 цифр, у ИП 12.';return;}
    b.disabled=true;b.textContent='Ищем…';const r=await C.lookup(v);b.disabled=false;b.textContent='Загрузить из ЕГРЮЛ';
    if(!r.ok){er.hidden=false;er.textContent=r.reason==='not_found'?'Компания с таким ИНН не найдена в ЕГРЮЛ/ЕГРИП.':'Источники не ответили. Заполните поля вручную.';return;}
    const c=r.company,o={inn:c.inn,name:c.name,ip:c.ip,okvedName:c.okvedName,sources:c.sources,checkedAt:c.checkedAt};
    if(c.okved)o.okved=c.okved;if(c.msp!=null)o.msp=c.msp;if(c.taxSystem)o.taxSystem=c.taxSystem;
    R.setPayCo(o);P.payroll();
    const miss=[!c.okved&&'ОКВЭД',c.msp==null&&'статус МСП',!c.taxSystem&&'налоговый режим'].filter(Boolean);
    toast(c.demo?'Демо-режим: источник ЕГРЮЛ не подключён.':miss.length?'В открытых данных нет: '+miss.join(', ')+'. Укажите вручную.':'Данные компании загружены.');
  });
}
document.addEventListener('change',ev=>{
  const c=ev.target.closest('[data-task]');if(c){R.doneTask(c.dataset.eid,c.dataset.task,c.checked);P[page]();return;}
  if(ev.target.id==='aYrs'){R.setArchiveYears(+ev.target.value);P.archive();toast('Срок хранения изменён.');}
  if(ev.target.id==='mReg'){R.setMrotRegion(+ev.target.value||null);P.laws();toast('Региональный МРОТ сохранён.');}
});
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t)return;
  if(t.dataset.exp==='mil'){csv('voinskiy-uchet.csv',['ФИО','Дата рождения','Возраст','Должность','Статус','Основание','Военный билет','Звание','ВУС','Категория запаса','Годность'],R.active().map(e=>{const m=R.mil(e);return [e.fio,e.birth,R.age(e.birth),e.position,{in:'на учёте',check:'уточнить',out:'снять',no:'не ставится'}[m.st],m.why,e.milDoc||'',e.rank||'',e.vus||'',R.MILCAT[e.milCat]||'',R.FIT[e.fit]||''];}));return;}
    if(t.dataset.exp==='pay'){const n=new Date();csv('zarplata-'+n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'.csv',['ФИО','Должность','Оклад','Норма дней','Отработано','Больничных дней','Начислено','НДФЛ','К выплате','База взносов','Взносы основные','Доп. тариф ОПС','Взносы всего','Травматизм','Расходы компании'],R.payroll(n.getFullYear(),n.getMonth()).map(r=>[r.e.fio,r.e.position,r.e.salary,r.norm,r.worked,r.sick,r.gross,r.ndfl,r.pay,r.base,r.main,r.extra,r.contrib,r.injury,r.cost]));return;}
  if(t.dataset.restore){R.restore(t.dataset.restore);P.archive();toast('Сотрудник возвращён в штат.');}
  if(t.dataset.purge){if(t.dataset.arm){R.purge(t.dataset.purge);P.archive();toast('Данные сотрудника удалены.');}else{t.dataset.arm='1';t.textContent='Точно удалить?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='Удалить';}},3000);}}
});
(P[page]||P.docs)();
})();
