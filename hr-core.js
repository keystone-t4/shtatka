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
const KEY=()=>demo()?'shtatka-hr-demo-'+demoKind():'shtatka-hr-v1';

/* ---------- даты ---------- */
const D=s=>{if(!s)return null;const d=new Date(s+'T12:00:00');return isNaN(d)?null:d;};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return iso(d);};
/* Рабочие дни: по производственному календарю (calendar-data.js), для лет вне календаря только по будням. */
const CAL=window.SHTATKA_CAL;
const addWork=(s,n)=>{if(CAL)return CAL.addWork(s,n);const d=D(s);let k=0;while(k<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)k++;}return iso(d);};
const nextWork=s=>addWork(s,1);
const isWd=s=>{if(CAL)return CAL.isWork(s);const w=D(s).getDay();return w!==0&&w!==6;};
const workDaysIn=(y,m)=>{if(CAL)return CAL.workDaysIn(y,m);let n=0;const l=new Date(y,m+1,0).getDate();for(let i=1;i<=l;i++){const w=new Date(y,m,i).getDay();if(w!==0&&w!==6)n++;}return n;};
const age=(birth,at)=>{const b=D(birth);if(!b)return null;const t=at?D(at):new Date();let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a;};
const fmtD=s=>{const d=D(s);return d?d.toLocaleDateString('ru-RU'):'—';};
const diffDays=(a,b)=>Math.round((D(b)-D(a))/864e5);

/* ---------- справочники ---------- */
const CONTRACT={open:'Трудовой бессрочный',fixed:'Трудовой срочный',gph:'Договор ГПХ (работы, услуги)',self:'Самозанятый',rent:'Аренда имущества у физлица'};
const LABOR=c=>c==='open'||c==='fixed';
const REGIME={ru:'Паспорт РФ',foreign:'Иностранный паспорт'};
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
function demoKind(){
  let k='';try{k=new URLSearchParams(location.search).get('tpl')||''}catch(e){}
  if(!k){const st=String(S0.start||'');k=st.startsWith('tpl:')?st.slice(4):''}
  return k==='office'?'office':'cafe';
}
function seed(kind){
  const t=today();const y=new Date().getFullYear();
  const mk=(fio,sex,by,pos,sal,start,o)=>Object.assign({id:uid(),fio,sex,birth:by+'-0'+(1+Math.floor(Math.random()*8))+'-1'+Math.floor(Math.random()*9),regime:'ru',country:'Россия',position:pos,salary:sal,contract:'open',start,unit:'',phone:'',prev:[],tasks:[],sick:[],log:[],etk:{kind:'etk',sfr:null},hasVus:false,milCat:'',fit:'',vacDays:0},o||{});
  const ago=n=>addDays(t,-n),fwd=n=>addDays(t,n);
  let E;
  if(kind==='office'){
    E=[
     mk('Зайцев Олег Андреевич','m',y-41,'Директор',220000,(y-6)+'-02-01',{milCat:'sr',fit:'A'}),
     mk('Белова Татьяна Николаевна','f',y-36,'HR-менеджер',110000,(y-3)+'-03-01'),
     mk('Орлова Мария Викторовна','f',y-39,'Бухгалтер',100000,(y-4)+'-09-01'),
     mk('Громова Софья Павловна','f',y-27,'Офис-менеджер',70000,(y-2)+'-05-12'),
     mk('Смирнов Кирилл Игоревич','m',y-31,'Разработчик',210000,(y-3)+'-06-01',{remote:true,milCat:'soldier',fit:'A'}),
     mk('Соколов Павел Андреевич','m',y-34,'Ведущий разработчик',280000,(y-5)+'-01-15',{remote:true}),
     mk('Каримов Марат Ильдарович','m',y-28,'Разработчик',190000,(y-1)+'-10-01',{remote:true}),
     mk('Валиев Дмитрий Сергеевич','m',y-30,'Разработчик',200000,(y-2)+'-02-10',{remote:true}),
     mk('Степанов Игорь Олегович','m',y-26,'Разработчик',185000,(y-1)+'-04-04',{hasVus:true,milCat:'soldier'}),
     mk('Ахметов Артур Ринатович','m',y-24,'Младший разработчик',120000,ago(25),{remote:true,probation:3}),
     mk('Павлова Анна Сергеевна','f',y-27,'Разработчик',190000,ago(70),{remote:true,probation:3}),
     mk('Волкова Алина Дмитриевна','f',y-29,'Дизайнер',150000,(y-2)+'-08-20',{remote:true}),
     mk('Ким Денис Артёмович','m',y-32,'DevOps-инженер',230000,(y-3)+'-11-01',{remote:true}),
     mk('Лебедев Виктор Николаевич','m',y-33,'Тестировщик',140000,(y-2)+'-03-15',{remote:true}),
     mk('Морозов Роман Алексеевич','m',y-35,'Тестировщик',135000,(y-4)+'-05-01'),
     mk('Фомина Ксения Андреевна','f',y-30,'Системный аналитик',170000,(y-2)+'-09-09',{remote:true}),
     mk('Новикова Елена Владимировна','f',y-34,'Руководитель проектов',200000,(y-4)+'-07-01',{remote:true}),
     mk('Власов Андрей Петрович','m',y-37,'Менеджер по продажам',130000,(y-3)+'-01-20'),
     mk('Крылова Наталья Евгеньевна','f',y-32,'Менеджер по продажам',125000,(y-1)+'-06-10'),
     mk('Миронова Юлия Игоревна','f',y-26,'Маркетолог',110000,ago(12),{probation:3})
    ];
    E[7].vacDays=14;E[14].sick=[{id:uid(),from:ago(2),to:fwd(3),no:'910 000 000 002',open:true}];
  }else{
    E=[
     mk('Петрова Ирина Сергеевна','f',y-38,'Управляющая',95000,(y-4)+'-02-01',{prev:[{org:'ООО «Вкус»',from:(y-12)+'-01-10',to:(y-4)+'-01-15',src:'выписка СФР'}]}),
     mk('Крылова Анна Андреевна','f',y-26,'Бариста',52000,(y-2)+'-05-12'),
     mk('Степанов Игорь Олегович','m',y-20,'Бариста',46000,(y-1)+'-09-01',{contract:'fixed',contractEnd:fwd(120)}),
     mk('Тимофеева Мария Сергеевна','f',y-31,'Старший бариста',62000,(y-3)+'-09-01',{prev:[{org:'Кафе «Лето»',from:(y-9)+'-06-01',to:(y-3)+'-08-20',src:'выписка СФР'}]}),
     mk('Назаров Артём Денисович','m',y-19,'Помощник бариста',40000,ago(84),{contract:'fixed',contractEnd:fwd(150),probation:3}),
     mk('Николаева Анастасия Игоревна','f',y-27,'Кассир',46000,(y-1)+'-07-20',{hasVus:false}),
     mk('Морозов Роман Алексеевич','m',y-35,'Повар',68000,(y-2)+'-05-15',{milCat:'soldier',fit:'A'}),
     mk('Кузнецова Дарья Михайловна','f',y-20,'Помощник бариста',40000,ago(180),{contract:'fixed',contractEnd:fwd(9)}),
     mk('Смирнов Алексей Игоревич','m',y-29,'Повар',64000,(y-1)+'-03-12',{milCat:'soldier',fit:'A'}),
     mk('Иванова Ольга Петровна','f',y-45,'Администратор',58000,(y-4)+'-02-01'),
     mk('Белова Елена Николаевна','f',y-36,'Пекарь-кондитер',60000,(y-3)+'-03-01'),
     mk('Громов Никита Павлович','m',y-19,'Бариста',44000,ago(20),{contract:'fixed',contractEnd:fwd(200),probation:3}),
     mk('Орлова Светлана Викторовна','f',y-48,'Уборщик',38000,(y-2)+'-06-01',{contract:'fixed',contractEnd:fwd(180)}),
     mk('Соколов Павел Андреевич','m',y-30,'Пекарь',56000,(y-2)+'-10-03')
    ];
    E[3].vacDays=14;E[5].vacDays=7;E[6].sick=[{id:uid(),from:ago(2),to:fwd(3),no:'910 000 000 001',open:true}];
  }
  E.forEach((e,i)=>{e.tasks=hireTasks(e,true);e.tasks.forEach(k=>{if(k.due<addDays(t,-5))k.done=true;});e.log=[{at:new Date().toISOString(),t:'Принят на работу с '+fmtD(e.start)}];});
  // демо: личные дела в основном собраны, у пары сотрудников есть пробелы — чтобы было видно, как это выглядит
  E.forEach((e,i)=>{e.dossier={passport:{state:'shown'},snils:{state:i===3?'none':'shown'},pd:{state:'done'},etk:{state:'shown'},mil:{state:'shown'},med:{state:'shown'},rkl:{state:'done'}};});
  if(kind==='office'){E.forEach((e,i)=>{e.dossier.nda={state:'done'};e.dossier.drv={state:'done'};if(i===9||i===19||i===3)e.dossier.pd={state:'none'};});}
  if(kind!=='office'){
    // медкнижки: у Марии просрочена, у троих заканчиваются в ближайшие недели
    E.forEach((e,i)=>{e.dossier.med={state:'shown',until:[3].includes(i)?ago(10):[1,5,9].includes(i)?fwd(12+i*5):fwd(200+i*10)};});
    E[3].dossier.snils={state:'shown'};E[7].dossier.pd={state:'none'};
  }
  // демо: данные для договора внесены, чтобы черновик договора был заполнен
  const inn12=b=>{const k1=[7,2,4,10,3,5,9,4,6,8],k2=[3,7,2,4,10,3,5,9,4,6,8],a=b.split('').map(Number);a.push(a.reduce((q,x,i)=>q+x*k1[i],0)%11%10);a.push(a.reduce((q,x,i)=>q+x*k2[i],0)%11%10);return a.join('');};
  const snl=b=>{const a=b.split('').map(Number),q=a.reduce((z,x,i)=>z+x*(9-i),0);let c=q<100?q:(q<=101?0:q%101);if(c===100)c=0;return b.slice(0,3)+'-'+b.slice(3,6)+'-'+b.slice(6,9)+' '+String(c).padStart(2,'0');};
  const co=(H.state().company)||{};
  E.forEach((e,i)=>{const sp=e.fio.split(' ');e.surname=sp[0];e.name=sp[1];e.middle=sp[2];
    e.regAddress='19'+String(1000+i)+', г. Санкт-Петербург, ул. Садовая, д. '+(3+i)+', кв. '+(10+i*3);e.liveSame=true;
    e.phone='+7 911 '+String(100+i*7).padStart(3,'0')+'-'+String(10+i).padStart(2,'0')+'-'+String(20+i*3).padStart(2,'0');
    e.innP=inn12('7810'+String(100000+i*7919).slice(0,6));e.snils=snl(String(112233000+i*911).slice(0,9));
    e.passport={series:'45'+String(10+i%80).padStart(2,'0'),number:String(123456+i*811).slice(0,6),issuedBy:'ГУ МВД России по г. Санкт-Петербургу и Ленинградской области',issueDate:(y-8-i%5)+'-06-20',code:'780-00'+(i%9+1)};
    e.cond=kind==='office'?'new':'2';e.premium='next';e.email=e.email||('staff'+(i+1)+'@example.ru');});
  E[kind==='office'?3:1].etk.sfr={y:8,m:6,d:0,at:t};
  return {emps:E,archiveYears:5,mrotRegion:null,reg:'Санкт-Петербург'};
}
function load(){
  ST=get(KEY(),null);
  if(!ST){
    ST=demo()?seed(demoKind()):{emps:[],archiveYears:5,mrotRegion:null,reg:'Санкт-Петербург'};
    // перенос из первой версии раздела «Люди»
    if(!demo())(S0.employees||[]).forEach(o=>{const e=blank(o);e.legacy=true;ST.emps.push(e);});
    save();
  }
  ST.emps.forEach(e=>{if(e.regime&&e.regime!=='ru')e.regime='foreign';e.tasks=(e.tasks||[]).filter(t=>t.mod!=='foreign'&&!/^(mvd|mvdOut|doc|dms|renew)$/.test(t.key));e.prev=e.prev||[];e.tasks=e.tasks||[];e.sick=e.sick||[];e.log=e.log||[];e.etk=e.etk||{kind:'etk',sfr:null};});
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
/* Раздел «Иностранцы» в работе: пока никаких проверок документов на работу и уведомлений не ведём. */
function foreign(e){return null;}
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
  if(!quiet){const g=contractGaps(e);if(g.emp.length)t.push(T('cf','Дозаполнить данные для договора: не хватает '+g.emp.length,s,'Форма трудового договора v1.0 (ст. 57 ТК): без этих данных договор подписать нельзя'));}
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
  if(isRu(e)){
    const m=mil(e,s);
    if(m.st==='in'||m.st==='check')t.push(T('mil',m.st==='in'?'Сообщить в военкомат о приёме на работу':'Уточнить воинский учёт и сообщить в военкомат',addWork(s,5),'Положение о воинском учёте, п. 32: 5 рабочих дней (проверить)',{mod:'military'}));
  }
  return t;
}
/* расчёт при увольнении: оценка, окончательные цифры считает бухгалтерия */
function settle(e){
  const dt=e.out?e.out.date:today(),y=+dt.slice(0,4),m=+dt.slice(5,7)-1,day=+dt.slice(8,10);
  const sal=(+e.salary||0)*(+e.rate||1),norm=workDaysIn(y,m);let wd=0;
  for(let i=1;i<=day;i++){if(isWd(y+'-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0')))wd++;}
  const pay=norm?Math.round(sal*wd/norm):0,v=vacation(e);
  const sev=e.out&&e.out.reason==='cut'?Math.round(sal):0;
  const rub=n=>Math.round(n).toLocaleString('ru-RU')+' ₽';
  return {pay,wd,norm,vac:v.comp,vacDays:v.left,sev,total:pay+v.comp+sev,rub};
}
function fireTasks(e,f){
  const d=e.out.date,t=[],S=settle(e),r=S.rub,fd=fmtD(d);
  if(e.out.reason==='absent')t.push(T('fAct','Составить акт о прогуле и запросить письменное объяснение',d,f.a+', ст. 193 ТК: работнику 2 рабочих дня на объяснение',{how:['Составьте акт об отсутствии на рабочем месте (дата, время, свидетели).','Вручите требование дать письменное объяснение. Если человек отказался, составьте акт об отказе.','Через 2 рабочих дня можно издавать приказ. Срок взыскания: не позже месяца со дня, когда вы узнали о прогуле (ст. 193 ТК).']}));
  t.push(T('fOrder','Издать приказ об увольнении (Т-8) и ознакомить под подпись',d,f.a+'; ст. 84.1 ТК',{how:['Откройте карточку сотрудника, вкладка «Документы»: приказ Т-8 уже подготовлен.','Распечатайте, подпишите у руководителя, дайте работнику расписаться в ознакомлении.','Если работник отказался подписывать, составьте акт об отказе (ст. 84.1 ТК). Дата приказа и последний рабочий день совпадают: '+fd+'.']}));
  t.push(T('fPay','Рассчитать окончательный расчёт: '+r(S.total)+' (оценка)',d,'ст. 140 и ст. 127 ТК: выплатить в последний рабочий день',{how:['Зарплата за отработанные дни: '+S.wd+' из '+S.norm+' рабочих дней месяца, около '+r(S.pay)+' (ст. 136 ТК; если часть уже выплачена, вычтите).','Компенсация неиспользованного отпуска: '+S.vacDays+' дн., около '+r(S.vac)+' (ст. 127 ТК; за все неиспользованные дни).'].concat(e.out.reason==='cut'?['Выходное пособие при сокращении: средний месячный заработок, около '+r(S.sev)+' (ст. 178 ТК). Ещё один месяц сохраняется на время поиска работы, при условии что человек не трудоустроился.']:['Выходное пособие не положено: оно выплачивается при сокращении, ликвидации и некоторых других основаниях (ст. 178 ТК), по основанию «'+f.t.toLowerCase()+'» его нет.']).concat(['Это оценка по окладу из карточки. Точную сумму проверьте по табелю, премиям и вычетам. НДФЛ удерживается с выплат, страховые взносы начисляются на зарплату и компенсацию отпуска.','Если сумма спорная, выплатите бесспорную часть в последний день (ст. 140 ТК). Задержка расчёта влечёт компенсацию по ст. 236 ТК.'])}));
  t.push(T('fBook','Выдать трудовую книжку или сведения о трудовой деятельности (СТД-Р)',d,'ст. 66.1 и ст. 84.1 ТК: в последний рабочий день ('+fd+')',{how:['В последний рабочий день ('+fd+') выдайте бумажную трудовую, если она ведётся, либо СТД-Р, если ведётся электронная.','Запись об увольнении в трудовой: дата, основание со ссылкой на статью ТК, номер и дата приказа. Заверьте подписью и печатью (если печать есть).','Работник расписывается в получении (в книге учёта движения трудовых книжек или в журнале выдачи СТД-Р). Если не пришёл за документами, отправьте письмо с уведомлением о необходимости явиться или согласии на отправку почтой.']}));
  t.push(T('fEfs','Передать сведения в СФР (ЕФС-1, подраздел 1.1) и ФНС',nextWork(d),'Не позднее следующего рабочего дня после приказа (проверить)',{how:['СФР: подайте форму ЕФС-1, подраздел 1.1 «Сведения о трудовой деятельности», с кодом увольнения. Срок: не позднее следующего рабочего дня после издания приказа (проверьте по ст. 11 закона 27-ФЗ).','Подавать можно через личный кабинет СФР, ЭДО-оператора или бухгалтерскую программу, подписав усиленной электронной подписью.','ФНС: выплаты при увольнении (зарплата, компенсация отпуска) попадут в 6-НДФЛ и расчёт по взносам за период выплаты. Отдельное уведомление в ФНС о прекращении договора не нужно, если человек не иностранец на патенте.','Пояснительная записка для проверяющих: «Работник '+(e.fio||'')+' уволен '+fd+' по '+f.a+', приказ от '+fd+'. Расчёт выплачен в день увольнения, сведения переданы в СФР в срок». Храните её вместе с копией приказа.']}));
  t.push(T('fCard','Закрыть личную карточку Т-2 и передать личное дело в архив',addWork(d,3),'Перечень типовых архивных документов (приказ Росархива № 236)',{how:['В карточке Т-2 заполните раздел XI «Сведения об увольнении»: дата, основание, номер и дата приказа. Работник расписывается.','Распечатайте или сохраните карточку как документ: её можно взять из вкладки «Документы» в карточке сотрудника.','Затем закройте личное дело: сложите приказы, договор, заявление, расчёт. Дело хранится в архиве '+'по общим срокам'+' (в Штатке срок посчитан).']}));
  if(isRu(e)){const m=mil(e,e.start);if(m.st==='in'||m.st==='check'||m.st==='out')t.push(T('milOut','Сообщить в военкомат об увольнении',addWork(d,5),'Положение о воинском учёте, п. 32: 5 рабочих дней (проверить)',{mod:'military',how:['Отправьте в военный комиссариат сведения об увольнении с карточки Т-2 (по форме военкомата).','Снимите работника с воинского учёта организации и отметьте дату в журнале.']}));}
  return t;
}

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
/* ---------- платежи с зарплаты: взносы и травматизм (правила 2026 года — payroll-rules.js) ---------- */
const PCO_KEY='shtatka-payroll-co';
const PCO_DEF={msp:null,okved:'',taxSystem:'usn',injury:0.2,injuryDisc:0,share70:false,it:false};
function payCo(){let o={};try{o=JSON.parse(localStorage.getItem(PCO_KEY))||{}}catch(x){}
  const sc=(H.session()||{}).co||{};return Object.assign({},PCO_DEF,{msp:sc.msp==null?null:sc.msp,okved:sc.okved||'',taxSystem:sc.taxSystem||'usn'},o);}
function setPayCo(v){try{localStorage.setItem(PCO_KEY,JSON.stringify(Object.assign(payCo(),v)))}catch(x){}}
/* Руководитель организации: взносы с базы не меньше МРОТ (ст. 421 НК). Признак — флаг e.head или должность «(Генеральный) директор». */
const isHead=e=>e.head!=null?!!e.head:/^(генеральный\s+)?директор$|^руководитель$/i.test(String(e.position||'').trim());
function payroll(y,m){
  const PR=window.SHTATKA_PAYROLL,co=payCo(),t=PR?PR.tariff(co):null,inj=(+co.injury||0.2)/100*(1-Math.min(40,Math.max(0,+co.injuryDisc||0))/100),gen=PR?PR.tariff({}):null;
  const months=[];for(let k=0;k<=m;k++)months.push(payrollMonth(y,k));
  const rows=months[m];
  rows.forEach(r=>{
    let ytd=0,cum=0;
    for(let k=0;k<m;k++){const o=months[k].find(x=>x.e.id===r.e.id);if(o){ytd+=o.gross;cum+=o.base;}}
    r.ytd=ytd+r.gross;r.ndfl=ndflYear(ytd+r.gross)-ndflYear(ytd);r.rate=ndflRate(ytd+r.gross);
    // патент: НДФЛ уменьшается на фиксированные авансы за год, только после уведомления ИФНС (ст. 227.1 НК)
    r.patentOff=0;
    if(r.e.regime==='patent'&&r.e.patentNotice&&+r.e.patentAdv>0){
      const adv=+r.e.patentAdv,s0=Math.max(0,new Date(r.e.start).getFullYear()===y?new Date(r.e.start).getMonth():0);
      const advCum=k=>adv*Math.max(0,k-s0+1);
      const cut=(nCum,k)=>Math.max(0,nCum-advCum(k));
      const was=m>0?cut(ndflYear(ytd),m-1):0,now=cut(ndflYear(ytd+r.gross),m);
      r.patentOff=Math.max(0,r.ndfl-(now-was));r.ndfl=now-was;}
    r.pay=r.gross-r.ndfl;
    r.cumBase=cum;
    const r2=x=>Math.round(x*100)/100;
    r.main=t?r2(PR.contribMonth(r.base,cum,t)):r2(r.base*0.30);          // слой 1–2: единый тариф с учётом льготы
    r.mainGeneral=gen?r2(PR.contribMonth(r.base,cum,gen)):r.main;           // для сравнения: общий тариф
    r.xRate=PR&&r.lab?PR.extraRate(r.e):0;r.extra=r2(r.base*r.xRate);              // слой 3: доп. тариф ОПС, без предельной базы
    r.contrib=r2(r.main+r.extra);
    r.injury=t&&t.kind==='ausn'?0:Math.round(r.injBase*inj*100)/100;
    r.cost=Math.round((r.gross+r.contrib+r.injury)*100)/100;
    r.budget=Math.round((r.ndfl+r.contrib+r.injury)*100)/100;
  });
  rows.tariff=t;rows.co=co;rows.injRate=inj;
  rows.ausnInjury=t&&t.kind==='ausn'&&rows.length?Math.round(PR.R.ausnInjuryYear/12*100)/100:0;
  return rows;}
function payrollMonth(y,m){
  const norm=workDaysIn(y,m),rows=[];
  const first=iso(new Date(y,m,1)),last=iso(new Date(y,m+1,0));
  ST.emps.forEach(e=>{
    if(e.contract==='self')return;   // самозанятый платит НПД сам: ни НДФЛ, ни взносов у заказчика
    const lab=LABOR(e.contract);
    if(e.start>last)return;if(e.out&&e.out.date<first)return;
    const from=e.start>first?e.start:first,to=e.out&&e.out.date<last?e.out.date:last;
    let wd=0;for(let d=D(from);iso(d)<=to;d.setDate(d.getDate()+1)){if(isWd(iso(d)))wd++;}
    let sick=0;(e.sick||[]).forEach(s=>{for(let d=D(s.from>from?s.from:from);iso(d)<=(s.to<to?s.to:to);d.setDate(d.getDate()+1)){if(isWd(iso(d))){sick++;}}});
    if(!lab)sick=0;   // больничные — только по трудовому договору
    const worked=Math.max(0,wd-sick);
    const sal=+e.salary||0;
    const accr=Math.round(sal*worked/norm);
    // больничный: первые 3 дня за счёт работодателя, дальше ФСС; здесь грубая оценка через дневной заработок
    const daily=sal*12/730;const sickPay=lab?Math.round(Math.min(sick,3)*daily*1):0;
    const gross=accr+sickPay,ndfl=Math.round(gross*0.13);
    const head=lab&&isHead(e),floor=head?Math.round(MROT.y2026*wd/norm*100)/100:0;
    // база взносов: пособие по больничному не облагается (ст. 422 НК); аренда имущества — не объект (п. 4 ст. 420 НК);
    // временно пребывающий ВКС не застрахован (ст. 7 167-ФЗ) — только травматизм
    const noContrib=e.contract==='rent'||e.regime==='hqs';
    const base=noContrib?0:Math.max(accr,floor);
    // травматизм: трудовой договор — всегда; ГПХ — только если условие есть в договоре (ст. 20.1 125-ФЗ); аренда — нет
    const injBase=lab?accr:(e.contract==='gph'&&e.gphInjury?accr:0);
    rows.push({e,norm,wd,sick,worked,accr,sickPay,gross,ndfl,pay:gross-ndfl,base,injBase,noContrib,lab,head,headMin:base>accr&&!noContrib,low:lab&&sal>0&&sal<mrotNow()*(+e.rate||1)});
  });
  return rows;
}

/* ---------- структура подчинённости ---------- */
const boss=e=>e&&e.managerId?ST.emps.find(x=>x.id===e.managerId&&!x.out)||null:null;
const reports=id=>ST.emps.filter(x=>!x.out&&x.managerId===id);
function under(id){const out=new Set(),q=[id];while(q.length){const c=q.shift();reports(c).forEach(x=>{if(!out.has(x.id)){out.add(x.id);q.push(x.id);}});}return out;}
/* кого можно назначить руководителем: не сам человек и не его подчинённые (иначе цикл) */
const bossOptions=id=>{const ban=id?under(id):new Set();return active().filter(x=>x.id!==id&&!ban.has(x.id));};
function tree(){const act=active(),ids=new Set(act.map(e=>e.id));
  const node=e=>({e,kids:act.filter(x=>x.managerId===e.id).map(node)});
  return act.filter(e=>!e.managerId||!ids.has(e.managerId)).map(node);}

/* ---------- документы ---------- */
const DOCS=[
 ['td','Трудовой договор',e=>LABOR(e.contract)],
 ['gph','Договор ГПХ',e=>e.contract==='gph'],
 ['rent','Договор аренды',e=>e.contract==='rent'],
 ['self','Договор с самозанятым',e=>e.contract==='self'],
 ['order','Приказ о приёме на работу (Т-1)',e=>LABOR(e.contract)],
 ['mat','Договор о полной материальной ответственности',e=>LABOR(e.contract)&&!(age(e.birth)!=null&&age(e.birth)<18)&&(e.matResp||/кассир|продав|кладовщ|оператор пвз|пункт выдачи|экспедит|товаровед|администратор|бармен|официант/i.test(e.position||''))],
 ['nda','Соглашение о неразглашении коммерческой тайны',e=>needNda(e)],
 ['pd','Согласие на обработку персональных данных',e=>true],
 ['card','Личная карточка (Т-2)',e=>LABOR(e.contract)],
 ['mil','Сведения о приёме для военкомата',e=>!e.out&&['in','check'].includes(mil(e).st)],
 ['fire','Приказ об увольнении (Т-8)',e=>!!e.out],
 ['milOut','Сведения об увольнении для военкомата',e=>!!e.out&&['in','check','out'].includes(mil(e,e.start).st)],
];
/* соглашение о коммерческой тайне нужно офисным: сфера «офис, IT» или офисная должность (не бариста, не ПВЗ) */
const needNda=e=>{const J=window.SHTATKA_JOBS;if(!J||!(LABOR(e.contract)||e.contract==='gph'))return false;return J.industry().id==='office'||J.role(e.position)==='office';};
const docsFor=e=>DOCS.filter(d=>d[2](e));
/* сумма прописью: 45000 → «сорок пять тысяч рублей 00 копеек» */
function words(n){n=Math.floor(+n||0);if(!n)return 'ноль рублей';
  const u=[['','один','два','три','четыре','пять','шесть','семь','восемь','девять'],['','одна','две','три','четыре','пять','шесть','семь','восемь','девять']];
  const t10=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const dz=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hd=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  const form=(x,a,b,c)=>{const m=x%100,k=x%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
  const tri=(x,g)=>{const h=Math.floor(x/100),r=x%100,o=[hd[h]];if(r>=10&&r<20)o.push(t10[r-10]);else{o.push(dz[Math.floor(r/10)]);o.push(u[g][r%10]);}return o.filter(Boolean).join(' ');};
  const parts=[];const mln=Math.floor(n/1e6),th=Math.floor(n/1e3)%1000,rest=n%1000;
  if(mln)parts.push(tri(mln,0)+' '+form(mln,'миллион','миллиона','миллионов'));
  if(th)parts.push(tri(th,1)+' '+form(th,'тысяча','тысячи','тысяч'));
  if(rest)parts.push(tri(rest,0));
  return parts.join(' ')+' '+form(n,'рубль','рубля','рублей')+' 00 копеек';}
const MODE={'5/2':'пятидневная рабочая неделя с двумя выходными','shift':'сменный график','2/2':'график 2/2','flex':'гибкий график'};
const WHY={absent:'на время отсутствия основного работника',season:'сезонная работа',temp:'временная работа до 2 месяцев',project:'выполнение определённой работы',pens:'соглашение сторон, ст. 59 ТК РФ'};
/* подстановка меток {{…}} в шаблон договора (contract-template.js) */
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const NUMW=['','один','два','три','четыре','пять','шесть'];
const mark=b=>b?'☒':'☐';
const coData=()=>{const c=(H.state().company)||{};if(!demo())return c;const k=demoKind();
  return Object.assign({head:k==='office'?'Зайцев Олег Андреевич':'Петрова Ирина Сергеевна',post:k==='office'?'Генеральный директор':'Управляющий',hours:'09:00–18:00',pay:'10 и 25',vac:28,
    addr:'191002, г. Санкт-Петербург, ул. Рубинштейна, д. 1, офис 5',phone:'+7 812 000-00-00',email:'hr@example.ru',_org:k==='office'?'ООО «Пиксель»':'ООО «Зерно»',_inn:'7810964768'},c);};
const genPost=p=>String(p||'').trim().toLowerCase().split(/\s+/).map((w,i,a)=>{
  if(i<a.length-1||a.length===1&&false){return w.replace(/(ый|ой)$/,'ого').replace(/ий$/,'его');}
  return /(ый|ой)$/.test(w)?w.replace(/(ый|ой)$/,'ого'):/ий$/.test(w)?w.replace(/ий$/,'его'):/ь$/.test(w)?w.slice(0,-1)+'я':/й$/.test(w)?w.slice(0,-1)+'я':/а$/.test(w)?w.slice(0,-1)+'ы':/[бвгдзклмнпрстфхцчшщ]$/.test(w)?w+'а':w;}).join(' ');
const payDays=p=>{const n=String(p||'').match(/\d{1,2}/g)||[];return {adv:n[0]||'',fin:n[1]||''};};
const dayModeOf=(e,ca)=>{if(e.dayMode)return e.dayMode;const h=String(ca.hours||'');
  if(/^\s*10[:.]?00\D+19[:.]?00/.test(h))return '1019';if(/^\s*0?9[:.]?00\D+18[:.]?00/.test(h))return '918';return h?'other':'';};
const wtOf=(e,ca)=>e.workTime||((e.rate&&e.rate<1)?'short':((e.workMode||ca.mode||'5/2')==='5/2'?'40':'other'));
/* что значит «пусто» для каждого поля формы; нужно и для подстановки, и для списка «чего не хватает» */
function fillTpl(tpl,e){
  const ses=Object.assign({},H.session()||{}),ca=coData(),pp=e.passport||{},u=(H.units()||[]).find(x=>x.id===e.unit);if(!ses.company)ses.company=ca._org;if(!ses.inn)ses.inn=ca._inn;
  const F=x=>x==null||x===''?'__________':String(x).replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]));
  const sp=(e.fio||'').split(/\s+/),short=sp[0]?sp[0]+' '+sp.slice(1).map(x=>x[0]+'.').join(''):'';
  const cdate=e.contractAt&&e.contractAt<=today()?e.contractAt:today();
  const idx=ST.emps.indexOf(e)+1,seq=String(idx).padStart(3,'0');
  const pd=payDays(ca.pay),dm=dayModeOf(e,ca),wt=wtOf(e,ca),cond=e.cond||'',pr=+e.probation||0;
  const prW=pr?pr+' ('+(NUMW[pr]||'')+') '+(pr===1?'месяц':pr<5?'месяца':'месяцев'):'';
  const al=(e.allow||[]).filter(x=>x&&x.name).map(x=>x.name+': '+x.sum+(x.until?', срок действия до '+fmtD(x.until):'')).join('; ');
  const mk=(e.matK||[]);
  const V={org:ses.company,orgFull:ca.fullName||ses.company,orgShort:ca.shortName||ses.company,orgInn:ses.inn,orgHead:ca.head,orgHeadPost:ca.post?genPost(ca.post):'генерального директора',
    orgBasis:ca.basis||'Устава',orgAddr:ca.addr,orgAddrFact:ca.addrFact||ca.addr,orgPhone:ca.phone,orgEmail:ca.email,hrWho:ca.hr||'в отдел кадров (уполномоченному сотруднику)',
    city:ST.reg?'г. '+ST.reg:'',date:fmtD(cdate),dd:cdate.slice(8,10),mon:MONTHS[+cdate.slice(5,7)-1],yyyy:cdate.slice(0,4),
    number:e.contractNo||(idx+'/'+cdate.slice(0,4)),seqNo:seq,tabNo:e.tabNo||seq,deptCode:e.deptCode||(u?u.code||'':'')||'—',exNo:'1',
    fio:e.fio,fioShort:short,surname:e.surname||sp[0],name:e.name||sp[1],middle:e.middle||sp.slice(2).join(' '),birth:e.birth?fmtD(e.birth):'',birthPlace:e.birthPlace,
    passport:pp.series?pp.series+' '+pp.number:'',passIssuedBy:pp.issuedBy,passDate:pp.issueDate?fmtD(pp.issueDate):'',passCode:pp.code,
    passportIssued:[pp.issuedBy,pp.issueDate?fmtD(pp.issueDate):'',pp.code?'код '+pp.code:''].filter(Boolean).join(', '),
    regAddress:e.regAddress,liveAddress:e.liveSame?e.regAddress:e.liveAddress,snils:e.snils,inn:e.innP,phone:e.phone,phone2:e.phone2||'нет',email:e.email||'нет',position:e.position,
    workPlace:e.workPlace||ca.addr,start:e.start?fmtD(e.start):'',end:e.contractEnd?'по '+fmtD(e.contractEnd):'до исполнения обязательств',
    employKind:e.employKind==='part'?'работой по совместительству':'основным местом работы',
    term:e.contract==='fixed'?'на определённый срок до '+(e.contractEnd?fmtD(e.contractEnd):'__________'):'на неопределённый срок',
    termFull:e.contract==='fixed'?'определённый срок до '+(e.contractEnd?'«'+e.contractEnd.slice(8,10)+'» '+MONTHS[+e.contractEnd.slice(5,7)-1]+' '+e.contractEnd.slice(0,4)+' г.':'__________'):'неопределённый срок',
    probation:pr?pr+' мес.':'не устанавливается',mode:MODE[e.workMode||ca.mode]||MODE['5/2'],
    rate:!e.rate||e.rate>=1?'полное рабочее время':'неполное рабочее время, '+String(e.rate).replace('.',',')+' ставки',
    salary:e.salary?Number(e.salary).toLocaleString('ru-RU'):'',salaryWords:e.salary?words(e.salary):'',payDays:ca.pay,payAdv:pd.adv,payFin:pd.fin,vacation:ca.vac||28,
    manager:(()=>{const b=boss(e);return b?b.fio+(b.position?', '+b.position:''):'руководитель организации';})(),
    allow:al||'не устанавливается'};
  const raw={orgShortP:(V.orgShort&&V.orgShort!==V.orgFull)?' («'+F(V.orgShort)+'»)':'',unit:u?', подразделение «'+F(u.name)+'»':'',remote:e.remote?' Работа выполняется дистанционно (гл. 49.1 ТК РФ).':'',
    termReason:e.contract==='fixed'?' (основание: '+(WHY[e.fixedWhy]||'__________')+')':'',
    probSent:pr?'Работнику устанавливается испытание в целях проверки его соответствия поручаемой работе продолжительностью '+prW+'. Критериями успешного прохождения испытания является полное, качественное и своевременное выполнение Работником трудовых функций, предусмотренных настоящим трудовым договором и должностной инструкцией, письменных и устных приказов (указаний, распоряжений) Работодателя, распоряжений непосредственного руководителя, выполнения планов и соблюдения графиков, утверждённых в организации, действующих в организации локальных нормативных актов и требований к работе, трудовой дисциплины, положений и инструкций по охране труда, пожарной безопасности и охране окружающей среды.':'Испытание Работнику не устанавливается.',
    termFull:V.termFull+(e.contract==='fixed'?'. Причина заключения срочного договора: '+F(WHY[e.fixedWhy])+', ст. 59 ТК РФ':''),
    condNew:cond==='new'?'<p>Работник выполняет свои обязанности на вновь созданном рабочем месте, в связи с чем специальная оценка условий труда (СОУТ) ранее не проводилась. Рабочее место оборудовано персональным компьютером, офисной мебелью и оргтехникой. Особенности работы связаны со стандартной деятельностью в условиях офисного помещения. Класс (подкласс) условий труда на рабочем месте будет установлен по результатам специальной оценки условий труда, проводимой в сроки, предусмотренные действующим законодательством РФ (ч. 1 ст. 17 Федерального закона № 426-ФЗ). После проведения специальной оценки условий труда Стороны обязуются подписать дополнительное соглашение к настоящему Договору, определяющее итоговый класс условий труда, вредные и (или) опасные производственные факторы (при их наличии), а также соответствующие гарантии и компенсации.</p>':'',
    wtNote:wt==='other'?F(e.workTimeNote||MODE[e.workMode||ca.mode]):wt==='short'?F(e.workTimeNote):'',dayNote:dm==='other'?F(e.dayNote||ca.hours):'',
    m_c1:mark(cond==='1'),m_c2:mark(cond==='2'),m_c31:mark(cond==='3.1'),m_c32:mark(cond==='3.2'),m_c33:mark(cond==='3.3'),m_c34:mark(cond==='3.4'),m_c4:mark(cond==='4'),
    m_w40:mark(wt==='40'),m_wsh:mark(wt==='short'),m_wot:mark(wt==='other'),m_d1019:mark(dm==='1019'),m_d918:mark(dm==='918'),m_dot:mark(dm==='other'),
    m_irn:mark(!e.irregular),m_iry:mark(!!e.irregular),m_pc:mark(e.premium==='cur'),m_pn:mark(e.premium==='next'),
    m_mfull:mark(mk.includes('full')),m_mlim:mark(mk.includes('limited')),m_mbr:mark(mk.includes('brigade')),m_mtool:mark(mk.includes('tools'))};
  return tpl.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in raw?raw[k]:F(V[k]));
}
/* ---------- данные для договора: что форма v1.0 просит, а в карточке пока пусто ---------- */
const CFS={p:'Личные данные',d:'Паспорт',w:'Условия работы',m:'Оплата',x:'Дополнительно'};
const CF=[
 {k:'regAddress',s:'p',l:'Адрес регистрации',t:'text',ph:'индекс, город, улица, дом, корпус, квартира',req:1,get:e=>e.regAddress||'',put:v=>({regAddress:v})},
 {k:'liveSame',s:'p',l:'Проживает по адресу регистрации',t:'bool',get:e=>!!e.liveSame,put:v=>({liveSame:!!v})},
 {k:'liveAddress',s:'p',l:'Адрес проживания',t:'text',ph:'если отличается от регистрации',req:1,get:e=>e.liveAddress||'',put:v=>({liveAddress:v}),hideIf:'liveSame'},
 {k:'phone',s:'p',l:'Телефон основной (мобильный)',t:'tel',ph:'+7 900 000-00-00',req:1,get:e=>e.phone||'',put:v=>({phone:v})},
 {k:'phone2',s:'p',l:'Телефон дополнительный',t:'tel',get:e=>e.phone2||'',put:v=>({phone2:v})},
 {k:'email',s:'p',l:'Личная электронная почта',t:'email',get:e=>e.email||'',put:v=>({email:v})},
 {k:'innP',s:'p',l:'ИНН (12 цифр)',t:'num',req:1,get:e=>e.innP||'',put:v=>({innP:String(v).replace(/\D/g,'')})},
 {k:'snils',s:'p',l:'СНИЛС',t:'text',ph:'000-000-000 00',req:1,get:e=>e.snils||'',put:v=>({snils:v})},
 {k:'pser',s:'d',l:'Паспорт: серия и номер',t:'num',ph:'0000 000000',req:1,get:e=>{const p=e.passport||{};return p.series?p.series+' '+p.number:''},put:(v,e)=>{const n=String(v).replace(/\D/g,'');return {passport:Object.assign({},e.passport,{series:n.slice(0,4),number:n.slice(4,10)})};}},
 {k:'pby',s:'d',l:'Кем выдан',t:'text',req:1,get:e=>(e.passport||{}).issuedBy||'',put:(v,e)=>({passport:Object.assign({},e.passport,{issuedBy:v})})},
 {k:'pdate',s:'d',l:'Когда выдан',t:'date',req:1,get:e=>(e.passport||{}).issueDate||'',put:(v,e)=>({passport:Object.assign({},e.passport,{issueDate:v})})},
 {k:'pcode',s:'d',l:'Код подразделения',t:'text',ph:'000-000',req:1,get:e=>(e.passport||{}).code||'',put:(v,e)=>({passport:Object.assign({},e.passport,{code:v})})},
 {k:'workPlace',s:'w',l:'Место работы (адрес)',t:'text',ph:'по юридическому адресу компании, если не указано иное',req:1,get:e=>e.workPlace||'',put:v=>({workPlace:v})},
 {k:'employKind',s:'w',l:'Работа для сотрудника',t:'sel',opts:[['main','Основное место работы'],['part','Совместительство']],get:e=>e.employKind||'main',put:v=>({employKind:v})},
 {k:'cond',s:'w',l:'Условия труда (класс по СОУТ)',t:'sel',req:1,opts:[['','— выберите —'],['new','Новое рабочее место: СОУТ ещё не проводилась'],['1','1 класс, оптимальные'],['2','2 класс, допустимые'],['3.1','3.1 вредные, 1-й степени'],['3.2','3.2 вредные, 2-й степени'],['3.3','3.3 вредные, 3-й степени'],['3.4','3.4 вредные, 4-й степени'],['4','4 класс, опасные']],get:e=>e.cond||'',put:v=>({cond:v})},
 {k:'workTime',s:'w',l:'Рабочее время',t:'sel',opts:[['','по умолчанию'],['40','40-часовая неделя, пятидневка'],['short','Сокращённая неделя'],['other','Иное: сменная работа и т. п.']],get:e=>e.workTime||'',put:v=>({workTime:v})},
 {k:'dayMode',s:'w',l:'Режим работы',t:'sel',req:'dm',opts:[['','по анкете компании'],['1019','10:00–19:00, перерыв 14:00–15:00'],['918','09:00–18:00, перерыв 13:00–14:00'],['other','Иной режим (укажите ниже)']],get:e=>e.dayMode||'',put:v=>({dayMode:v})},
 {k:'dayNote',s:'w',l:'Иной режим: время и перерыв',t:'text',get:e=>e.dayNote||'',put:v=>({dayNote:v})},
 {k:'irregular',s:'w',l:'Ненормированный рабочий день (ст. 101 ТК)',t:'bool',get:e=>!!e.irregular,put:v=>({irregular:!!v})},
 {k:'salary',s:'m',l:'Оклад, ₽ в месяц',t:'num',req:1,get:e=>e.salary||'',put:v=>({salary:+v||0})},
 {k:'allowName',s:'m',l:'Надбавка (доплата): название',t:'text',ph:'если есть',get:e=>((e.allow||[])[0]||{}).name||'',put:(v,e)=>({allow:[Object.assign({},(e.allow||[])[0],{name:v})]})},
 {k:'allowSum',s:'m',l:'Надбавка: сумма, ₽ или %',t:'text',get:e=>((e.allow||[])[0]||{}).sum||'',put:(v,e)=>({allow:[Object.assign({},(e.allow||[])[0],{sum:v})]})},
 {k:'premium',s:'m',l:'Ежемесячная премия',t:'sel',req:1,opts:[['','— выберите —'],['cur','В отчётном месяце'],['next','В месяце, следующем за отчётным'],['none','Не предусмотрена']],get:e=>e.premium||'',put:v=>({premium:v})},
 {k:'matK',s:'x',l:'Материальная ответственность',t:'multi',opts:[['full','Полная'],['limited','Ограниченная'],['brigade','Бригадная'],['tools','Сдача инструмента и спецодежды']],get:e=>e.matK||[],put:v=>({matK:v})},
 {k:'tabNo',s:'x',l:'Табельный номер',t:'text',ph:'по умолчанию — порядковый',get:e=>e.tabNo||'',put:v=>({tabNo:v})},
 {k:'deptCode',s:'x',l:'Код подразделения (в компании)',t:'text',get:e=>e.deptCode||'',put:v=>({deptCode:v})}
];
function contractGaps(e){
  const ca=coData(),emp=[],co=[];
  CF.forEach(f=>{if(!f.req)return;
    let miss;
    if(f.k==='liveAddress')miss=!e.liveSame&&!e.liveAddress;
    else if(f.k==='workPlace')miss=!e.workPlace&&!ca.addr;
    else if(f.req==='dm')miss=!dayModeOf(e,ca);
    else miss=!f.get(e);
    if(miss)emp.push({k:f.k,l:f.l,s:f.s});});
  if(!ca.head)co.push({k:'head',l:'Руководитель (в анкете компании)'});
  const pd=payDays(ca.pay);if(!pd.adv||!pd.fin)co.push({k:'pay',l:'Дни выплаты: аванс и расчёт (в анкете компании)'});
  if(!ca.addr)co.push({k:'addr',l:'Адрес организации (в анкете компании)'});
  return {emp,co,total:emp.length+co.length};
}
function docHtml(e,key){
  const TP=window.SHTATKA_TPL||{};if(TP[key]&&['td','gph','rent','self','mat','nda'].includes(key))return fillTpl(TP[key],e);
  const co=(H.session()||{}),F=x=>x||'__________';
  const org=F(co.company),inn=co.inn?', ИНН '+co.inn:'';
  const head='<p><b>'+org+'</b>'+inn+'</p>';
  const who='<b>'+F(e.fio)+'</b>';
  const sal=e.salary?Number(e.salary).toLocaleString('ru-RU')+' ₽ в месяц':'__________';
  const T_={
   td:'<h3>Трудовой договор</h3>'+head+'<p>Работодатель и '+who+', дата рождения '+fmtD(e.birth)+', заключили договор о том, что работник принимается на должность «'+F(e.position)+'» с '+fmtD(e.start)+(e.contract==='fixed'?' на определённый срок':' на неопределённый срок')+'. Оклад: '+sal+'. Остальные условия по ст. 57 ТК вносит работодатель.</p><p class="d">Черновик по данным карточки. Перед подписью проверьте и дополните по ст. 57 ТК.</p>',
   order:'<h3>Приказ о приёме работника на работу (форма Т-1)</h3>'+head+'<p>Принять '+who+' на должность «'+F(e.position)+'» с '+fmtD(e.start)+(e.contract==='fixed'?', на определённый срок':', без испытательного срока или с ним по договору')+', оклад '+sal+'.</p><p>Руководитель ____________ &nbsp; Работник ознакомлен ____________</p>',
   pd:'<h3>Согласие на обработку персональных данных</h3>'+head+'<p>Я, '+who+', даю согласие оператору на обработку моих персональных данных в целях оформления и ведения трудовых отношений. Перечень данных, срок и порядок отзыва согласия указаны в приложенном перечне. Согласие оформляется отдельным документом.</p><p>Дата ____________ Подпись ____________</p>',
   card:'<h3>Личная карточка работника (Т-2)</h3>'+head+'<table><tr><td>ФИО</td><td>'+F(e.fio)+'</td></tr><tr><td>Дата рождения</td><td>'+fmtD(e.birth)+'</td></tr><tr><td>Пол</td><td>'+(e.sex==='f'?'женский':'мужской')+'</td></tr><tr><td>Гражданство</td><td>'+F(e.country)+'</td></tr><tr><td>Паспорт</td><td>'+F(e.passport&&e.passport.series?e.passport.series+' '+e.passport.number+', выдан '+(e.passport.issuedBy||'')+' '+(e.passport.issueDate?fmtD(e.passport.issueDate):''):'')+'</td></tr><tr><td>Адрес регистрации</td><td>'+F(e.regAddress)+'</td></tr><tr><td>СНИЛС, ИНН</td><td>'+F(e.snils)+', '+F(e.innP)+'</td></tr><tr><td>Должность</td><td>'+F(e.position)+'</td></tr><tr><td>Принят</td><td>'+fmtD(e.start)+'</td></tr><tr><td>Воинский учёт</td><td>'+(isRu(e)?(e.milDoc?F(e.milDoc)+', '+(MILCAT[e.milCat]||''):'данные внесите из военного билета'):'не ведётся (иностранный гражданин)')+'</td></tr><tr><td>Предыдущий стаж</td><td>'+fmtY(stazh(e).prev)+'</td></tr></table>',
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
  settle,allTasks,openTasks,overdue,purgeOn,payroll,payCo,nextNo(){ST.seq=(ST.seq||ST.emps.length)+1;save();return ST.seq+'/'+today().slice(0,4);},fillTpl,words,boss,reports,bossOptions,tree,LABOR,CF,CFS,contractGaps,setPayCo,isHead,ndflYear,ndflRate,NDFL,workDaysIn,
  docsFor,docHtml,needNda,MROT,mrotNow,
  CONTRACT,REGIME,MILCAT,FIT,FIRE,soldierLimit,milLimit,
  d:{D,iso,today,addDays,addWork,nextWork,fmt:fmtD,diff:diffDays},
  setArchiveYears(n){ST.archiveYears=n;save();},
  setMrotRegion(v){ST.mrotRegion=v||null;save();},
  newDemo(){try{['shtatka-hr-demo','shtatka-hr-demo-cafe','shtatka-hr-demo-office'].forEach(k=>localStorage.removeItem(k))}catch(e){}load();}
};
/* Остальные разделы кабинета видят только действующих сотрудников */
H.employees=()=>active();
H.addEmployee=e=>hire(Object.assign({fio:e.fio,position:e.position,contract:e.contract,start:e.start,unit:e.unit,phone:e.phone,existing:e.kind==='existing'},e));
H.removeEmployee=id=>remove(id);
})();
