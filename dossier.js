/* Штатка: личное дело сотрудника — какие документы собрать, зачем, и копии файлов.
   Перечень: ст. 65 ТК (все), ст. 327.3 ТК (иностранцы), отдельные законы по должности. Сверено 03.11.2026, нормы помечены — проверить у юриста.
   Требовать сверх перечня закона нельзя (ч. 3 ст. 65 ТК): документы «по желанию» человек даёт сам, чтобы получить выплату или вычет.
   Копии файлов хранятся в браузере (IndexedDB) до подключения сервера; на сервере — в РФ, доступ только у компании. */
(function(){
const R=()=>window.SHTATKA_HR;
const LAB=e=>e.contract==='open'||e.contract==='fixed';
const ru=e=>e.regime==='ru';
const pos=e=>String(e.position||'').toLowerCase();
/* kind: req — обязателен по закону; cond — нужен в вашем случае (можно отключить); opt — по желанию сотрудника; make — оформляем мы */
const LIST=[
 {k:'passport',t:'Паспорт',grp:'base',when:e=>'req',law:'ст. 65 ТК',num:e=>e.passport&&e.passport.series?e.passport.series+' '+e.passport.number:'',
  why:'Подтверждает личность. Из него берутся ФИО, дата рождения и адрес для договора, личной карточки Т-2 и отчётов в СФР и налоговую. Без паспорта трудовой договор не заключают.'},
 {k:'pd',t:'Согласие на обработку персональных данных',grp:'base',when:e=>'make',law:'ст. 9 152-ФЗ, отдельный документ',doc:'pd',
  why:'Нужно, чтобы законно хранить и передавать данные человека, которые не требует закон: фото, копии, телефон для рассылок. Оформляется отдельным документом — готовый бланк во вкладке «Документы».'},
 {k:'etk',t:'Трудовая книжка или сведения о трудовой деятельности (СТД-Р, СТД-СФР)',grp:'base',when:e=>LAB(e)?(e.firstJob?null:'req'):null,law:'ст. 65, 66.1 ТК',
  why:'Показывают стаж и последнее место работы. Стаж нужен для оплаты больничных, а сведения — чтобы правильно подать ЕФС-1. Если человек устраивается впервые, мы оформляем всё сами.'},
 {k:'snils',t:'СНИЛС (уведомление АДИ-РЕГ или зелёная карточка)',grp:'base',when:e=>e.contract==='rent'?null:'req',law:'ст. 65 ТК',num:e=>e.snils||'',scan:'snils',
  why:'По номеру СНИЛС компания сдаёт ЕФС-1 о приёме и увольнении, а СФР начисляет пенсию и выплачивает больничные. Если СНИЛС нет, компания подаёт анкету в СФР и получает его за человека.'},
 {k:'mil',t:'Военный билет или удостоверение призывника',grp:'base',when:e=>{const m=R().mil(e);return LAB(e)&&['in','check'].includes(m.st)?'req':null;},law:'ст. 65 ТК, 53-ФЗ',num:e=>e.milDoc||'',
  why:'Компания обязана вести воинский учёт: внести данные в карточку Т-2 и сообщить в военкомат о приёме и увольнении в течение 5 рабочих дней. Штраф за отсутствие учёта — на компанию.'},
 {k:'edu',t:'Диплом, удостоверение или свидетельство о квалификации',grp:'job',when:e=>e.needEdu?'cond':'off',law:'ст. 65 ТК',
  why:'Нужен, только если работа требует специальных знаний: врач, электрик, водитель погрузчика, бухгалтер. Подтверждает допуск к работе и защищает компанию при проверке и несчастном случае.'},
 {k:'med',t:'Медицинское заключение или медкнижка',grp:'job',when:e=>{const a=R().age(e.birth);return (a!=null&&a<18)||/повар|бариста|кассир|продав|официант|водител|медсест|врач|воспит|учител|уборщ|горничн/.test(pos(e))||e.needMed?'cond':'off';},law:'ст. 69, 213, 214 ТК; СанПиН для пищевых и детских объектов',
  why:'Для работы с продуктами, детьми, за рулём, во вредных условиях и для подростков медосмотр обязателен до выхода на работу. Без него сотрудника нельзя ставить на смену.'},
 {k:'drv',t:'Водительское удостоверение',grp:'job',when:e=>/водител|экспедит|курьер|шофер|машинист/.test(pos(e))?'cond':'off',law:'ст. 65 ТК, 196-ФЗ',
  why:'Подтверждает право управлять транспортом нужной категории. Срок действия отслеживаем: с просроченными правами к рейсу не допускают.'},
 {k:'nda',t:'Соглашение о неразглашении коммерческой тайны',grp:'job',when:e=>R().needNda&&R().needNda(e)?'make':null,law:'98-ФЗ, ст. 57 и 81 ТК',doc:'nda',
  why:'Для офисной работы с клиентской базой, кодом и ценами: без подписанного соглашения и введённого режима коммерческой тайны наказать за утечку трудно. Для бариста и операторов ПВЗ не нужно.'},
 {k:'crim',t:'Справка о несудимости',grp:'job',when:e=>e.needCrim?'cond':'off',law:'ст. 65, 351.1 ТК',
  why:'Только для работы с детьми, в образовании, медицине, соцзащите, культуре и спорте и в других случаях по закону. В остальных случаях требовать её нельзя.'},
 {k:'drug',t:'Справка о наказании за потребление наркотиков',grp:'job',when:e=>e.needCrim?'cond':'off',law:'ст. 65, 331.1, 351.1 ТК',
  why:'Нужна там же, где справка о несудимости, если этого прямо требует закон для должности.'},
 // иностранцы: пока только паспорт, остальное в работе
 {k:'fpass',t:'Паспорт иностранного гражданина и нотариальный перевод',grp:'for',when:e=>ru(e)?null:'req',law:'ст. 65 ТК',
  why:'Удостоверяет личность иностранца. Если паспорт не на кириллице, для договора нужен нотариальный перевод.'},
 // по желанию
 {k:'inn',t:'ИНН',grp:'opt',when:e=>e.contract==='self'?'req':'opt',law:'ч. 3 ст. 65 ТК: требовать нельзя',num:e=>e.innP||'',
  why:'Для трудового договора не обязателен: компания может узнать ИНН на сайте налоговой по паспорту. Обязателен только для договора с самозанятым — по нему проверяется статус.'},
 {k:'182n',t:'Справка о заработке за 2 года (182н)',grp:'opt',when:e=>LAB(e)?'opt':null,law:'255-ФЗ',
  why:'Нужна, чтобы правильно посчитать больничные и декретные по заработку с прошлой работы. Без неё пособие будет считаться из МРОТ.'},
 {k:'kids',t:'Свидетельства о рождении детей и заявление на вычет',grp:'opt',when:e=>e.contract==='rent'||e.contract==='self'?null:'opt',law:'ст. 218 НК',
  why:'Дают стандартный вычет по НДФЛ на детей: сотрудник платит меньше налога. Без заявления и документов вычет не предоставляется.'},
 {k:'bank',t:'Заявление о перечислении зарплаты и реквизиты',grp:'opt',when:e=>e.contract==='self'?null:'opt',law:'ст. 136 ТК',
  why:'Чтобы платить на карту выбранного банка. Сотрудник вправе сам выбрать банк, предупредив за 15 дней.'},
 {k:'name',t:'Свидетельство о браке или смене фамилии',grp:'opt',when:e=>'opt',law:'',
  why:'Нужно, если фамилия в дипломе или трудовой книжке не совпадает с паспортом.'}
];
const EXP=['med','drv','edu','dms','migcard','reg','patent','permit','rvp'];
const SHORT={med:'медкнижка',drv:'права',edu:'диплом',dms:'полис ДМС',migcard:'миграционная карта',reg:'регистрация',patent:'патент',permit:'разрешение',rvp:'РВП/ВНЖ'};
const GRP={base:'Обязательные для всех',job:'По должности',for:'Иностранный паспорт',opt:'По желанию сотрудника'};
/* состояние документа: none — нет; shown — оригинал предъявлен, копию не делали; copy — копия в личном деле; skip — не требуется */
const ADV=['med','drv','edu','crim','drug'];
function adviceFor(e){const J=window.SHTATKA_JOBS,R_=R();if(!J)return {};const ind=J.industry();
  return J.advise({industry:ind.id,position:e.position,remote:e.remote,age:R_.age(e.birth),answers:e.answers||{}}).items;}
function items(e){const st=e.dossier||{},adv=adviceFor(e);
  return LIST.map(x=>{let w=x.when(e);if(w==null)return null;
    const s=st[x.k]||{};let why='',q=null;
    if(ADV.includes(x.k)&&adv[x.k]){const a=adv[x.k];w=a.need===true?'cond':a.need===false?'off':'ask';why=a.why||'';q=a.q;}
    if(w==='off'&&s.on)w='cond';if(w==='cond'&&s.on===false)w='off';
    const until=s.until||'';const exp=until&&until<new Date().toISOString().slice(0,10);
    return Object.assign({},x,{reason:why,q,expires:EXP.includes(x.k),until,expired:exp,need:w,state:exp?'none':s.state||(x.k==='passport'&&e.passport&&e.passport.series?'shown':x.k==='snils'&&e.snils?'shown':'none'),files:s.files||[],num:x.num?x.num(e):''});}).filter(Boolean);}
function progress(e){const all=items(e),it=all.filter(x=>x.need==='req'||x.need==='cond'||x.need==='make');
  const done=it.filter(x=>x.state==='shown'||x.state==='copy'||x.state==='done').length;return {done,total:it.length,missing:it.filter(x=>!['shown','copy','done'].includes(x.state)),asks:all.filter(x=>x.need==='ask')};}
/* файлы: IndexedDB «shtatka-files», ключ — id файла */
let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((ok,no)=>{const r=indexedDB.open('shtatka-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('f',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});return dbp;}
async function tx(mode,fn){const d=await db();return new Promise((ok,no)=>{const t=d.transaction('f',mode),s=t.objectStore('f');const r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error);});}
const uid=()=>Math.random().toString(36).slice(2,10);
async function putFile(blob,name){const id=uid();await tx('readwrite',s=>s.put({id,blob,name,type:blob.type,at:new Date().toISOString()}));return {id,name,type:blob.type,size:blob.size,at:new Date().toISOString()};}
async function getFile(id){const d=await db();return new Promise((ok,no)=>{const r=d.transaction('f').objectStore('f').get(id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function delFile(id){await tx('readwrite',s=>s.delete(id));}
/* истекающие в ближайшие n дней или уже истёкшие */
function soon(e,n){const t=new Date(),lim=new Date(t.getTime()+n*864e5).toISOString().slice(0,10);return items(e).filter(x=>x.until&&x.need!=='off'&&x.until<=lim);}
window.SHTATKA_DOSSIER={LIST,GRP,EXP,SHORT,soon,items,progress,putFile,getFile,delFile};
})();
