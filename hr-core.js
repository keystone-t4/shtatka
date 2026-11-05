/* Кадровое ядро Штатки: один сотрудник — одна запись. Все разделы (воинский учёт, иностранцы, зарплата,
   больничные, документы и сроки, трудовая книжка, архив) считаются из неё и сами меняются при приёме и увольнении.
   Правила помечены «проверить»: перед боевым запуском их сверяет юрист. Хранение — localStorage; с сервером заменить load()/save(). */
(function(){
const H=window.SHTATKA_HOME;
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const uid=()=>Math.random().toString(36).slice(2,9);
const S0=H.state();
const demo=()=>!H.real()||!!S0.demoView;
const KEY=()=>demo()?'shtatka-hr-demo':'shtatka-hr-v1';

/* ---------- даты ---------- */
const D=s=>{if(!s)return null;const d=new Date(s+'T12:00:00');return isNaN(d)?null:d;};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return iso(d);};
/* Рабочие дни без учёта праздников: в боевой версии подключим производственный календарь. */
const addWork=(s,n)=>{const d=D(s);let k=0;while(k<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)k++;}return iso(d);};
const nextWork=s=>addWork(s,1);
const workDaysIn=(y,m)=>{let n=0;const l=new Date(y,m+1,0).getDate();for(let i=1;i<=l;i++){const w=new Date(y,m,i).getDay();if(w!==0&&w!==6)n++;}return n;};
const age=(birth,at)=>{const b=D(birth);if(!b)return null;const t=at?D(at):new Date();let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a;};
const fmtD=s=>{const d=D(s);return d?d.toLocaleDateString('ru-RU'):'—';};
const diffDays=(a,b)=>Math.round((D(b)-D(a))/864e5);

/* ---------- справочники ---------- */
const CONTRACT={open:'Трудовой бессрочный',fixed:'Трудовой срочный',gph:'Договор ГПХ',self:'Самозанятый'};
const REGIME={ru:'Гражданин РФ',eaeu:'Гражданин ЕАЭС (Армения, Беларусь, Казахстан, Киргизия)',patent:'Иностранец по патенту',permit:'Иностранец с разрешением на работу',rvp:'С РВП или ВНЖ',hqs:'Высококвалифицированный специалист'};
const MILCAT={soldier:'Рядовой, сержантский состав',jr:'Младший офицер',sr:'Старший офицер',hi:'Высший офицер'};
const FIT={'':'не знаю','A':'А — годен','B':'Б — годен с незначительными ограничениями','V':'В — ограниченно годен','G':'Г — временно не годен','D':'Д — не годен'};
/* Предельный возраст пребывания в запасе (ФЗ «О воинской обязанности и военной службе», ст. 53). Проверить по действующей редакции. */
function soldierLimit(year){return Math.min(55,50+Math.max(0,year-2023));}
function milLimit(e,year){
  const f=e.sex==='f';
  if(e.milCat==='jr')return f?50:60;if(e.milCat==='sr')return f?50:65;if(e.milCat==='hi')return f?50:70;
  return f?45:soldierLimit(year);
}
const FIRE={
 own:{t:'По собственному желанию',a:'п. 3 ч. 1 ст. 77, ст. 80 ТК',note:'Заявление работника, отработка 2 недели (если не договорились иначе).'},
 mutual:{t:'По соглашению сторон',a:'п. 1 ч. 1 ст. 77, ст. 78 ТК',note:'Соглашение подписывают обе стороны.'},
 term:{t:'Истёк срок договора',a:'п. 2 ч. 1 ст. 77 ТК',note:'Предупредите работника письменно не позднее чем за 3 дня до окончания срока (ст. 79 ТК).'},
 trial:{t:'Не прошёл испытательный срок',a:'ст. 71 ТК',note:'Предупредите письменно за 3 дня с указанием причин; нужны документы, подтверждающие неудовлетворительный результат.'},
 absent:{t:'Прогул',a:'пп. «а» п. 6 ч. 1 ст. 81 ТК',note:'Нужны акт об отсутствии, запрос объяснений (2 рабочих дня на ответ, ст. 193 ТК), приказ в течение месяца со дня обнаружения. Без документов увольнение оспорят.'},
 cut:{t:'Сокращение штата',a:'п. 2 ч. 1 ст. 81 ТК',note:'Предупредить за 2 месяца под подпись, предложить вакансии, выплатить выходное пособие (ст. 178 ТК). Лучше с юристом.'}
};

/* ---------- состояние ---------- */
let ST=null;
function seed(){
  const t=today();const y=new Date().getFullYear();
  const mk=(fio,sex,by,pos,sal,start,o)=>Object.assign({id:uid(),fio,sex,birth:by+'-0'+(1+Math.floor(Math.random()*8))+'-1'+Math.floor(Math.random()*9),regime:'ru',country:'Россия',position:pos,salary:sal,contract:'open',start,unit:'',phone:'',prev:[],tasks:[],sick:[],log:[],etk:{kind:'etk',sfr:null},hasVus:false,milCat:'',fit:'',vacDays:0},o||{});
  const E=[
   mk('Смирнов Алексей Игоревич','m',y-24,'Бариста',48000,y-1+'-03-12',{prev:[{org:'Кафе «Лето»',from:(y-5)+'-06-01',to:(y-1)+'-02-28',src:'выписка СФР'}],milCat:'soldier',fit:'A'}),
   mk('Петрова Мария Сергеевна','f',y-31,'Старший бариста',58000,(y-3)+'-09-01',{prev:[{org:'ООО «Вкус»',from:(y-9)+'-01-10',to:(y-3)+'-08-20',src:'выписка СФР'}]}),
   mk('Ким Рустам Азатович','m',y-38,'Повар',62000,(y-2)+'-05-15',{regime:'eaeu',country:'Киргизия'}),
   mk('Рахимов Бахтиёр Саидович','m',y-29,'Помощник повара',45000,t,{regime:'patent',country:'Узбекистан',permitNo:'78 №0012345',permitUntil:addDays(t,24)}),
   mk('Иванова Ольга Петровна','f',y-45,'Администратор',55000,(y-4)+'-02-01',{prev:[{org:'Отель «Причал»',from:(y-12)+'-04-01',to:(y-4)+'-01-15',src:'вручную'}]}),
   mk('Соколов Дмитрий Андреевич','m',y-54,'Водитель-экспедитор',65000,(y-6)+'-10-03',{milCat:'sr',fit:'B'}),
   mk('Орлова Елена Викторовна','f',y-27,'Кассир',44000,(y-1)+'-07-20',{hasVus:true,milCat:'soldier'}),
   mk('Громов Никита Павлович','m',y-19,'Помощник бариста',40000,y+'-04-01',{contract:'fixed'}),
   mk('Белова Татьяна Николаевна','f',y-36,'Бухгалтер',70000,(y-5)+'-03-01',{}),
   mk('Мирзоев Фаррух Рустамович','m',y-33,'Уборщик',38000,y+'-06-01',{regime:'rvp',country:'Таджикистан',permitNo:'РВП 83 №0045678',permitUntil:addDays(t,400)})
  ];
  E.forEach((e,i)=>{if(i===1)e.vacDays=14;e.tasks=hireTasks(e,true);e.tasks.forEach(k=>{if(k.due<addDays(t,-5))k.done=true;});e.log=[{at:new Date().toISOString(),t:'Принят на работу с '+fmtD(e.start)}];});
  E[0].sick=[{id:uid(),from:addDays(t,-2),to:addDays(t,3),no:'910 000 000 001',open:true}];
  E[1].etk.sfr={y:8,m:6,d:0,at:t};
  return {emps:E,archiveYears:5,mrotRegion:null,reg:'Санкт-Петербург'};
}
function load(){
  ST=get(KEY(),null);
  if(!ST){
    ST=demo()?seed():{emps:[],archiveYears:5,mrotRegion:null,reg:'Санкт-Петербург'};
    // перенос из первой версии раздела «Люди»
    if(!demo())(S0.employees||[]).forEach(o=>{const e=blank(o);e.legacy=true;ST.emps.push(e);});
    save();
  }
  ST.emps.forEach(e=>{e.prev=e.prev||[];e.tasks=e.tasks||[];e.sick=e.sick||[];e.log=e.log||[];e.etk=e.etk||{kind:'etk',sfr:null};});
  return ST;
}
function save(){put(KEY(),ST);}
function blank(o){return Object.assign({id:uid(),fio:'',sex:'m',birth:'',regime:'ru',country:'Россия',position:'',salary:0,contract:'open',start:today(),unit:'',phone:'',prev:[],tasks:[],sick:[],log:[],etk:{kind:'etk',sfr:null},hasVus:false,milCat:'',fit:'',vacDays:0},o||{});}

/* ---------- правила ---------- */
function isRu(e){return e.regime==='ru';}
/* Воинский учёт: кто подлежит. Не угадываем: если данных мало, статус «уточнить». */
function mil(e,at){
  const a=age(e.birth,at),y=(at?D(at):new Date()).getFullYear();
  if(!isRu(e))return {st:'no',why:'Иностранный гражданин: воинский учёт не ведётся.'};
  if(e.sex==='f'&&!e.hasVus)return {st:'no',why:'Женщины ставятся на учёт только при военно-учётной специальности (ВУС).'};
  if(e.fit==='D')return {st:'no',why:'Категория годности Д: не годен к службе, на учёт не ставится.'};
  if(e.livesAbroad)return {st:'no',why:'Постоянно проживает за границей.'};
  if(a==null)return {st:'check',why:'Не указана дата рождения.'};
  if(a<18)return {st:'check',why:'Младше 18 лет: первоначальную постановку на учёт проводит военкомат.'};
  const lim=milLimit(e,y);
  if(a>=lim){
    if(!e.milCat&&e.sex==='m')return {st:'check',why:'Возраст '+a+': для рядового состава предел '+lim+', но для офицеров он выше. Уточните категорию запаса по военному билету.'};
    return {st:'out',why:'Достиг предельного возраста пребывания в запасе ('+lim+'). Сообщите в военкомат и снимите с учёта.'};
  }
  return {st:'in',why:e.sex==='f'?'Женщина с военно-учётной специальностью: подлежит воинскому учёту до '+lim+' лет.':a<=30?'Мужчина до 30 лет: призывной возраст, подлежит воинскому учёту.':'Военнообязанный запаса: подлежит воинскому учёту до предельного возраста ('+lim+').',age:a};
}
function foreign(e){
  if(isRu(e))return null;
  const left=e.permitUntil?diffDays(today(),e.permitUntil):null;
  const needDoc=e.regime==='patent'||e.regime==='permit'||e.regime==='hqs'||e.regime==='rvp';
  let lvl='ok',msg='Документы в порядке';
  if(e.regime==='eaeu'){msg='Патент не нужен (ЕАЭС). Уведомление МВД подаётся.';}
  else if(needDoc&&left==null){lvl='warn';msg='Не указан срок действия документа';}
  else if(left!=null&&left<0){lvl='crit';msg='Документ просрочен '+(-left)+' дн. назад: допуск к работе запрещён';}
  else if(left!=null&&left<=30){lvl='warn';msg='Документ истекает через '+left+' дн.';}
  return {lvl,msg,left};
}
/* Стаж: у нас + прошлые места. Пересекающиеся периоды склеиваем, чтобы не считать дважды. */
function periods(e){
  const out=(e.prev||[]).filter(p=>p.from&&p.to).map(p=>[p.from,p.to]);
  out.push([e.start,e.out?e.out.date:today()]);
  out.sort((a,b)=>a[0]<b[0]?-1:1);
  const m=[];out.forEach(p=>{const l=m[m.length-1];if(l&&p[0]<=addDays(l[1],1)){if(p[1]>l[1])l[1]=p[1];}else m.push(p.slice());});
  return m;
}
function ymd(days){const y=Math.floor(days/365.25);let r=days-Math.round(y*365.25);const m=Math.floor(r/30.4375);r=Math.round(r-m*30.4375);return {y,m,d:Math.max(0,r)};}
function stazh(e){
  const own=Math.max(0,diffDays(e.start,e.out?e.out.date:today())+1);
  const total=periods(e).reduce((a,p)=>a+Math.max(0,diffDays(p[0],p[1])+1),0);
  const prev=Math.max(0,total-own);
  const r={own:ymd(own),prev:ymd(prev),total:ymd(total),totalDays:total,ownDays:own};
  if(e.etk&&e.etk.sfr){const sd=e.etk.sfr.y*365.25+e.etk.sfr.m*30.4375+e.etk.sfr.d;r.sfrDays=Math.round(sd);r.gap=Math.round(total-sd);r.match=Math.abs(r.gap)<=31;}
  return r;
}
const fmtY=o=>o.y+' л. '+o.m+' мес. '+o.d+' дн.';

/* ---------- задачи (сроки) ---------- */
function T(key,title,due,law,extra){return Object.assign({id:uid(),key,title,due,law,done:false},extra||{});}
function hireTasks(e,quiet){
  const s=e.start,t=[];
  t.push(T('td','Подписать трудовой договор',addWork(s,3),'ст. 67 ТК: не позднее 3 рабочих дней со дня фактического допуска'));
  t.push(T('order','Издать приказ о приёме и ознакомить работника под подпись',addWork(s,3),'ст. 68 ТК, форма Т-1: в 3 дня со дня подписания договора'));
  t.push(T('pd','Получить согласие на обработку персональных данных',s,'ст. 9 152-ФЗ: отдельный документ'));
  t.push(T('lna','Ознакомить с правилами внутреннего распорядка и должностной инструкцией',s,'ст. 68 и ст. 22 ТК'));
  t.push(T('ot','Провести вводный инструктаж по охране труда',s,'ст. 214 ТК'));
  t.push(T('card','Завести личную карточку Т-2',addWork(s,3),'Постановление Госкомстата № 1'));
  t.push(T('efs','Подать ЕФС-1 (подраздел 1.1): приём',nextWork(s),'Не позднее следующего рабочего дня после приказа (проверить)'));
  if(e.contract==='open'||e.contract==='fixed'){}
  const a=age(e.birth,s);
  if(a!=null&&a<18){t.push(T('med','Направить на обязательный медосмотр несовершеннолетнего',s,'ст. 69 и ст. 266 ТК; испытательный срок для них запрещён, ст. 70 ТК'));}
  const pos=(e.position||'').toLowerCase();
  if(/повар|бариста|официант|продавец|кассир|пекар|кондитер|официант|раздатч|буфетчик|кухон/.test(pos))t.push(T('medk','Оформить медосмотр и личную медицинскую книжку',addWork(s,14),'ст. 69 и ст. 213 ТК; санитарные правила для общепита и торговли продуктами (проверить)'));
  if(/водител|экспедитор|курьер.*авто/.test(pos))t.push(T('drv','Проверить водительское удостоверение и организовать предрейсовый медосмотр',s,'ст. 213 ТК, закон о безопасности дорожного движения (проверить)'));
  if(!isRu(e)){
    if(e.permitUntil&&(e.regime==='patent'||e.regime==='permit'))t.push(T('renew','Продлить патент или разрешение: срок заканчивается',addDays(e.permitUntil,-14),'Работать без действующего документа нельзя',{mod:'foreign'}));
    t.push(T('mvd','Подать уведомление в МВД о приёме иностранного работника',addWork(s,3),'п. 8 ст. 13 115-ФЗ: 3 рабочих дня с даты договора; штраф юрлицу ст. 18.15 КоАП (проверить)',{mod:'foreign'}));
    if(e.regime==='patent'||e.regime==='permit'||e.regime==='hqs')t.push(T('doc','Проверить патент или разрешение на работу и срок',s,'Работать можно только по профессии и в регионе, указанным в документе',{mod:'foreign'}));
    if(e.regime==='patent')t.push(T('dms','Получить полис ДМС или договор мед. помощи от патентника',addWork(s,30),'пп. 6 п. 1 ст. 13 115-ФЗ (проверить)',{mod:'foreign'}));
  }else{
    const m=mil(e,s);
    if(m.st==='in'||m.st==='check')t.push(T('mil',m.st==='in'?'Сообщить в военкомат о приёме на работу':'Уточнить воинский учёт и сообщить в военкомат',addWork(s,5),'Положение о воинском учёте, п. 32: 5 рабочих дней (проверить)',{mod:'military'}));
  }
  return t;
}
function fireTasks(e,f){
  const d=e.out.date,t=[];
  t.push(T('fOrder','Издать приказ об увольнении (Т-8), ознакомить под подпись',d,f.a+'; ст. 84.1 ТК'));
  t.push(T('fPay','Выплатить все суммы и компенсацию за неиспользованный отпуск',d,'ст. 140 и ст. 127 ТК: в последний рабочий день'));
  t.push(T('fBook','Выдать сведения о трудовой деятельности (СТД-Р) или трудовую книжку',d,'ст. 66.1 и ст. 84.1 ТК: в последний рабочий день'));
  t.push(T('fEfs','Подать ЕФС-1 (подраздел 1.1): увольнение',nextWork(d),'Не позднее следующего рабочего дня после приказа (проверить)'));
  t.push(T('fCard','Закрыть личную карточку Т-2 и сдать личное дело в архив',addWork(d,3),'Перечень типовых архивных документов (приказ Росархива № 236)'));
  if(e.out.reason==='absent'){t.unshift(T('fAct','Составить акт о прогуле и запросить письменное объяснение',d,f.a+', ст. 193 ТК: работнику 2 рабочих дня на объяснение'));}
  if(!isRu(e))t.push(T('mvdOut','Подать уведомление в МВД о прекращении договора',addWork(d,3),'п. 8 ст. 13 115-ФЗ: 3 рабочих дня (проверить)',{mod:'foreign'}));
  else{const m=mil(e,e.start);if(m.st==='in'||m.st==='check'||m.st==='out')t.push(T('milOut','Сообщить в военкомат об увольнении',addWork(d,5),'Положение о воинском учёте, п. 32: 5 рабочих дней (проверить)',{mod:'military'}));}
  return t;
}
const OPEN_KEYS_ON_FIRE=null;

/* ---------- операции ---------- */
function log(e,txt){e.log.unshift({at:new Date().toISOString(),t:txt});}
function hire(data){
  const e=blank(data);e.fio=(e.fio||'').trim().replace(/\s+/g,' ');
  e.regime=e.regime||'ru';if(e.regime==='ru')e.country='Россия';
  e.tasks=hireTasks(e);
  if(data.existing){e.tasks.forEach(t=>{t.done=true;});e.tasks=[];log(e,'Внесён как действующий сотрудник');}
  else log(e,'Принят на работу с '+fmtD(e.start));
  ST.emps.push(e);save();return e;
}
function fire(id,reason,date,note){
  const e=ST.emps.find(x=>x.id===id);if(!e||e.out)return null;
  const f=FIRE[reason]||FIRE.own;
  e.out={date,reason,note:note||'',at:today()};
  e.tasks=fireTasks(e,f);
  e.sick.forEach(s=>{s.open=false;});
  log(e,'Уволен '+fmtD(date)+': '+f.t+' ('+f.a+')');
  save();return e;
}
function restore(id){const e=ST.emps.find(x=>x.id===id);if(!e||!e.out)return;delete e.out;e.tasks=[];log(e,'Возвращён из архива');save();}
function purge(id){ST.emps=ST.emps.filter(x=>x.id!==id);save();}
function remove(id){purge(id);}
function update(id,patch){const e=ST.emps.find(x=>x.id===id);if(!e)return null;Object.assign(e,patch);
  // изменились данные — пересчитываем зависимые поручения, не трогая выполненные
  if(!e.out){const fresh=hireTasks(e);fresh.forEach(n=>{const o=e.tasks.find(t=>t.key===n.key);if(o)return;if(!e.legacy&&!e.noAuto)e.tasks.push(n);});
    // убрать невалидные: например, военкомат у иностранца
    e.tasks=e.tasks.filter(t=>!(t.mod==='military'&&!['in','check'].includes(mil(e).st)&&!t.done)&&!(t.mod==='foreign'&&isRu(e)&&!t.done));}
  save();return e;}
function addSick(id,s){const e=ST.emps.find(x=>x.id===id);if(!e)return;e.sick.unshift(Object.assign({id:uid(),open:true},s));log(e,'Больничный '+fmtD(s.from)+' — '+fmtD(s.to));save();}
function closeSick(id,sid){const e=ST.emps.find(x=>x.id===id);if(!e)return;const s=e.sick.find(x=>x.id===sid);if(s){s.open=false;}save();}
function doneTask(id,tid,v){const e=ST.emps.find(x=>x.id===id);if(!e)return;const t=e.tasks.find(x=>x.id===tid);if(t){t.done=v!==false;}save();}

/* ---------- производные списки ---------- */
const active=()=>ST.emps.filter(e=>!e.out);
const archived=()=>ST.emps.filter(e=>e.out);
const onSick=(e,at)=>{const t=at||today();return (e.sick||[]).some(s=>s.from<=t&&s.to>=t);};
function allTasks(){const r=[];active().concat(archived()).forEach(e=>e.tasks.forEach(t=>r.push(Object.assign({},t,{eid:e.id,fio:e.fio}))));return r;}
const openTasks=()=>allTasks().filter(t=>!t.done);
const overdue=()=>openTasks().filter(t=>t.due<today());
function purgeOn(e){if(!e.out)return null;const d=D(e.out.date);d.setFullYear(d.getFullYear()+(ST.archiveYears||5));return iso(d);}

/* ---------- отпуск ---------- */
/* 28 календарных дней в год = 2,33 дня за отработанный месяц (ст. 115, 122 ТК). Первый отпуск можно взять после 6 месяцев работы. */
function vacation(e){
  const end=e.out?e.out.date:today();
  const months=Math.max(0,diffDays(e.start,end)/30.4375);
  const acc=Math.round(months*28/12*10)/10;
  const used=+e.vacUsed||0;
  const left=Math.max(0,Math.round((acc-used)*10)/10);
  const sal=+e.salary||0;
  const comp=Math.round(left*sal/29.3);
  return {acc,used,left,comp,canTake:months>=6};
}
/* ---------- МРОТ ---------- */
/* Значения: 27 093 ₽ с 01.01.2026 и 28 935 ₽ по плану с 01.01.2027 (по сообщениям СМИ; закон о размере на 2027 год проверить). Региональный размер вносит пользователь. */
const MROT={y2026:27093,y2027:28935};
const mrotNow=()=>ST.mrotRegion||MROT.y2026;

/* ---------- зарплата за месяц (оценка) ---------- */
/* НДФЛ по прогрессивной шкале с 2025 года, нарастающим итогом с начала года (ст. 224 НК РФ; проверить). Пороги дохода за год и ставки. */
const NDFL=[[2400000,.13],[5000000,.15],[20000000,.18],[50000000,.20],[Infinity,.22]];
function ndflYear(inc){let tax=0,prev=0;for(const [lim,r] of NDFL){if(inc>prev)tax+=(Math.min(inc,lim)-prev)*r;prev=lim;if(inc<=lim)break;}return Math.round(tax);}
const ndflRate=inc=>NDFL.find(x=>inc<=x[0])[1];
function payroll(y,m){const rows=payrollMonth(y,m);
  rows.forEach(r=>{let ytd=0;for(let k=0;k<m;k++){const o=payrollMonth(y,k).find(x=>x.e.id===r.e.id);if(o)ytd+=o.gross;}
    r.ytd=ytd+r.gross;r.ndfl=ndflYear(ytd+r.gross)-ndflYear(ytd);r.rate=ndflRate(ytd+r.gross);r.pay=r.gross-r.ndfl;});
  return rows;}
function payrollMonth(y,m){
  const norm=workDaysIn(y,m),rows=[];
  const first=iso(new Date(y,m,1)),last=iso(new Date(y,m+1,0));
  ST.emps.forEach(e=>{
    if(e.contract==='gph'||e.contract==='self')return;
    if(e.start>last)return;if(e.out&&e.out.date<first)return;
    const from=e.start>first?e.start:first,to=e.out&&e.out.date<last?e.out.date:last;
    let wd=0;for(let d=D(from);iso(d)<=to;d.setDate(d.getDate()+1)){const w=d.getDay();if(w!==0&&w!==6)wd++;}
    let sick=0;(e.sick||[]).forEach(s=>{for(let d=D(s.from>from?s.from:from);iso(d)<=(s.to<to?s.to:to);d.setDate(d.getDate()+1)){const w=d.getDay();if(w!==0&&w!==6){sick++;}}});
    const worked=Math.max(0,wd-sick);
    const sal=+e.salary||0;
    const accr=Math.round(sal*worked/norm);
    // больничный: первые 3 дня за счёт работодателя, дальше ФСС; здесь грубая оценка через дневной заработок
    const daily=sal*12/730;const sickPay=Math.round(Math.min(sick,3)*daily*1);
    const gross=accr+sickPay,ndfl=Math.round(gross*0.13);
    rows.push({e,norm,wd,sick,worked,accr,sickPay,gross,ndfl,pay:gross-ndfl,contrib:Math.round(gross*0.302),low:sal>0&&sal<mrotNow()});
  });
  return rows;
}

/* ---------- документы ---------- */
const DOCS=[
 ['td','Трудовой договор',e=>true],
 ['order','Приказ о приёме на работу (Т-1)',e=>true],
 ['pd','Согласие на обработку персональных данных',e=>true],
 ['card','Личная карточка (Т-2)',e=>true],
 ['mil','Сведения о приёме для военкомата',e=>!e.out&&['in','check'].includes(mil(e).st)],
 ['mvd','Данные для уведомления МВД',e=>!isRu(e)],
 ['fire','Приказ об увольнении (Т-8)',e=>!!e.out],
 ['milOut','Сведения об увольнении для военкомата',e=>!!e.out&&['in','check','out'].includes(mil(e,e.start).st)],
];
const docsFor=e=>DOCS.filter(d=>d[2](e));
function docHtml(e,key){
  const co=(H.session()||{}),F=x=>x||'__________';
  const org=F(co.company),inn=co.inn?', ИНН '+co.inn:'';
  const head='<p><b>'+org+'</b>'+inn+'</p>';
  const who='<b>'+F(e.fio)+'</b>';
  const sal=e.salary?Number(e.salary).toLocaleString('ru-RU')+' ₽ в месяц':'__________';
  const T_={
   td:'<h3>Трудовой договор</h3>'+head+'<p>Работодатель и '+who+', дата рождения '+fmtD(e.birth)+', заключили договор о том, что работник принимается на должность «'+F(e.position)+'» с '+fmtD(e.start)+(e.contract==='fixed'?' на определённый срок':' на неопределённый срок')+'. Оклад: '+sal+'. Остальные условия по ст. 57 ТК вносит работодатель.</p><p class="d">Черновик по данным карточки. Перед подписью проверьте и дополните по ст. 57 ТК.</p>',
   order:'<h3>Приказ о приёме работника на работу (форма Т-1)</h3>'+head+'<p>Принять '+who+' на должность «'+F(e.position)+'» с '+fmtD(e.start)+(e.contract==='fixed'?', на определённый срок':', без испытательного срока или с ним по договору')+', оклад '+sal+'.</p><p>Руководитель ____________ &nbsp; Работник ознакомлен ____________</p>',
   pd:'<h3>Согласие на обработку персональных данных</h3>'+head+'<p>Я, '+who+', даю согласие оператору на обработку моих персональных данных в целях оформления и ведения трудовых отношений. Перечень данных, срок и порядок отзыва согласия указаны в приложенном перечне. Согласие оформляется отдельным документом.</p><p>Дата ____________ Подпись ____________</p>',
   card:'<h3>Личная карточка работника (Т-2)</h3>'+head+'<table><tr><td>ФИО</td><td>'+F(e.fio)+'</td></tr><tr><td>Дата рождения</td><td>'+fmtD(e.birth)+'</td></tr><tr><td>Пол</td><td>'+(e.sex==='f'?'женский':'мужской')+'</td></tr><tr><td>Гражданство</td><td>'+F(e.country)+'</td></tr><tr><td>Должность</td><td>'+F(e.position)+'</td></tr><tr><td>Принят</td><td>'+fmtD(e.start)+'</td></tr><tr><td>Воинский учёт</td><td>'+(isRu(e)?(e.milDoc?F(e.milDoc)+', '+(MILCAT[e.milCat]||''):'данные внесите из военного билета'):'не ведётся (иностранный гражданин)')+'</td></tr><tr><td>Предыдущий стаж</td><td>'+fmtY(stazh(e).prev)+'</td></tr></table>',
   mil:'<h3>Сведения о принятом работнике для военного комиссариата</h3>'+head+'<p>Сообщаем, что с '+fmtD(e.start)+' принят '+who+', '+fmtD(e.birth)+' г. р., должность «'+F(e.position)+'». Воинское звание '+F(e.rank)+', ВУС '+F(e.vus)+', категория запаса: '+(MILCAT[e.milCat]||'')+', категория годности: '+(FIT[e.fit]||'')+'. Военный билет '+F(e.milDoc)+'.</p><p>Срок отправки: 5 рабочих дней. Сверьте с формой военкомата своего района.</p>',
   mvd:'<h3>Данные для уведомления МВД о приёме иностранного работника</h3>'+head+'<table><tr><td>ФИО</td><td>'+F(e.fio)+'</td></tr><tr><td>Гражданство</td><td>'+F(e.country)+'</td></tr><tr><td>Режим</td><td>'+(REGIME[e.regime]||'')+'</td></tr><tr><td>Документ</td><td>'+F(e.permitNo)+' до '+fmtD(e.permitUntil)+'</td></tr><tr><td>Должность</td><td>'+F(e.position)+'</td></tr><tr><td>Начало работы</td><td>'+fmtD(e.start)+'</td></tr></table><p class="d">Подаётся через Госуслуги или в территориальный орган МВД. Срок: 3 рабочих дня. С 01.09.2026 указывается срок действия договора и согласие иностранца на обработку данных (проверить).</p>',
   fire:e.out?'<h3>Приказ о прекращении трудового договора (форма Т-8)</h3>'+head+'<p>Прекратить действие трудового договора с '+who+', должность «'+F(e.position)+'», уволить '+fmtD(e.out.date)+'. Основание: '+(FIRE[e.out.reason]||{}).t+' ('+(FIRE[e.out.reason]||{}).a+').</p><p>Выплатить все причитающиеся суммы, включая компенсацию за неиспользованный отпуск. Руководитель ____________ &nbsp; Работник ознакомлен ____________</p>':'',
   milOut:'<h3>Сведения об увольнении работника для военного комиссариата</h3>'+head+'<p>Сообщаем, что '+who+', '+fmtD(e.birth)+' г. р., уволен '+(e.out?fmtD(e.out.date):'')+'. Срок отправки: 5 рабочих дней.</p>'
  };
  return T_[key]||'';
}

/* ---------- публичное API ---------- */
load();
window.SHTATKA_HR={
  load,save,state:()=>ST,demo,
  emps:()=>ST.emps,active,archived,onSick,get:id=>ST.emps.find(e=>e.id===id),
  hire,fire,restore,purge,remove,update,addSick,closeSick,doneTask,
  mil,foreign,stazh,fmtY,periods,age,vacation,
  allTasks,openTasks,overdue,purgeOn,payroll,ndflYear,ndflRate,NDFL,workDaysIn,
  docsFor,docHtml,MROT,mrotNow,
  CONTRACT,REGIME,MILCAT,FIT,FIRE,soldierLimit,milLimit,
  d:{D,iso,today,addDays,addWork,nextWork,fmt:fmtD,diff:diffDays},
  setArchiveYears(n){ST.archiveYears=n;save();},
  setMrotRegion(v){ST.mrotRegion=v||null;save();},
  newDemo(){try{localStorage.removeItem('shtatka-hr-demo')}catch(e){}load();}
};
/* Остальные разделы кабинета видят только действующих сотрудников */
H.employees=()=>active();
H.addEmployee=e=>hire(Object.assign({fio:e.fio,position:e.position,contract:e.contract,start:e.start,unit:e.unit,phone:e.phone,existing:e.kind==='existing'},e));
H.removeEmployee=id=>remove(id);
})();
