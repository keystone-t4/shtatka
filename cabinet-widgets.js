/* Каталог блоков главной «Штатки» и шаблоны по отраслям.
   Чтобы добавить блок: def(id, группа, название, допустимые размеры, размер по умолчанию, тон, () => html).
   Размеры: s = 1/4 ширины, m = 1/2, l = вся ширина. Тон: '', 'dark', 'lamp', 'sand'.
   Все цифры — демо-данные; кнопки пока никуда не ведут (data-soon). */
(function(){
const B=(t,c='')=>`<button type="button" class="b ${c}" data-soon>${t}</button>`;
const MORE=t=>`<button type="button" class="more" data-soon>${t}</button>`;
const AV=(i,c='')=>`<span class="av ${c}" aria-hidden="true">${i}</span>`;
const esc=t=>String(t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const HOME=()=>window.SHTATKA_HOME||null;
const scopeUnit=()=>{const h=HOME();return h?h.scopeUnit():null;};
const UT={point:'Точка',project:'Проект',city:'Город',office:'Офис',dept:'Отдел'};
const hs=t=>{let h=0;for(const ch of t)h=(h*31+ch.charCodeAt(0))%997;return h;};
const W={};
const GROUPS=['Каждый день','Люди и документы','Время и безопасность','Деньги и развитие'];
function def(id,g,title,sizes,size,tone,html){W[id]={id,g,title,sizes,size,tone,html};}

/* ---- Каждый день ---- */
def('decisions',GROUPS[0],'Требует решения',['m','l'],'m','',c=>{
  const it=D(c,'dec',[['АК','Анна К.','отпуск, 14 дней','Пересечение: в эти дни уже отдыхает 1 коллега',1],['ИС','Игорь С.','отпрашивается пораньше, в 16:00','Причина: поезд в другой город',0],['ОП','Ольга П.','командировка, 3 дня','Приказ и суточные подготовлены',0]]);
  return `<h2>Требует решения <span class="lab">${it.length} заявки</span></h2><div>`+it.map(x=>`<div class="req">${AV(x[0])}<div class="t"><b>${x[1]}</b> · ${x[2]}<small${x[4]?' class="r"':''}>${x[3]}</small></div><div class="acts">${B('Отклонить')}${B('Согласовать','d')}</div></div>`).join('')+`</div>`;});
/* ---- Показатели ---- */
def('kStaff',GROUPS[1],'В штате',['s','m'],'s','',c=>{const s=D(c,'staff',['24','+2 за месяц','3 на испытательном']);const u=scopeUnit(c);
  if(u)return `<span class="lab">В штате · ${esc(u.name)}</span><div class="big">${u.staff}</div><div><span class="pill">из ${s[0]} в компании</span></div>`;
  return `<span class="lab">В штате</span><div class="big">${s[0]}</div><div><span class="pill ok">${s[1]}</span> <span class="pill">${s[2]}</span></div>`;});
def('kDocs',GROUPS[1],'Документов',['s','m'],'s','',c=>{const d=D(c,'docs',['187','не хватает 3','истекают 5']);return `
  <span class="lab">Документов в порядке</span><div class="big">${d[0]}</div><div><span class="pill crit">${d[1]}</span> <span class="pill warn">${d[2]}</span></div>`;});
def('kCost',GROUPS[3],'Стоимость сотрудника',['s','m'],'s','dark',()=>`
  <span class="lab">Сотрудник стоит в месяц</span><div class="big">XXX ₽</div><div>${MORE('Из чего складывается →')}</div>`);
def('kVac',GROUPS[2],'Неиспользованный отпуск',['s','m'],'s','',c=>{const v=D(c,'vac',['48 дн.','у 2 сотрудников']);return `
  <span class="lab">Неиспользованный отпуск</span><div class="big">${v[0]}</div><div><span class="pill warn">${v[1]}</span></div>`;});

/* ---- Люди и документы ---- */
def('drivers',GROUPS[1],'Водители',['m'],'m','',c=>{const d=D(c,'drv',[['c','Медосмотр просрочен: 1 водитель'],['w2','Удостоверение истекает: 2 водителя'],['g','Путевые листы закрыты']]);return `
  <h2>Водители</h2><p class="sub">${D(c,'drvSub','6 водителей · допуски и рейсы')}</p>
  <ul class="bul">`+d.map(x=>`<li class="${x[0]}">${x[1]}</li>`).join('')+`</ul>${MORE('Открыть водителей →')}`;});
def('hire',GROUPS[1],'Быстрый приём на работу',['m'],'m','sand',()=>`
  <h2>Принять человека</h2><p class="sub">Договор, приказ и согласие на персональные данные — за 10 минут.</p>
  <div class="steps"><span>1 · Данные</span><span>2 · Документы</span><span>3 · Подпись</span></div>${B('Принять сотрудника','d')}`);

/* ---- Время и безопасность ---- */
def('leave',GROUPS[2],'Отпуска',['m'],'m','',()=>`
  <h2>Отпуска</h2><p class="sub">2 в отпуске сегодня</p>
  <ul class="bul"><li class="w2">1 пересечение в графике</li><li class="g">График на год согласован</li></ul>
  <div><div class="lab">Отпуска, использовано</div><div class="bar" style="margin-top:6px"><i style="width:46%"></i></div></div>${MORE('Открыть график →')}`);
def('sick',GROUPS[2],'Больничные',['s','m'],'s','',c=>`
  <span class="lab">Больничные</span><div class="big">1</div><div><span class="pill">выход в пятницу</span></div>`);
def('trips',GROUPS[2],'Командировки',['s','m'],'s','',c=>`
  <span class="lab">Командировки</span><div class="big">1</div><div><span class="pill">сотрудник в поездке</span></div>`);
def('safety',GROUPS[2],'Охрана труда',['m'],'m','',()=>`
  <h2>Охрана труда</h2><p class="sub">Инструктажи, обучение, СИЗ</p>
  <ul class="bul"><li class="c">Инструктаж просрочен: 2 сотрудника</li><li class="w2">Обучение: 3 сотрудника на этой неделе</li><li class="g">Журналы ведутся</li></ul>${MORE('Открыть раздел →')}`);
def('med',GROUPS[2],'Медосмотры и медкнижки',['m'],'m','',c=>{const m=D(c,'med',[1,4,19]);return `
  <h2>Медосмотры и медкнижки</h2><p class="sub">Кому и когда пройти</p>
  <ul class="bul"><li class="${m[0]?'c':'g'}">Просрочено: ${m[0]}</li><li class="${m[1]?'w2':'g'}">В ближайшие 30 дней: ${m[1]}</li><li class="g">Действуют: ${m[2]}</li></ul>${MORE('Список →')}`;});
def('calendar',GROUPS[2],'Календарь',['m'],'m','',()=>{
  const n=new Date(),y=n.getFullYear(),m=n.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const mon=n.toLocaleDateString('ru-RU',{month:'long'});
  let c='';['пн','вт','ср','чт','пт','сб','вс'].forEach(d=>c+=`<i>${d}</i>`);
  for(let i=0;i<first;i++)c+='<span></span>';
  for(let d=1;d<=days;d++){const cls=d===n.getDate()?'today':((d%11===3||d%11===4)?'l1':(d%13===6?'l2':''));c+=`<span class="${cls}">${d}</span>`;}
  return `<h2>Календарь · ${mon}</h2><div class="cal">${c}</div><div class="chips"><span class="pill ok">отпуска</span><span class="pill warn">пересечения</span></div>`;});

/* ---- Деньги и развитие ---- */
def('finance',GROUPS[3],'Финансы команды',['m','l'],'m','dark',()=>`
  <h2>Финансы команды</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><span class="lab">Коллектив в месяц</span><div class="big">XXX ₽</div></div><div><span class="lab">Неиспользованный отпуск</span><div class="big">XXX ₽</div></div></div>
  ${MORE('Сколько стоит сотрудник →')}`);
def('calc',GROUPS[3],'Калькулятор стоимости сотрудника',['m','l'],'m','',()=>`
  <h2>Из чего складывается стоимость</h2>
  <div><div class="cost-row"><span>Зарплата и налоги</span><b>XXX ₽</b></div><div class="cost-row"><span>Резерв отпуска</span><b>XXX ₽</b></div><div class="cost-row"><span>Аренда и рабочее место</span><b>XXX ₽</b></div><div class="cost-row"><span>Льготы</span><b>XXX ₽</b></div></div>${B('Открыть калькулятор','d')}`);
def('knowledge',GROUPS[3],'Знания',['m','l'],'l','lamp',c=>{const n=parseInt(D(c,'staff',['24'])[0],10)||24;return `
  <div class="lab" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase">Знания · нужно действие</div>
  <h2 style="font-size:19px">Новое требование к согласию на обработку персональных данных</h2>
  <p class="sub">Касается всех ${n} сотрудников. Штатка подготовит документы, останется отправить на подпись.</p>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${B('Создать документы','d')}${MORE('Все знания →')}</div>`;});
def('benefits',GROUPS[3],'Льготы',['m'],'m','',()=>`
  <h2>Льготы</h2><p class="sub">5 программ · спорт, психолог, ДМС</p>
  <ul class="bul"><li class="g">Спорт: 8 участников</li><li class="w2">Психолог — через 6 месяцев работы: 2 сотрудника</li></ul>${MORE('Настроить льготы →')}`);
def('news',GROUPS[3],'Объявления',['m'],'m','',()=>`
  <h2>Объявления</h2><p class="sub">Сообщение придёт всем в приложение</p>
  <div class="chips">${B('Короткий день')}${B('Корпоратив')}${B('Своё')}</div>`);

/* ---- Блоки с отраслевыми данными: c.d — демо-данные шаблона (см. DEMO) ---- */
const PL=(n,a,b,c)=>{const m=n%100,d=n%10;return (m>10&&m<20)?c:d===1?a:(d>=2&&d<=4)?b:c;};
const D=(c,k,dflt)=>(c&&c.d&&c.d[k])||dflt;
def('tasks',GROUPS[0],'Задания',['m','l'],'m','lamp',c=>{
  const it=D(c,'tasks',[['Просрочено','Отпуск за прошлый год не использован: 2 сотрудника','Запланировать'],['Через 9 дней','Истекает срочный договор: Ольга П.','Продлить'],['Документы','Нет согласия на персональные данные: 3 сотрудника','На подпись']]);
  return `<h2>Задания <span class="pill" style="background:#1F2B45;color:#F5F1E8">7</span></h2><div class="list">`+it.map(x=>`<div class="item act"><div class="t"><small>${x[0]}</small>${x[1]}</div>${B(x[2],'d')}</div>`).join('')+`</div>${MORE('+ ещё 4 задания →')}`;});
def('shifts',GROUPS[0],'Смены и табель',['m','l'],'l','',c=>{
  const SC=window.SHTATKA_SCH,H=HOME(),real=H&&H.real()&&!(H.state().demoView);
  const LNK='<a class="more" href="time.html">График и табель →</a>';
  if(SC&&real&&SC.active()&&SC.staff().length){const r=SC.today(),T=SC.types();
    const tiles=T.map((t,i)=>[t.name+' '+SC.short(t),r.by[t.id]+' чел.',i===0?'lamp':i===1?'night':'']).concat([['Выходной или не назначено',r.off+' чел.','']]);
    return `<h2>Смены сегодня</h2><div class="tiles">`+tiles.map(x=>`<div class="tile ${x[2]}"><span>${esc(x[0])}</span><b>${x[1]}</b></div>`).join('')+`</div>${LNK}`;}
  if(real)return `<h2>Смены сегодня</h2><p class="muted">Смены появятся, когда составите график.</p>${LNK}`;
  const t=D(c,'shifts',[['День 08–20','6 человек','lamp'],['Ночь 20–08','5 человек','night'],['Выходной или отпуск','7 человек','']]);
  return `<h2>${D(c,'shiftsTitle','Смены сегодня')}</h2><div class="tiles">`+t.map(x=>`<div class="tile ${x[2]}"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')+`</div>${LNK}`;});
def('expiry',GROUPS[1],'Документы со сроком',['m','l'],'m','',c=>{
  const it=D(c,'expiry',[['Срочный договор','Ольга П.','9 дней','crit'],['Медкнижка','Светлана Т.','12 дней','warn'],['Водительское удостоверение','Сергей Л.','3 месяца','ok']]);
  return `<h2>Документы со сроком</h2><div class="list">`+it.map(x=>`<div class="item"><div class="t"><b>${x[0]}</b><small>${x[1]}</small></div><span class="pill ${x[3]}">${x[2]}</span></div>`).join('')+`</div>${MORE('Все документы со сроком →')}`;});
def('hr',GROUPS[1],'Личные дела',['m'],'m','',c=>{
  const b=D(c,'hr',[['c','Не хватает 3 документов'],['g','21 личное дело в порядке']]);
  return `<h2>Личные дела</h2><p class="sub">${D(c,'hrSub','Личные дела, воинский и миграционный учёт')}</p><ul class="bul">`+b.map(x=>`<li class="${x[0]}">${x[1]}</li>`).join('')+`</ul>${MORE('Открыть личные дела →')}`;});
def('absent',GROUPS[0],'Сегодня не на месте',['m'],'m','',c=>{
  const it=D(c,'absent',[['ДВ','ok','Дмитрий В.','Отпуск до пятницы'],['ЕН','ok','Елена Н.','Отпуск, вернётся в понедельник'],['РМ','crit','Роман М.','Больничный, выход в пятницу']]);
  return `<h2>Сегодня не на месте <span class="lab">${it.length} ${PL(it.length,'человек','человека','человек')}</span></h2><div class="list">`+it.map(x=>`<div class="item"><div style="display:flex;gap:10px;align-items:center">${AV(x[0],x[1])}<div class="t"><b>${x[2]}</b><small>${x[3]}</small></div></div></div>`).join('')+`</div>${MORE('Календарь отсутствий →')}`;});


/* ---- Срезы: точки, проекты, города, отделы ---- */
def('units',GROUPS[0],'По подразделениям',['m','l'],'m','',c=>{
  const h=HOME(),us=h?h.units():[];
  if(!us.length)return `<h2>По подразделениям</h2><p class="sub">Здесь будет видно, что происходит на каждой точке, проекте, в каждом городе или отделе.</p><a class="b d" href="customize.html#structure" style="align-self:flex-start;text-decoration:none">Добавить структуру компании</a>`;
  const sc=h.state().scope;
  return `<h2>По подразделениям <span class="lab">${us.length}</span></h2><div class="list">`+us.map(u=>{const a=hs(u.name)%3,r=hs(u.name+'r')%4;
    return `<button type="button" class="item unit" data-scope="${u.id}" aria-pressed="${sc===u.id}"><div class="t"><b>${esc(u.name)}</b><small>${UT[u.type]||''} · ${u.staff} ${PL(u.staff,'человек','человека','человек')}</small></div>${a?`<span class="pill">не на месте: ${a}</span>`:''}${r===0?'<span class="pill crit">есть просрочки</span>':r===1?'<span class="pill warn">скоро сроки</span>':'<span class="pill ok">в порядке</span>'}</button>`;}).join('')+`</div><span class="lab">Нажмите на строку, чтобы посмотреть главную только по этому подразделению</span>`;});
/* ---- Блоки под отрасли ---- */
def('swap',GROUPS[0],'Подмены и обмен сменами',['m'],'m','',c=>`
  <h2>Подмены и обмены</h2>
  <div class="list">
   <div class="item"><div class="t"><b>${D(c,'swapA','Анна К. ↔ Игорь С.')}</b><small>Просят обменяться сменой · пятница</small></div>${B('Согласовать','d')}</div>
   <div class="item"><div class="t"><b>Нужна подмена: ${D(c,'swapB','Роман М.')}</b><small>Больничный · вторник, вечерняя смена</small></div>${B('Найти замену','l')}</div>
  </div><p class="sub">Три сотрудника готовы выйти по звонку</p>`);
def('points',GROUPS[0],D(null,'x','Точки сегодня'),['m','l'],'l','',c=>{
  const it=D(c,'points',[['Точка 1','6 из 6','ok'],['Точка 2','4 из 5, не хватает 1','warn'],['Точка 3','5 из 5','ok']]);
  return `<h2>${D(c,'pointsTitle','Точки сегодня')}</h2><div class="tiles">`+it.map(x=>`<div class="tile ${x[2]==='warn'?'lamp':''}"><span>${x[0]}</span><b style="font-size:17px">${x[1]}</b></div>`).join('')+`</div>${MORE('Расписание по точкам →')}`;});
def('probation',GROUPS[1],'Новички и испытательный срок',['m'],'m','',c=>`
  <h2>Новички</h2><p class="sub">${D(c,'probSub','2 новичка на испытательном сроке')}</p>
  <ul class="bul"><li class="w2">${D(c,'prob1','Ольга П.: срок заканчивается через 6 дней, нужно решение')}</li><li class="c">Не ознакомлены с правилами: 1 человек</li><li class="g">Остальные документы подписаны</li></ul>${MORE('Решить по новичкам →')}`);
def('fixedterm',GROUPS[1],'Срочные договоры',['m'],'m','',c=>`
  <h2>Срочные договоры</h2><p class="sub">${D(c,'ftSub','9 срочных договоров')}</p>
  <ul class="bul"><li class="c">Заканчиваются в течение 14 дней: 3</li><li class="w2">Нужно решить: продлить или перевести в бессрочные: 2</li><li class="g">Остальные в срок</li></ul>${MORE('Открыть список →')}`);
def('contractors',GROUPS[1],'Самозанятые и подрядчики',['m'],'m','',c=>`
  <h2>Самозанятые и подрядчики</h2><p class="sub">${D(c,'ctSub','5 человек вне штата')}</p>
  <ul class="bul"><li class="w2">Чек за месяц не получен: 2</li><li class="c">Признаки трудовых отношений: 1 человек, проверить договор</li><li class="g">Остальные договоры в порядке</li></ul>${MORE('Проверить договоры →')}`);
def('certs',GROUPS[1],'Допуски и сертификаты',['m'],'m','',c=>{
  const it=D(c,'certs',[['Сертификат специалиста','Мария Т.','40 дней','warn'],['Удостоверение','Павел Н.','просрочено','crit'],['Допуск','Екатерина Л.','5 месяцев','ok']]);
  return `<h2>Допуски и сертификаты</h2><div class="list">`+it.map(x=>`<div class="item"><div class="t"><b>${x[0]}</b><small>${x[1]}</small></div><span class="pill ${x[3]}">${x[2]}</span></div>`).join('')+`</div>${MORE('Все допуски →')}`;});
def('sites',GROUPS[0],'Объекты: кто где',['m','l'],'l','',c=>{
  const it=D(c,'sites',[['Объект А','9 человек','ok'],['Объект Б','7 человек','ok'],['Без назначения','2 человека','warn']]);
  return `<h2>${D(c,'sitesTitle','Объекты: кто где')}</h2><div class="tiles">`+it.map(x=>`<div class="tile ${x[2]==='warn'?'lamp':''}"><span>${x[0]}</span><b style="font-size:17px">${x[1]}</b></div>`).join('')+`</div>${MORE('Расстановка по объектам →')}`;});
def('rest',GROUPS[2],'Режим труда и отдыха',['m'],'m','',c=>`
  <h2>Режим труда и отдыха</h2><p class="sub">Водители: часы за неделю и отдых между рейсами</p>
  <ul class="bul"><li class="c">Валерий Т.: ${D(c,'restTop','54 из 56 часов за неделю, в рейс завтра нельзя')}</li><li class="w2">Отдых меньше 11 часов: 1 водитель</li><li class="g">Остальные в норме</li></ul>${MORE('Открыть режим →')}`);
def('ppe',GROUPS[2],'Спецодежда и СИЗ',['m'],'m','',c=>`
  <h2>Спецодежда и СИЗ</h2><p class="sub">Выдача, сроки носки, личные карточки</p>
  <ul class="bul"><li class="c">Нужно выдать новичкам: 3 комплекта</li><li class="w2">Срок носки заканчивается: 5 позиций</li><li class="g">Личные карточки подписаны: ${D(c,'cards','21 из 24')}</li></ul>${MORE('Открыть выдачу →')}`);
def('hazard',GROUPS[2],'Вредные условия и СОУТ',['m'],'m','',c=>`
  <h2>Вредные условия</h2><p class="sub">Рабочие места, доплаты, оценка условий труда</p>
  <ul class="bul"><li class="w2">Специальная оценка условий труда: срок через 11 месяцев</li><li class="g">Рабочих мест с вредными условиями: 6</li><li class="g">Доплаты и дополнительный отпуск настроены у 6 сотрудников</li></ul>${MORE('Открыть раздел →')}`);
def('remote',GROUPS[2],'Удалёнка и офис',['m'],'m','',c=>`
  <h2>Удалёнка и офис</h2><p class="sub">Сегодня в офисе 9, на удалёнке 11</p>
  <ul class="bul"><li class="w2">Дистанционный договор не оформлен: 2 человека</li><li class="g">Остальные 9 оформлены</li></ul>${MORE('Открыть график →')}`);
def('birthdays',GROUPS[3],'Дни рождения и годовщины',['m'],'m','sand',c=>`
  <h2>Дни рождения и годовщины</h2><p class="sub">Сегодня: Мария Д.</p>
  <div class="chips">${B('Поздравить')}${B('Эта неделя: 3')}</div>`);


/* ---- Демо-данные по отраслям: подставляются в блоки, когда выбран шаблон ---- */
const DEMO={
 cafe:{who:['Ирина','Кофейни «Зерно»','Петрова'],docs:['112','не хватает 2','истекают 3'],med:[1, 3, 10],staff:['14','+1 за месяц','2 на испытательном'],vac:['21 дн.','у 2 сотрудников'],dec:[['АК','Анна К.','обмен сменой на пятницу с Игорем С.','Оба согласны, часов в неделю не больше нормы',0],['ИС','Игорь С.','отпрашивается с 16:00, учёба','Подмена найдена: Анна К.',0],['МТ','Мария Т.','отпуск, 7 дней','Пересечение: в эти дни отдыхает 1 бариста',1]],
  shifts:[['Утро 07–15','4 человека','lamp'],['Вечер 15–23','4 человека','night'],['Выходной или отпуск','6 человек','']],
  tasks:[['Просрочено','Медкнижка не продлена: Мария Т. Не допускать к смене','Напомнить'],['Завтра','Студент Артём Н. отработал 38 часов на этой неделе, пересмотреть график','Открыть график'],['Через 9 дней','Заканчивается срок договора: Дарья К.','Продлить']],
  hr:[['c','Просрочена медкнижка: 1 человек'],['w2','Новички без ознакомления с правилами: 1'],['g','12 личных дел в порядке']],
  absent:[['АН','ok','Анастасия Н.','Отпуск до пятницы'],['РМ','crit','Роман М.','Больничный, выход в пятницу'],['ДК','warn','Дарья К.','Учёба, вернётся в четверг']],
  ftSub:'5 студентов на срочных договорах',prob1:'Артём Н.: срок заканчивается через 6 дней, нужно решение'},
 office:{who:['Олег','IT-студия «Пиксель»','Зайцев'],staff:['20','+2 за месяц','3 на испытательном'],vac:['190 дн.','у 9 сотрудников'],dec:[['АП','Анна П.','отпуск, 14 дней','Пересечение: в эти дни отдыхает 1 разработчик из её команды',1],['ИС','Игорь С.','переход на удалёнку, 3 дня в неделю','Нужен дистанционный договор',0],['ЕН','Елена Н.','командировка, 3 дня','Приказ и суточные подготовлены',0]],
  tasks:[['Просрочено','Отпуск за прошлый год не использован: 6 сотрудников','Запланировать'],['Через 20 дней','Заканчивается испытательный срок: Анна П.','Решить'],['Документы','Нет согласия на персональные данные: 3 сотрудника','На подпись']],
  absent:[['ДВ','ok','Дмитрий В.','Отпуск до пятницы'],['ЕН','ok','Елена Н.','Работает удалённо'],['РМ','crit','Роман М.','Больничный, выход в пятницу']],probSub:'3 новичка',prob1:'Анна П.: срок заканчивается через 20 дней, нужно решение'},
 base:{who:['Максим','Ваша компания']}
};
const T=(id,title,sub,list)=>({id,title,sub,list});
const TPL=[
 T('base','Базовая','Что нужно всем',['kStaff:m','kVac:m','tasks','decisions','absent','calendar','hr','knowledge:m']),
 T('cafe','Общепит и кофейни','Смены, медкнижки, подмены',['kStaff:m','kDocs:m','shifts','absent','tasks','swap','med','fixedterm','knowledge:m','decisions:l']),
 T('office','Офис и IT','Отпуска, удалёнка, новички',['kStaff:m','sick:m','leave','remote','decisions','tasks','probation','benefits','knowledge:l'])
];
window.SHTATKA_WIDGETS={W,GROUPS,TPL,DEMO,UT,order:Object.keys(W)};
})();
