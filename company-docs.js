/* «Документы компании»: перечень локальных документов, которые регулируют работу сотрудников, с загрузкой копий.
   Копии лежат в браузере (IndexedDB, как личные дела). Статус: загружен / нет, надо создать / не нужен. Шаблоны для создания добавим позже. */
(function(){
const H=window.SHTATKA_HOME,R=window.SHTATKA_HR,J=window.SHTATKA_JOBS,DZ=window.SHTATKA_DOSSIER,UI=window.SHTATKA_UI;if(!H||!DZ)return;
const esc=UI.esc,toast=UI.toast,$=s=>document.querySelector(s);
const KEY=()=>H.real()&&!H.state().demoView?'shtatka-cdocs-v1':'shtatka-cdocs-demo';
const get=()=>{try{return JSON.parse(localStorage.getItem(KEY()))||{};}catch(e){return {};}};
const put=v=>{try{localStorage.setItem(KEY(),JSON.stringify(v));}catch(e){}};
const fmtD=s=>{const x=new Date(s);return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+x.getFullYear();};
const fmtS=n=>n>1048576?(n/1048576).toFixed(1)+' МБ':Math.max(1,Math.round(n/1024))+' КБ';

/* need: 'y' нужен, 'ask' зависит от ответа, 'opt' желательно */
const GRP=[
 ['co','Учредительные и полномочия'],['tk','Трудовые отношения'],['pd','Персональные данные'],['ot','Охрана труда и воинский учёт'],['ind','По вашей сфере']];
const CAT=[
 {id:'ustav',g:'co',t:'Устав',why:'Определяет, кто вправе подписывать договоры и приказы. По нему мы будем проверять, что документы ему не противоречат.',when:c=>c.ip?'skip':'y'},
 {id:'egr',g:'co',t:'Выписка из ЕГРЮЛ или ЕГРИП',why:'Подтверждает руководителя и реквизиты. Свежую выписку можно получить на сайте ФНС.',when:()=>'y'},
 {id:'head',g:'co',t:'Решение или протокол о назначении руководителя',why:'Подтверждает полномочия директора, который подписывает трудовые договоры.',when:c=>c.ip?'skip':'y'},
 {id:'poa',g:'co',t:'Доверенность на подписание кадровых документов',why:'Нужна, если договоры и приказы подписывает не руководитель, а, например, управляющий или кадровик.',when:()=>'ask',q:'Кадровые документы подписывает не руководитель?'},
 {id:'pvtr',g:'tk',t:'Правила внутреннего трудового распорядка',why:'Режим работы, перерывы, дисциплина. С ними знакомят работника под подпись при приёме.',law:'ст. 189–190 ТК',when:c=>c.n?'y':'opt'},
 {id:'staff',g:'tk',t:'Штатное расписание (Т-3)',why:'Список должностей и окладов. Без него трудно доказать, что должность и оклад не выдуманы.',law:'форма Т-3',when:c=>c.n?'y':'opt'},
 {id:'vac',g:'tk',t:'График отпусков на следующий год (Т-7)',why:'Утверждается каждый год. Работников знакомят с ним под подпись.',law:'ст. 123 ТК: не позднее чем за 2 недели до начала года',when:c=>c.n?'y':'skip'},
 {id:'pay',g:'tk',t:'Положение об оплате труда и премировании',why:'Из чего складывается зарплата, как считаются премии и надбавки. Защищает от споров о премиях.',law:'ст. 135 ТК',when:c=>c.n?'y':'opt'},
 {id:'books',g:'tk',t:'Книга учёта движения трудовых книжек',why:'Нужна, если вы ведёте бумажные трудовые книжки.',when:c=>c.n?'ask':'skip',q:'Ведёте бумажные трудовые книжки?'},
 {id:'job',g:'tk',t:'Должностные инструкции',why:'По закону не обязательны, но защищают при увольнении за неисполнение обязанностей.',when:c=>c.n?'opt':'skip'},
 {id:'mat',g:'tk',t:'Договоры о материальной ответственности',why:'Нужны для тех, кто работает с деньгами и товаром: кассиры, продавцы, кладовщики.',when:c=>['food','foodtrade','trade','pvz'].includes(c.ind)?'y':'ask',q:'Есть сотрудники, которые отвечают за деньги или товар?'},
 {id:'remote',g:'tk',t:'Положение о дистанционной работе',why:'Порядок работы удалённо: оборудование, связь, отчётность, электронный документооборот.',law:'гл. 49.1 ТК',when:c=>c.remote?'y':'ask',q:'Есть сотрудники на удалёнке?'},
 {id:'pdpol',g:'pd',t:'Политика обработки персональных данных',why:'Публичный документ о том, как вы храните данные работников и клиентов. Размещается на сайте, если он есть.',law:'ст. 18.1 152-ФЗ',when:()=>'y'},
 {id:'pdreg',g:'pd',t:'Положение об обработке персональных данных работников',why:'Кто имеет доступ к паспортам и личным делам, как они хранятся и когда уничтожаются.',law:'ст. 86–90 ТК',when:c=>c.n?'y':'opt'},
 {id:'pdresp',g:'pd',t:'Приказ о назначении ответственного за персональные данные',why:'Один человек отвечает за защиту данных. Часто путают с директором: он тоже может быть ответственным.',law:'ст. 22.1 152-ФЗ',when:()=>'y'},
 {id:'otresp',g:'ot',t:'Приказ о назначении ответственного за охрану труда',why:'Для малого бизнеса служба охраны труда не нужна, но ответственный должен быть.',law:'ТК, раздел X',when:c=>c.n?'y':'skip'},
 {id:'otintro',g:'ot',t:'Программа вводного инструктажа и журнал',why:'Каждого нового работника инструктируют и расписываются в журнале.',law:'ст. 214 ТК',when:c=>c.n?'y':'skip'},
 {id:'otinstr',g:'ot',t:'Инструкции по охране труда по должностям',why:'Что делать и чего не делать на рабочем месте. Пекарю одни, программисту другие.',law:'ст. 214 ТК',when:c=>c.n?'y':'skip'},
 {id:'sout',g:'ot',t:'Результаты специальной оценки условий труда (СОУТ) или декларация',why:'Определяет класс условий труда, от него зависят взносы и компенсации.',law:'426-ФЗ',when:c=>c.n?'y':'skip'},
 {id:'milord',g:'ot',t:'Приказ об ответственном за воинский учёт',why:'Нужен, если среди сотрудников есть военнообязанные: вы сдаёте сведения в военкомат.',law:'ПП РФ № 719',when:c=>c.n?'y':'skip'},
 {id:'sanprog',g:'ind',t:'Программа производственного контроля',why:'Санитарные правила для кухни, склада и зала. Её спрашивает Роспотребнадзор.',when:c=>['food','foodprod'].includes(c.ind)?'y':'skip'},
 {id:'haccp',g:'ind',t:'Процедуры ХАССП',why:'Контроль безопасности пищи по точкам риска: приёмка, хранение, температура, мойка.',law:'ТР ТС 021/2011',when:c=>['food','foodprod'].includes(c.ind)?'ask':'skip',q:'Готовите или перерабатываете еду на месте?'},
 {id:'medlog',g:'ind',t:'Журнал допуска по медкнижкам и состоянию здоровья',why:'Кто из сотрудников допущен к работе с продуктами и до какого срока действует медкнижка.',when:c=>['food','foodprod','foodtrade'].includes(c.ind)?'y':'skip'},
 {id:'kt',g:'ind',t:'Положение о коммерческой тайне и защите информации',why:'Без введённого режима вы не сможете наказать за утечку кода или клиентской базы.',law:'98-ФЗ «О коммерческой тайне»',when:c=>c.ind==='office'?'y':'skip'},
 {id:'nda',g:'ind',t:'Соглашение о неразглашении и об интеллектуальных правах',why:'Закрепляет, что код и разработки принадлежат компании. Подписывается при приёме.',when:c=>c.ind==='office'?'y':'skip'},
 {id:'isp',g:'ind',t:'Политика информационной безопасности',why:'Пароли, доступы, удалённые устройства. Требуют крупные заказчики.',when:c=>c.ind==='office'?'opt':'skip'}
];

const TODAY=()=>{const d=new Date();return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();};
function coCtx(){
  const ses=H.session()||{},A=H.state().company||{},u=(get().ustav||{}).info||{};
  return {name:ses.company||'Наименование организации',inn:ses.inn||'',ip:String(ses.inn||'').length===12,head:A.head||ses.fio||'',post:u.head||A.post||'Руководитель',hours:A.hours||'',mode:A.mode||'5/2',pay:A.pay||'',vac:+A.vac||28,fullName:u.fullName||''};
}
const PL=(n,a,b,c)=>{const m=n%100,k=n%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
const blank='__________';
const head=c=>`<p style="text-align:center"><b>${esc(c.fullName||c.name)}</b>${c.inn?'<br>ИНН '+esc(c.inn):''}</p>`;
const signBlock=c=>`<p style="margin-top:28px">${esc(c.post)} ____________ / ${esc(c.head||blank)}</p>`;
const prikaz=(c,sub,body,fam)=>`${head(c)}<h3 style="text-align:center">ПРИКАЗ № ${blank}</h3><p style="text-align:center">${TODAY()}</p><p style="text-align:center"><b>${sub}</b></p>${body}${signBlock(c)}${fam?`<p>С приказом ознакомлен(а): ____________ / ${esc(fam)} / ${TODAY()}</p>`:''}`;
const who=p=>p&&p.fio?`${esc(p.fio)}${p.pos?', '+esc(p.pos):''}`:blank;
const TPL={
 pdresp:{t:'Приказ об ответственном за персональные данные',pick:true,make:(c,p)=>prikaz(c,'О назначении ответственного за организацию обработки персональных данных',`<p>В соответствии со статьёй 22.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» ПРИКАЗЫВАЮ:</p><ol><li>Назначить ${who(p)} ответственным за организацию обработки персональных данных в организации.</li><li>Ответственному: организовать обработку и защиту персональных данных в соответствии с законодательством; знакомить работников с положениями о персональных данных под подпись; принимать и рассматривать обращения субъектов персональных данных; контролировать хранение личных дел и документов.</li><li>Контроль за исполнением приказа оставляю за собой.</li></ol>`,p&&p.fio)},
 otresp:{t:'Приказ об ответственном за охрану труда',pick:true,make:(c,p)=>prikaz(c,'О назначении ответственного за организацию работы по охране труда',`<p>В целях организации работы по охране труда в соответствии с Трудовым кодексом Российской Федерации ПРИКАЗЫВАЮ:</p><ol><li>Назначить ${who(p)} ответственным за организацию работы по охране труда.</li><li>Ответственному: проводить вводный инструктаж с вновь принятыми работниками и вести журнал инструктажей; организовать разработку и пересмотр инструкций по охране труда; контролировать соблюдение работниками требований охраны труда и обеспечение средствами индивидуальной защиты.</li><li>Контроль за исполнением приказа оставляю за собой.</li></ol>`,p&&p.fio)},
 milord:{t:'Приказ об ответственном за воинский учёт',pick:true,make:(c,p)=>prikaz(c,'О назначении ответственного за ведение воинского учёта',`<p>В соответствии с Федеральным законом от 28.03.1998 № 53-ФЗ «О воинской обязанности и военной службе» и Положением о воинском учёте, утверждённым постановлением Правительства РФ от 27.11.2006 № 719, ПРИКАЗЫВАЮ:</p><ol><li>Назначить ${who(p)} ответственным за ведение воинского учёта работников, пребывающих в запасе.</li><li>Ответственному: вести учёт по личным карточкам формы Т-2; передавать в военный комиссариат сведения о принятых и уволенных военнообязанных в установленные сроки; хранить документы воинского учёта.</li><li>Контроль за исполнением приказа оставляю за собой.</li></ol>`,p&&p.fio)},
 pvtr:{t:'Правила внутреннего трудового распорядка',make:c=>{const M={'5/2':'пятидневная рабочая неделя с двумя выходными днями (суббота и воскресенье)',shift:'сменный график работы по графику сменности, утверждаемому работодателем',flex:'гибкий график работы','2/2':'график работы 2/2'}[c.mode]||'пятидневная рабочая неделя';
  return `${head(c)}<h3 style="text-align:center">ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА</h3><p style="text-align:center">Утверждены приказом № ${blank} от ${TODAY()}</p>
  <h4>1. Общие положения</h4><p>1.1. Правила разработаны в соответствии с Трудовым кодексом Российской Федерации (статьи 189 и 190) и определяют порядок приёма и увольнения работников, основные права и обязанности сторон, режим работы, время отдыха, меры поощрения и взыскания.</p><p>1.2. Правила обязательны для всех работников организации. С ними работника знакомят под подпись при приёме на работу.</p>
  <h4>2. Приём и увольнение</h4><p>2.1. Приём на работу оформляется трудовым договором и приказом. Работник предъявляет документы, перечень которых установлен статьёй 65 Трудового кодекса.</p><p>2.2. Прекращение трудового договора производится по основаниям и в порядке, установленным Трудовым кодексом.</p>
  <h4>3. Основные обязанности работника</h4><p>Добросовестно исполнять трудовые обязанности; соблюдать Правила и трудовую дисциплину; выполнять требования охраны труда; бережно относиться к имуществу работодателя; незамедлительно сообщать о ситуации, угрожающей жизни и здоровью людей или сохранности имущества.</p>
  <h4>4. Основные обязанности работодателя</h4><p>Предоставлять работу по трудовому договору; обеспечивать безопасные условия труда; выплачивать заработную плату в установленные сроки${c.pay?' (дни выплаты: '+esc(c.pay)+')':''}; знакомить работников с локальными актами под подпись.</p>
  <h4>5. Режим работы и время отдыха</h4><p>5.1. В организации установлена ${M}${c.hours?'. Рабочий день: '+esc(c.hours):''}.</p><p>5.2. Перерыв для отдыха и питания предоставляется продолжительностью не менее 30 минут и не более двух часов, в рабочее время не включается.</p><p>5.3. Ежегодный основной оплачиваемый отпуск предоставляется продолжительностью ${c.vac} календарных ${PL(c.vac,'день','дня','дней')} в соответствии с графиком отпусков.</p>
  <h4>6. Поощрения и взыскания</h4><p>За добросовестный труд применяются поощрения: благодарность, премия. За нарушение трудовой дисциплины применяются замечание, выговор, увольнение по соответствующим основаниям. До применения взыскания работодатель требует от работника письменное объяснение.</p>
  <h4>7. Заключительные положения</h4><p>Правила вступают в силу с даты утверждения и действуют до принятия новых.</p>${signBlock(c)}`;}},
 kt:{t:'Положение о коммерческой тайне',make:c=>`${head(c)}<h3 style="text-align:center">ПОЛОЖЕНИЕ О КОММЕРЧЕСКОЙ ТАЙНЕ</h3><p style="text-align:center">Утверждено приказом № ${blank} от ${TODAY()}</p>
  <h4>1. Общие положения</h4><p>1.1. Положение вводит в организации режим коммерческой тайны в соответствии с Федеральным законом от 29.07.2004 № 98-ФЗ «О коммерческой тайне».</p><p>1.2. Положение обязательно для всех работников, которым доверена коммерческая тайна.</p>
  <h4>2. Перечень сведений, составляющих коммерческую тайну</h4><p>2.1. Исходный код, архитектура и техническая документация продуктов.</p><p>2.2. Клиентская база, условия договоров, цены и скидки.</p><p>2.3. Финансовые показатели, не подлежащие раскрытию, планы развития.</p><p>2.4. Иные сведения: ${blank}.</p><p>2.5. Сведения, которые по ст. 5 98-ФЗ коммерческой тайной быть не могут (учредительные документы, сведения о численности и оплате труда, о нарушениях закона и др.), в перечень не входят.</p>
  <h4>3. Порядок доступа и учёта</h4><p>3.1. Доступ получают только работники из утверждённого списка. Список ведёт: ${blank}.</p><p>3.2. Работник знакомится с Положением и перечнем под подпись и подписывает соглашение о неразглашении при приёме на работу.</p><p>3.3. На документах и носителях ставится гриф «Коммерческая тайна» с указанием организации.</p>
  <h4>4. Меры охраны</h4><p>4.1. Личные пароли, двухфакторная защита, запрет пересылки на личную почту и в личные облака.</p><p>4.2. При увольнении работник возвращает носители, права доступа закрываются в день увольнения.</p>
  <h4>5. Ответственность</h4><p>Нарушение влечёт дисциплинарную, материальную, гражданско-правовую и иную ответственность по закону (ст. 14 98-ФЗ, ст. 81 и 243 ТК РФ).</p>${signBlock(c)}`},
 nda:{t:'Соглашение о неразглашении коммерческой тайны (форма)',make:c=>{const T=window.SHTATKA_TPL&&window.SHTATKA_TPL.nda;
  const f=T?T.replace(/\{\{org\}\}/g,esc(c.name)).replace(/\{\{orgInn\}\}/g,esc(c.inn)).replace(/\{\{orgHeadPost\}\}/g,esc((c.post||'').toLowerCase())).replace(/\{\{orgHead\}\}/g,esc(c.head||blank)).replace(/\{\{date\}\}/g,TODAY()).replace(/\{\{number\}\}/g,blank).replace(/\{\{city\}\}/g,'').replace(/\{\{(\w+)\}\}/g,blank):'';
  return f||'<p>Шаблон недоступен.</p>';}},
 vac:{t:'График отпусков',make:c=>{const R_=window.SHTATKA_HR,now=new Date(),y=now.getMonth()>=8?now.getFullYear()+1:now.getFullYear(),L=R_?R_.active():[];
  return `${head(c)}<p style="text-align:right">Утверждён приказом № ${blank} от ${TODAY()}</p><h3 style="text-align:center">ГРАФИК ОТПУСКОВ на ${y} год</h3>
  <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:13px"><tr><th>№</th><th>Должность</th><th>ФИО</th><th>Дней</th><th>Дата начала</th><th>Дата окончания</th><th>Ознакомлен(а)</th></tr>
  ${L.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.position||'')}</td><td>${esc(e.fio)}</td><td>${c.vac}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')||'<tr><td colspan="7">Нет сотрудников</td></tr>'}</table>
  <p style="font-size:13px">График отпусков утверждается не позднее чем за две недели до начала календарного года (статья 123 Трудового кодекса). Работник должен быть извещён о начале отпуска под подпись не позднее чем за две недели.</p>${signBlock(c)}`;}}
};
function vacOrder(e,r){const c=coCtx(),f=s=>{const x=new Date(s);return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+x.getFullYear();};
  return prikaz(c,'О предоставлении отпуска работнику',`<p>Предоставить ${esc(e.fio)}, ${esc(e.position||'')}, ежегодный основной оплачиваемый отпуск на ${r.days} календарных ${PL(r.days,'день','дня','дней')} с ${f(r.from)} по ${f(r.to)}.</p><p>Основание: заявление работника от ${f(r.at)}.</p>`,e.fio);}
function showDoc(title,html){
  let dl=document.getElementById('cdDlg');if(!dl){dl=document.createElement('dialog');dl.id='cdDlg';dl.className='cd-dlg';document.body.appendChild(dl);}
  dl.innerHTML=`<div class="cd-dh"><b>${esc(title)}</b><button type="button" class="x" data-cdx aria-label="Закрыть">×</button></div><div class="cd-db" id="cdDoc">${html}</div>
  <p class="cd-note">Это образец. Проверьте текст и реквизиты, при необходимости покажите юристу. Дату и номер приказа впишите при подписании.</p>
  <div class="cd-df"><button type="button" class="b d" data-cdprint>Печать или PDF</button><button type="button" class="b" data-cdsave>Сохранить в документы компании</button></div>`;
  dl.showModal();return dl;
}
function ustavBox(s){
  const u=s&&s.info;if(!u)return s&&s.scan?'<div class="cd-u"><b>Это скан, текста в файле нет.</b> Чтение сканов подключим следующим шагом. Пока можно загрузить устав в виде PDF с текстом (из Word или с сайта ФНС).</div>':'';
  const f=u,L=[['Наименование',f.fullName],['Место нахождения',f.address],['Уставный капитал',f.capital],['Руководитель',f.head],['Срок полномочий',f.term],['Действует без доверенности',f.noPoa?'да':'не нашли'],['Крупные сделки',f.bigDeal?'порядок есть в уставе':'не нашли'],['Принимает решения',f.sole]].filter(x=>x[1]);
  return `<div class="cd-u"><b>Что мы прочитали в уставе</b><div class="cd-ut">${L.map(x=>`<span>${x[0]}</span><b>${esc(x[1])}</b>`).join('')}</div>${(s.warn||[]).map(w=>`<p class="cd-w2">${esc(w)}</p>`).join('')}<small>Проверьте: это автоматическое чтение шаблонных формулировок. Документы мы будем готовить так, чтобы они не противоречили этим пунктам.</small></div>`;
}
let curMake=null;
function ctx(){
  const ses=H.session()||{},co=ses.co||{},emps=R?R.active():[];
  return {ip:!!co.ip||String(ses.inn||'').length===12,n:emps.length,ind:J?J.industry().id:'',remote:emps.some(e=>e.remote||e.workMode==='remote')};
}
let moreOpen=false;document.addEventListener('toggle',e=>{if(e.target.classList&&e.target.classList.contains('cd-more'))moreOpen=e.target.open;},true);
let curTab='';try{curTab=sessionStorage.getItem('shtatka-cd-tab')||'';}catch(e){}
function view(){
  if(!$('#cdocs'))return;
  const st=get(),c=ctx();
  const rows=CAT.map(x=>{const w=x.when(c);return Object.assign({},x,{w,s:st[x.id]||{}});}).filter(x=>x.w!=='skip');
  const done=r=>r.s.files&&r.s.files.length,na=r=>r.s.st==='na',
    need=rows.filter(r=>r.w==='y'),have=need.filter(r=>done(r)||na(r)).length;
  const head=`<div class="cd-prog"><div><b>${have} из ${need.length}</b><small>обязательных документов в порядке</small></div><div class="cd-bar"><i style="width:${need.length?Math.round(have/need.length*100):0}%"></i></div></div>
   <p class="hint2">${c.ip?'Вы ИП: устава нет, вместо него загрузите выписку из ЕГРИП.':'Загрузите устав: по нему мы будем проверять, что документы ему не противоречат.'} Отметьте «нет», если документа нет, и мы поможем его создать. Копии хранятся в вашем браузере.</p>`;
  const tabs=GRP.filter(([g])=>rows.some(r=>r.g===g));if(!tabs.some(t=>t[0]===curTab))curTab=tabs[0]?tabs[0][0]:'';
  const tabBar=`<div class="cd-tabs" role="tablist">${tabs.map(([g,gt])=>{const L=rows.filter(r=>r.g===g),nd=L.filter(r=>r.w==='y'&&!done(r)&&!na(r)).length;return `<button type="button" role="tab" class="cd-tab" data-cdtab="${g}" aria-selected="${g===curTab}">${gt}${nd?`<i>${nd}</i>`:''}</button>`;}).join('')}</div>`;
  const body=tabBar+GRP.filter(([g])=>g===curTab).map(([g,gt])=>{const L=rows.filter(r=>r.g===g);if(!L.length)return '';
    const art=r=>{
      const hv=done(r),n=na(r),no=r.s.st==='no';
      const badge=hv?'<span class="pill ok">загружен</span>':n?'<span class="pill">не нужен</span>':no?'<span class="pill warn">нет: надо создать</span>':r.w==='y'?'<span class="pill warn">обязателен</span>':r.w==='ask'?'<span class="pill info">зависит от вас</span>':'<span class="pill">желательно</span>';
      const files=(r.s.files||[]).map((f,i)=>`<div class="cd-f"><a href="#" data-dl="${r.id}:${i}">${esc(f.name)}</a><small>${fmtS(f.size)} · ${fmtD(f.at)}</small><button type="button" class="x" data-rm="${r.id}:${i}" aria-label="Удалить файл">×</button></div>`).join('');
      const ask=r.w==='ask'&&!hv&&!n&&!no?`<p class="cd-q"><b>${esc(r.q||'Нужен ли он вам?')}</b> <button type="button" class="b" data-st="${r.id}:no">Да, документа нет</button> <button type="button" class="b" data-st="${r.id}:na">Нет, не нужно</button></p>`:'';
      return `<article class="cd" id="cd-${r.id}"><div class="cd-h"><b>${esc(r.t)}</b>${badge}</div><p class="cd-w">${esc(r.why)}${r.law?` <small>${esc(r.law)}</small>`:''}</p>${files}${r.id==='ustav'?ustavBox(r.s):''}${ask}
       <div class="cd-b"><label class="b ${hv?'':'d'}">${hv?'Добавить файл':'Загрузить'}<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.odt" data-up="${r.id}" hidden multiple></label>
       ${TPL[r.id]?`<button type="button" class="b" data-make="${r.id}">Создать с нуля</button>`:'<button type="button" class="b" data-soon="Шаблон этого документа подключим на следующих шагах">Создать с нуля</button>'}
       ${hv||n?'':`<button type="button" class="b" data-st="${r.id}:no">Нет такого</button><button type="button" class="b" data-st="${r.id}:na">Не нужен</button>`}${n||no?`<button type="button" class="b" data-st="${r.id}:">Сбросить</button>`:''}</div></article>`;};
    const pri=r=>(r.w==='y'&&!done(r)&&!na(r)?0:1);const S=L.map((r,i)=>[r,i]).sort((x,y)=>pri(x[0])-pri(y[0])||x[1]-y[1]).map(x=>x[0]);const top=S.slice(0,3),rest=S.slice(3);
    return top.map(art).join('')+(rest.length?`<details class="cd-more"${moreOpen?' open':''}><summary>Ещё ${rest.length} ${PL(rest.length,'документ','документа','документов')}</summary>${rest.map(art).join('')}</details>`:'');}).join('');
  $('#cdocs').innerHTML=`<h2>Документы компании</h2>`+head+body;
}
document.addEventListener('change',async e=>{const i=e.target.closest('[data-up]');if(!i)return;const id=i.dataset.up,fl=[...i.files];i.value='';if(!fl.length)return;
  const st=get(),s=st[id]||{};s.files=s.files||[];
  for(const f of fl){if(f.size>25*1024*1024){toast('Файл «'+f.name+'» больше 25 МБ.');continue;}
    try{const r=await DZ.putFile(f,f.name);s.files.push({id:r.id,name:f.name,size:f.size,at:r.at});}catch(x){toast('Не удалось сохранить файл. Проверьте место в браузере.');}}
  s.st='';st[id]=s;put(st);view();toast('Загружено: '+fl.length+' шт.');
  if(id==='ustav'&&window.SHTATKA_USTAV){const U=window.SHTATKA_USTAV;toast('Читаем устав…');const r=await U.read(fl[0]);const st2=get(),s2=st2.ustav||{};
    if(r.ok){s2.info=r.fields;s2.scan=false;const A=H.state().company||{},ses=H.session()||{};s2.warn=U.check(r.fields,{name:ses.company,post:A.post});}
    else if(r.reason==='scan'){s2.scan=true;s2.info=null;s2.warn=[];}
    st2.ustav=s2;put(st2);view();toast(r.ok?'Устав прочитан: найдено '+r.found+' из 5 основных пунктов.':r.reason==='scan'?'Это скан: текст не распознан.':'Не удалось прочитать файл.');}});
document.addEventListener('click',async e=>{
  const tb=e.target.closest('[data-cdtab]');if(tb){curTab=tb.dataset.cdtab;try{sessionStorage.setItem('shtatka-cd-tab',curTab);}catch(x){}view();return;}
  const mk=e.target.closest('[data-make]');
  if(mk){const id=mk.dataset.make,T=TPL[id];if(!T)return;
    if(T.pick){const L=(R?R.active():[]);const opts=L.map(x=>`<option value="${x.id}">${esc(x.fio)}${x.position?' — '+esc(x.position):''}</option>`).join('');
      const dl=showDoc(T.t,`<p>Кого назначить ответственным?</p><select id="cdPick" class="cd-sel"><option value="">— выберите сотрудника —</option>${opts}<option value="_me">Руководитель (я)</option></select>`);
      curMake=id;dl.querySelector('.cd-df').hidden=true;dl.querySelector('.cd-note').hidden=true;
      dl.querySelector('#cdPick').onchange=ev=>{const v=ev.target.value;if(!v)return;const c=coCtx(),x=v==='_me'?{fio:c.head,pos:c.post}:(()=>{const q=R.get(v);return {fio:q.fio,pos:q.position};})();
        dl.querySelector('#cdDoc').innerHTML=T.make(c,x);dl.querySelector('.cd-df').hidden=false;dl.querySelector('.cd-note').hidden=false;};
    }else{curMake=id;showDoc(T.t,T.make(coCtx()));}return;}
  if(e.target.closest('[data-cdx]')){document.getElementById('cdDlg').close();return;}
  if(e.target.closest('[data-cdprint]')){const w=window.open('','_blank');if(w){w.document.write('<meta charset="utf-8"><title>Документ</title><style>body{font:14px/1.5 Arial,sans-serif;max-width:760px;margin:30px auto}table{border-collapse:collapse}td,th{border:1px solid #444;padding:5px}</style>'+document.getElementById('cdDoc').innerHTML);w.document.close();w.focus();setTimeout(()=>w.print(),300);}else toast('Браузер заблокировал окно печати.');return;}
  if(e.target.closest('[data-cdsave]')&&curMake){const html='<meta charset="utf-8"><title>'+TPL[curMake].t+'</title>'+document.getElementById('cdDoc').innerHTML,name=TPL[curMake].t+' — '+TODAY()+'.html';
    const r=await DZ.putFile(new Blob([html],{type:'text/html'}),name),st=get(),sx=st[curMake]||{};sx.files=(sx.files||[]).concat([{id:r.id,name,size:html.length,at:r.at}]);sx.st='';st[curMake]=sx;put(st);document.getElementById('cdDlg').close();view();toast('Сохранено в документы компании.');return;}
  const t=e.target.closest('[data-st],[data-rm],[data-dl]');if(!t||!$('#cdocs')||!$('#cdocs').contains(t))return;
  if(t.dataset.st!=null){const [id,v]=t.dataset.st.split(':'),st=get(),s=st[id]||{};s.st=v;st[id]=s;put(st);view();return;}
  const [id,i]=(t.dataset.rm||t.dataset.dl).split(':'),st=get(),f=(st[id]&&st[id].files||[])[+i];if(!f)return;
  if(t.dataset.dl!=null){e.preventDefault();const r=await DZ.getFile(f.id);if(!r){toast('Файл не найден в этом браузере.');return;}
    const a=document.createElement('a');a.href=URL.createObjectURL(r.blob);a.download=f.name;document.body.appendChild(a);a.click();a.remove();return;}
  if(t.dataset.arm){await DZ.delFile(f.id).catch(()=>{});st[id].files.splice(+i,1);put(st);view();toast('Файл удалён.');}
  else{t.dataset.arm='1';t.textContent='Удалить?';setTimeout(()=>{t.dataset.arm='';t.textContent='×';},2500);}
});
window.SHTATKA_CDOCS={CAT,view,get,TPL,vacOrder,showDoc,coCtx};
view();
})();
