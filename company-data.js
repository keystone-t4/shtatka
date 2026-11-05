/* Штатка: сведения о компании по ИНН из открытых источников.
   Порядок источников:
   1) свой сервер {companyUrl}?inn=… (server/company-proxy.mjs): ЕГРЮЛ/ЕГРИП и реестр МСП с сайтов ФНС, ОКВЭД через DaData;
   2) DaData напрямую из браузера, если в config.js есть dadataToken;
   3) без источников — демо-карточка.
   Результат приводится к одному виду (см. norm). */
(function(){
const cfg=window.SHTATKA_CONFIG||{};
function innOk(v){v=String(v||'');if(!/^\d{10}$|^\d{12}$/.test(v))return false;const d=v.split('').map(Number);
  const c=k=>k.reduce((s,x,i)=>s+x*d[i],0)%11%10;
  if(v.length===10)return c([2,4,10,3,5,9,4,6,8])===d[9];
  return c([7,2,4,10,3,5,9,4,6,8])===d[10]&&c([3,7,2,4,10,3,5,9,4,6,8])===d[11];}
const quotes=s=>String(s||'').replace(/"([^"]*)"/g,'«$1»').replace(/"/g,'');
const MSP={MICRO:'micro',SMALL:'small',MEDIUM:'medium',1:'micro',2:'small',3:'medium'};
const TAX={USN:'usn',AUSN:'ausn',ESHN:'eshn',SRP:'srp',ENVD:'osn'};
const STATUS={ACTIVE:'active',LIQUIDATING:'liquidating',LIQUIDATED:'liquidated',BANKRUPT:'bankrupt',REORGANIZING:'reorganizing'};
const companyUrl=()=>cfg.companyUrl||(cfg.apiUrl?cfg.apiUrl.replace(/\/$/,'')+'/company':'');

/* Единый вид. Пустые поля — null: «нет данных», а не «нет». */
function norm(x){
  return {inn:x.inn,ip:String(x.inn).length===12,name:quotes(x.name)||null,fullName:quotes(x.fullName)||null,
    ogrn:x.ogrn||null,kpp:x.kpp||null,address:x.address||null,headName:x.headName||null,headPost:x.headPost||null,
    status:x.status||null,regDate:x.regDate||null,endDate:x.endDate||null,
    okved:x.okved||null,okvedName:x.okvedName||null,msp:x.msp===undefined?null:x.msp,taxSystem:x.taxSystem||null,employees:x.employees==null?null:x.employees,
    sources:x.sources||[],checkedAt:x.checkedAt||new Date().toISOString(),demo:!!x.demo};
}
function fromDadata(inn,s){
  const d=s.data||{},ip=String(inn).length===12,m=d.management||{};
  const smb=d.documents&&d.documents.smb;
  return norm({inn,name:s.value,fullName:d.name&&d.name.full_with_opf,ogrn:d.ogrn,kpp:d.kpp,address:d.address&&d.address.value,
    headName:ip?(d.name&&d.name.full)||String(s.value||'').replace(/^ИП\s+/,''):m.name,headPost:ip?'Индивидуальный предприниматель':m.post,
    status:d.state&&STATUS[d.state.status]||(d.state&&d.state.status||'').toLowerCase()||null,
    regDate:d.state&&d.state.registration_date?new Date(d.state.registration_date).toISOString().slice(0,10):null,
    okved:d.okved,okvedName:(d.okveds||[]).filter(o=>o.main).map(o=>o.name)[0]||null,
    msp:smb?MSP[smb.category]||null:undefined,taxSystem:d.finance&&TAX[d.finance.tax_system]||null,employees:d.employee_count,
    sources:['ЕГРЮЛ через DaData']});
}
async function viaServer(inn){
  const r=await fetch(companyUrl()+'?inn='+inn,{headers:{Accept:'application/json'}});
  if(r.status===404)return {notFound:true};
  if(!r.ok)throw new Error('server '+r.status);
  return norm(await r.json());
}
async function viaDadata(inn){
  const r=await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',{method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Token '+cfg.dadataToken},
    body:JSON.stringify({query:inn,count:1,branch_type:'MAIN'})});
  if(!r.ok)throw new Error('dadata '+r.status);
  const s=((await r.json()).suggestions||[])[0];
  return s?fromDadata(inn,s):{notFound:true};
}
function demo(inn){
  const ip=String(inn).length===12;
  return norm({inn,demo:true,name:ip?'ИП Фамилия Имя Отчество':'ООО «Ваша компания»',ogrn:null,kpp:null,
    address:'г. Санкт-Петербург, адрес из ЕГРЮЛ',headName:'',headPost:ip?'Индивидуальный предприниматель':'Генеральный директор',sources:['пример']});
}
/* lookup: {ok, company} | {ok:false, reason:'bad_inn'|'not_found'|'offline'} */
async function lookup(inn){
  inn=String(inn||'').replace(/\D/g,'');
  if(!innOk(inn))return {ok:false,reason:'bad_inn'};
  const tries=[];
  if(companyUrl())tries.push(viaServer);
  if(cfg.dadataToken)tries.push(viaDadata);
  if(!tries.length)return {ok:true,company:demo(inn)};
  let failed=0;
  for(const t of tries){
    try{const c=await t(inn);if(c.notFound)return {ok:false,reason:'not_found'};return {ok:true,company:c};}
    catch(e){failed++;}
  }
  return {ok:false,reason:'offline'};
}
const STATUS_RU={active:'действует',liquidating:'в процессе ликвидации',liquidated:'ликвидирована',bankrupt:'банкротство',reorganizing:'реорганизация',ceased:'прекратила деятельность'};
const MSP_RU={micro:'микропредприятие',small:'малое предприятие',medium:'среднее предприятие',none:'не в реестре МСП'};
const TAX_RU={osn:'ОСНО',usn:'УСН',ausn:'АУСН',eshn:'ЕСХН',psn:'ПСН',srp:'СРП'};
/* Статус самозанятого на сегодня: {ok, status, message, checkedAt} | {ok:false, reason:'demo'|'busy'|'offline'|'bad_inn'} */
const npdUrl=()=>cfg.npdUrl||(companyUrl()?companyUrl().replace(/\/company\/?$/,'/npd'):'');
async function npdCheck(inn){
  inn=String(inn||'').replace(/\D/g,'');if(inn.length!==12||!innOk(inn))return {ok:false,reason:'bad_inn'};
  if(!npdUrl())return {ok:false,reason:'demo'};
  try{const r=await fetch(npdUrl()+'?inn='+inn,{headers:{Accept:'application/json'}});const j=await r.json().catch(()=>({}));
    if(r.status===429)return {ok:false,reason:'busy'};if(!r.ok)return {ok:false,reason:j.error==='bad_inn'?'bad_inn':'offline'};
    return Object.assign({ok:true},j);}catch(e){return {ok:false,reason:'offline'};}
}
window.SHTATKA_COMPANY={innOk,lookup,npdCheck,norm,fromDadata,STATUS_RU,MSP_RU,TAX_RU,
  meta(c){return ['ИНН '+c.inn,c.ogrn&&((c.ip?'ОГРНИП ':'ОГРН ')+c.ogrn),c.kpp&&('КПП '+c.kpp)].filter(Boolean).join(' · ');},
  head(c){return c.ip?'Индивидуальный предприниматель':[c.headPost,c.headName].filter(Boolean).join(': ');},
  active(c){return !c.status||c.status==='active';}};
})();
