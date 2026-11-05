// Штатка: сервис сведений о компании по ИНН из открытых источников ФНС.
// Node.js 18+, без зависимостей. Запуск: node server/company-proxy.mjs
// GET /company?inn=7810964768 → JSON в формате company-data.js (norm).
//
// Источники:
//  • egrul.nalog.ru — ЕГРЮЛ/ЕГРИП: название, ОГРН, КПП, адрес, руководитель, дата регистрации и прекращения;
//  • rmsp.nalog.ru — реестр МСП: категория (микро, малое, среднее);
//  • DaData (если задан DADATA_TOKEN) — основной ОКВЭД, режим налогообложения, численность; запасной источник реквизитов.
// Сайты ФНС не дают официального API и могут менять формат или показывать капчу: поэтому кэш на сутки,
// не больше 1 запроса в секунду к ФНС и запасной источник DaData.
//
// POST /passport {kind:'main'|'reg', mime:'JPEG'|'PNG'|'PDF', content:base64} → {fields} — распознавание паспорта РФ через
// Yandex Vision OCR (model passport — главный разворот, page — страница с пропиской). Изображение не сохраняется и не пишется в лог,
// у Яндекса логирование данных выключено заголовком x-data-logging-enabled: false. Нужны YC_API_KEY (сервисный аккаунт с ролью ai.vision.user).
//
// GET /npd?inn=… → {status:true|false, message, checkedAt} — статус самозанятого (НПД) на сегодня, сервис ФНС statusnpd.nalog.ru.
// ФНС пускает не чаще 2 запросов в минуту с одного IP: запросы идут по очереди раз в 31 с, ответ хранится сутки.
//
// Переменные окружения: PORT (8787), ALLOW_ORIGIN (https://штатка.рф и punycode), DADATA_TOKEN,
// EGRUL_BASE, RMSP_BASE, DADATA_BASE (для тестов), CACHE_HOURS (24).
import http from 'node:http';
import {createEsign} from './esign.mjs';

const PORT=+process.env.PORT||8787;
const ORIGINS=(process.env.ALLOW_ORIGIN||'https://штатка.рф,https://xn--80aa3a4ab7a.xn--p1ai,https://shtatka.ru,http://localhost:8080').split(',');
const EGRUL=process.env.EGRUL_BASE||'https://egrul.nalog.ru';
const RMSP=process.env.RMSP_BASE||'https://rmsp.nalog.ru';
const DADATA=process.env.DADATA_BASE||'https://suggestions.dadata.ru';
const TOKEN=process.env.DADATA_TOKEN||'';
const TTL=(+process.env.CACHE_HOURS||24)*3600e3;
const YC_KEY=process.env.YC_API_KEY||'';
const YC_FOLDER=process.env.YC_FOLDER_ID||'';
const YC_OCR=process.env.YC_OCR_URL||'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText';
const NPD=process.env.NPD_URL||'https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status';
const UA='Mozilla/5.0 (compatible; Shtatka/1.0; +https://xn--80aa3a4ab7a.xn--p1ai)';

export function innOk(v){v=String(v||'');if(!/^\d{10}$|^\d{12}$/.test(v))return false;const d=v.split('').map(Number);
  const c=k=>k.reduce((s,x,i)=>s+x*d[i],0)%11%10;
  if(v.length===10)return c([2,4,10,3,5,9,4,6,8])===d[9];
  return c([7,2,4,10,3,5,9,4,6,8])===d[10]&&c([3,7,2,4,10,3,5,9,4,6,8])===d[11];}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=0;async function slot(){const w=last+1000-Date.now();last=Math.max(Date.now(),last+1000);if(w>0)await sleep(w);}
async function req(url,opt={},ms=8000){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
  try{return await fetch(url,{...opt,signal:ac.signal,headers:{'User-Agent':UA,Accept:'application/json, text/plain, */*',...(opt.headers||{})}});}
  finally{clearTimeout(t);}
}
const form=o=>new URLSearchParams(o).toString();
const cap=s=>String(s||'').toLowerCase().replace(/(^|[\s-])([а-яёa-z])/g,(m,a,b)=>a+b.toUpperCase());
const sent=s=>{s=String(s||'').trim().toLowerCase();return s?s[0].toUpperCase()+s.slice(1):'';};
const ruDate=s=>{const m=/^(\d\d)\.(\d\d)\.(\d{4})$/.exec(s||'');return m?`${m[3]}-${m[2]}-${m[1]}`:null;};

// ЕГРЮЛ: POST / (query=ИНН) → {t}; GET /search-result/{t} → {rows:[{n,c,g,i,o,p,a,r,e,k}]}
export async function egrul(inn){
  await slot();
  const r1=await req(EGRUL+'/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Referer:EGRUL+'/index.html'},
    body:form({vyp3CaptchaToken:'',page:'',query:inn,region:'',PreventChromeAutocomplete:''})});
  const j1=await r1.json();
  if(j1.captchaRequired||!j1.t)throw new Error('egrul: captcha or no token');
  for(let i=0;i<6;i++){
    await sleep(i?700:300);
    const r2=await req(`${EGRUL}/search-result/${j1.t}?r=${Date.now()}&_=${Date.now()}`,{headers:{Referer:EGRUL+'/index.html','X-Requested-With':'XMLHttpRequest'}});
    const j2=await r2.json();
    if(j2.status==='wait')continue;
    const row=(j2.rows||[]).find(x=>String(x.i)===inn);
    if(!row)return (j2.rows?{notFound:true}:null);
    const ip=row.k==='fl'||inn.length===12;
    const [post,...fio]=String(row.g||'').split(':');
    return {inn,ip,name:ip?'ИП '+cap(row.n):(row.c||row.n),fullName:row.n,ogrn:row.o||null,kpp:row.p||null,address:row.a||null,
      headName:ip?cap(row.n):(fio.length?cap(fio.join(':').trim()):null),headPost:ip?'Индивидуальный предприниматель':(fio.length?sent(post):null),
      regDate:ruDate(row.r),endDate:ruDate(row.e),status:row.e?'ceased':'active'};
  }
  throw new Error('egrul: timeout');
}
// Реестр МСП: POST /search-proc.json (mode=quick, query=ИНН) → {data:[{category:1|2|3,…}]}
export async function rmsp(inn){
  await slot();
  const r=await req(RMSP+'/search-proc.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Referer:RMSP+'/search.html'},
    body:form({mode:'quick',page:'1',query:inn,pageSize:'10',sortField:'NAME_EX',sort:'ASC'})});
  const j=await r.json();
  if(!j||!Array.isArray(j.data))return null;               // формат не распознан — «нет данных», а не «не МСП»
  const row=j.data.find(x=>String(x.inn||x.INN||'')===inn)||j.data[0];
  if(!row)return 'none';
  return {1:'micro',2:'small',3:'medium'}[+row.category]||null;
}
export async function dadata(inn){
  if(!TOKEN)return null;
  const r=await req(DADATA+'/suggestions/api/4_1/rs/findById/party',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Token '+TOKEN},body:JSON.stringify({query:inn,count:1,branch_type:'MAIN'})});
  if(!r.ok)throw new Error('dadata '+r.status);
  const s=((await r.json()).suggestions||[])[0];if(!s)return {notFound:true};
  const d=s.data||{},m=d.management||{},smb=d.documents&&d.documents.smb;
  const TAX={USN:'usn',AUSN:'ausn',ESHN:'eshn',SRP:'srp'},ST={ACTIVE:'active',LIQUIDATING:'liquidating',LIQUIDATED:'liquidated',BANKRUPT:'bankrupt',REORGANIZING:'reorganizing'};
  return {inn,name:s.value,fullName:d.name&&d.name.full_with_opf,ogrn:d.ogrn,kpp:d.kpp,address:d.address&&d.address.value,headName:m.name||null,headPost:m.post||null,
    status:d.state&&ST[d.state.status]||null,okved:d.okved||null,okvedName:(d.okveds||[]).filter(o=>o.main).map(o=>o.name)[0]||null,
    msp:smb?({MICRO:'micro',SMALL:'small',MEDIUM:'medium'}[smb.category]||null):undefined,taxSystem:d.finance&&TAX[d.finance.tax_system]||null,employees:d.employee_count??null};
}

// ---------- паспорт ----------
const isoD=s=>{const m=/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/.exec(s||'');return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const cap1=s=>String(s||'').trim().toLowerCase().replace(/(^|[\s-])([а-яё])/g,(m,a,b)=>a+b.toUpperCase());
function findKey(o,k){if(!o||typeof o!=='object')return undefined;if(k in o)return o[k];for(const v of Object.values(o)){const r=findKey(v,k);if(r!==undefined)return r;}return undefined;}
export function parsePassport(j){
  const ent={};(findKey(j,'entities')||[]).forEach(x=>{if(x&&x.name)ent[x.name]=String(x.text||'').trim();});
  const num=(ent.number||'').replace(/\D/g,'');
  const g=(ent.gender||'').toLowerCase();
  const f={surname:cap1(ent.surname),name:cap1(ent.name),middle:cap1(ent.middle_name),
    sex:/^ж|^f/.test(g)?'f':/^м|^m/.test(g)?'m':'',birth:isoD(ent.birth_date),birthPlace:(ent.birth_place||'').trim(),
    series:num.length>=10?num.slice(0,4):'',number:num.length>=10?num.slice(4,10):num,issueDate:isoD(ent.issue_date),
    issuedBy:(ent.issued_by||'').trim(),code:(ent.subdivision||'').replace(/[^\d]/g,'').replace(/^(\d{3})(\d{3}).*/,'$1-$2'),
    citizenship:/^(rus|рф|росс)/i.test(ent.citizenship||'')||!ent.citizenship?'Россия':cap1(ent.citizenship)};
  Object.keys(f).forEach(k=>{if(!f[k]||f[k]==='-')delete f[k];});
  return f;
}
export function parseRegPage(j){
  const text=String(findKey(j,'fullText')||'');
  const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);
  let i=lines.findIndex(l=>/место\s+жительства|зарегистрирован/i.test(l));
  const addr=[];let regDate=null;
  if(i>=0){
    const after=lines.slice(i,i+12).join(' ');regDate=isoD(after);
    for(const l of lines.slice(i+1,i+10)){if(/^(район|р-н|пункт|улица|дом|корп|кв|г\.|гор|ул\.|д\.|пр|пер|наб|ш\.|обл|респ|край|пос|дер|с\.)/i.test(l)||/\d/.test(l)&&!/^\d{2}\.\d{2}\.\d{4}$/.test(l))addr.push(l.replace(/^(пункт|улица|дом|корп\.?|кв\.?)\s*/i,(m)=>m));if(addr.length>=5)break;}
  }
  const f={};if(addr.length)f.address=addr.join(', ').replace(/\s+/g,' ');if(regDate)f.regDate=regDate;
  return {fields:f,text:text.slice(0,2000)};
}
export function snilsOk(v){const n=String(v||'').replace(/\D/g,'');if(n.length!==11)return false;const d=n.slice(0,9),c=+n.slice(9);
  if(+d<=1001998)return true;let sum=0;for(let i=0;i<9;i++)sum+=(+d[i])*(9-i);
  let k=sum<100?sum:(sum===100||sum===101)?0:sum%101;if(k===100)k=0;return k===c;}
export function parseSnils(j){const text=String(findKey(j,'fullText')||'');
  const re=/(\d{3})[\s-]?(\d{3})[\s-]?(\d{3})[\s-]+(\d{2})/g;let m;
  while((m=re.exec(text))){const n=m[1]+m[2]+m[3]+m[4];if(snilsOk(n))return {snils:`${m[1]}-${m[2]}-${m[3]} ${m[4]}`};}
  return {};}
async function ocr(model,mime,content){
  const r=await req(YC_OCR,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Api-Key '+YC_KEY,...(YC_FOLDER?{'x-folder-id':YC_FOLDER}:{}),'x-data-logging-enabled':'false'},
    body:JSON.stringify({mimeType:mime,languageCodes:['ru'],model,content})},20000);
  if(!r.ok)throw Object.assign(new Error('ocr '+r.status),{status:r.status});
  return r.json();
}
function readBody(req,limit){return new Promise((ok,no)=>{let n=0;const b=[];req.on('data',c=>{n+=c.length;if(n>limit){no(Object.assign(new Error('too_big'),{code:'too_big'}));req.destroy();}else b.push(c);});req.on('end',()=>ok(Buffer.concat(b).toString('utf8')));req.on('error',no);});}

// ---------- самозанятые ----------
const npdCache=new Map();let npdLast=0,npdQueue=0;
export async function npd(inn){
  const day=new Date().toISOString().slice(0,10),key=inn+day,hit=npdCache.get(key);if(hit)return hit;
  if(npdQueue>=3)throw Object.assign(new Error('busy'),{code:'busy'});
  npdQueue++;
  try{const wait=npdLast+31000-Date.now();if(wait>0)await sleep(wait);npdLast=Date.now();
    const r=await req(NPD,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inn,requestDate:day})},15000);
    const j=await r.json().catch(()=>({}));
    if(!r.ok||typeof j.status!=='boolean')throw Object.assign(new Error('npd '+r.status),{code:j.code==='taxpayer.status.service.limited.error'?'busy':'upstream'});
    const v={inn,status:j.status,message:j.message||'',checkedAt:new Date().toISOString(),source:'ФНС, сервис «Проверить статус самозанятого»'};
    npdCache.set(key,v);return v;}
  finally{npdQueue--;}
}

const cache=new Map();
export async function company(inn){
  const hit=cache.get(inn);if(hit&&Date.now()-hit.at<TTL)return hit.v;
  const [e,m,d]=await Promise.allSettled([egrul(inn),rmsp(inn),dadata(inn)]);
  const E=e.status==='fulfilled'?e.value:null,M=m.status==='fulfilled'?m.value:null,D=d.status==='fulfilled'?d.value:null;
  if((E&&E.notFound||!E)&&(D&&D.notFound||!D)){
    if((E&&E.notFound)||(D&&D.notFound))return {notFound:true};
    throw new Error('no source');
  }
  const base=E&&!E.notFound?E:{},extra=D&&!D.notFound?D:{};
  const v={...extra,...Object.fromEntries(Object.entries(base).filter(([,x])=>x!=null))};
  // статус: ЕГРЮЛ видит только «прекращена»; ликвидацию в процессе знает DaData
  if(extra.status&&extra.status!=='active'&&v.status==='active')v.status=extra.status;
  v.msp=M!=null?M:(extra.msp===undefined?null:extra.msp);
  v.sources=[E&&!E.notFound&&(String(inn).length===12?'ЕГРИП (ФНС)':'ЕГРЮЛ (ФНС)'),M!=null&&'Реестр МСП (ФНС)',D&&!D.notFound&&'DaData'].filter(Boolean);
  v.checkedAt=new Date().toISOString();v.inn=inn;
  cache.set(inn,{at:Date.now(),v});
  return v;
}

function send(res,code,obj,origin){
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':code===200?'private, max-age=3600':'no-store',
    ...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})});
  res.end(JSON.stringify(obj));
}
const esign=createEsign({lookup:inn=>company(inn)});
export const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),o=req.headers.origin||'';
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':ORIGINS.includes(o)?o:'','Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Accept, Content-Type','Access-Control-Max-Age':'600'});return res.end();}
  if(u.pathname.replace(/\/$/,'')==='/passport'&&req.method==='POST'){
    if(!YC_KEY)return send(res,503,{error:'not_configured'},o);
    let body;try{body=JSON.parse(await readBody(req,18*1024*1024));}catch(err){return send(res,err.code==='too_big'?413:400,{error:err.code==='too_big'?'too_big':'bad_request'},o);}
    const kind=['reg','snils'].includes(body.kind)?body.kind:'main',mime=['JPEG','PNG','PDF'].includes(body.mime)?body.mime:'JPEG';
    if(!body.content||typeof body.content!=='string')return send(res,400,{error:'bad_request'},o);
    try{const j=await ocr(kind==='main'?'passport':'page',mime,body.content);
      if(kind==='snils'){const f=parseSnils(j);return f.snils?send(res,200,{fields:f},o):send(res,422,{error:'empty'},o);}
      if(kind==='reg'){const r=parseRegPage(j);return send(res,200,r,o);}
      const f=parsePassport(j);if(!f.surname&&!f.number)return send(res,422,{error:'empty'},o);
      return send(res,200,{fields:f},o);}
    catch(err){return send(res,err.status===400?422:502,{error:err.status===400?'bad_image':'upstream'},o);}
    finally{body=null;}
  }
  if(u.pathname.startsWith('/auth/')){
    // вход и подтверждение по КЭП: только с разрешённых сайтов, адрес сайта входит в подписываемую строку
    if(!ORIGINS.includes(o))return send(res,403,{error:'bad_origin'},o);
    const host=new URL(o).host,route=u.pathname.replace(/\/$/,'');
    try{
      if(route==='/auth/challenge'&&req.method==='GET')return send(res,200,esign.challenge(host,u.searchParams.get('purpose')),o);
      if(route==='/auth/status'&&req.method==='GET')return send(res,200,esign.config(),o);
      if(route==='/auth/esign'&&req.method==='POST'){let b;try{b=JSON.parse(await readBody(req,400*1024));}catch(e){return send(res,400,{error:'bad_request'},o);}
        const r=await esign.verify(b,host);return send(res,r.ok?200:(r.error==='bad_request'?400:422),r,o);}
      if(route==='/auth/check'&&req.method==='POST'){let b;try{b=JSON.parse(await readBody(req,8*1024));}catch(e){return send(res,400,{error:'bad_request'},o);}
        const p=esign.checkToken(b.token);return p?send(res,200,{ok:true,session:p},o):send(res,401,{ok:false},o);}
    }catch(err){return send(res,err.code==='busy'?429:500,{error:err.code||'server'},o);}
    return send(res,404,{error:'not_found'},o);
  }
  if(u.pathname.replace(/\/$/,'')==='/npd'&&req.method==='GET'){
    const inn=(u.searchParams.get('inn')||'').replace(/\D/g,'');
    if(inn.length!==12||!innOk(inn))return send(res,400,{error:'bad_inn'},o);
    try{return send(res,200,await npd(inn),o);}catch(err){return send(res,err.code==='busy'?429:502,{error:err.code||'upstream'},o);}
  }
  if(u.pathname.replace(/\/$/,'')!=='/company'||req.method!=='GET')return send(res,404,{error:'not_found'},o);
  const inn=(u.searchParams.get('inn')||'').replace(/\D/g,'');
  if(!innOk(inn))return send(res,400,{error:'bad_inn'},o);
  try{const v=await company(inn);if(v.notFound)return send(res,404,{error:'not_found'},o);send(res,200,v,o);}
  catch(err){send(res,502,{error:'upstream',detail:String(err.message||err)},o);}
});
if(import.meta.url===`file://${process.argv[1]}`)server.listen(PORT,()=>console.log('Штатка: сведения о компаниях на :'+PORT));
