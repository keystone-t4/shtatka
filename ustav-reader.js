/* Чтение устава ООО из PDF прямо в браузере (pdf.js от Mozilla, лицензия Apache-2.0): без сервера, без платы, файл никуда не уходит.
   Работает с PDF, в которых есть текст. Скан (картинка) без распознавания не читается: тогда просим ввести данные вручную.
   Достаём только надёжные пункты по шаблонным формулировкам; остальное остаётся за человеком. */
(function(){
let lib=null;
function load(){if(lib)return lib;lib=new Promise((ok,no)=>{if(window.pdfjsLib)return ok(window.pdfjsLib);
  const s=document.createElement('script');s.src='vendor/pdfjs/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=()=>no(new Error('lib'));document.head.appendChild(s);});return lib;}
async function text(file){
  const L=await load(),buf=await file.arrayBuffer(),doc=await L.getDocument({data:buf}).promise;let out='';
  for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i),c=await pg.getTextContent();out+=c.items.map(x=>x.str).join(' ')+' \n';}
  return out.replace(/\s+/g,' ').trim();
}
const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g,'').trim();
const NUM={один:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,десять:10};
function parse(t){
  const f={},m=(re,i)=>{const r=re.exec(t);return r?clean(r[i||1]):'';};
  f.fullName=m(/Полное фирменное наименование[^:]{0,60}:\s*(.{5,200}?)(?=\s+(?:Сокращ[её]нное|на английском|\d+\.\d+\.|Место нахождения))/i);
  f.shortName=m(/Сокращ[её]нное фирменное наименование[^:]{0,60}:\s*(.{3,120}?)(?=\s+(?:Полное|на английском|\d+\.\d+\.|Место нахождения|Общество имеет))/i);
  if(!f.fullName){const x=/Общество с ограниченной ответственностью\s*[«"“]([^»"”]{2,80})[»"”]/i.exec(t);if(x)f.fullName='Общество с ограниченной ответственностью «'+clean(x[1])+'»';}
  f.address=m(/Место нахождения (?:Общества|общества)[^:]{0,60}:\s*(.{5,200}?)(?=\s+\d+\.\d+\.|\s+Общество\s)/i);
  f.capital=m(/размер[^.]{0,80}?уставн[а-яё]+ капитал[а-яё]*[^.]{0,80}?составляет\s+(\d[\d\s]*(?:\([^)]{3,80}\))?\s*руб[а-яё]*)/i)||m(/уставн[а-яё]+ капитал[а-яё]*[^.]{0,60}?(\d[\d\s]{2,}\s*(?:\([^)]{3,80}\)\s*)?руб[а-яё]*)/i);
  const body=/(?:Единоличн[а-яё]+ исполнительн[а-яё]+ орган[а-яё]*|исполнительн[а-яё]+ орган[а-яё]*)[^.]{0,200}?(?:—|-|является|:)\s*(Генеральный директор|Директор|Президент|Управляющий|Управляющая организация)/i.exec(t);
  f.head=body?body[1]:(/Генеральный директор/i.test(t)?'Генеральный директор':/\bДиректор\b/.test(t)?'Директор':'');
  const term=/(?:избирается|назначается)[^.]{0,160}?на срок\s+(\d+|[а-яё]+)\s*(?:\([^)]*\)\s*)?(год[а-яё]*|лет|месяц[а-яё]*)/i.exec(t);
  if(term){const n=NUM[term[1].toLowerCase()]||+term[1];f.term=(n||term[1])+' '+(/год|лет/i.test(term[2])?(n===1?'год':n>=2&&n<=4?'года':'лет'):'мес.');}
  else if(/на неопределенный срок|без ограничения срока|бессрочно/i.test(t)&&f.head)f.term='срок не ограничен';
  f.noPoa=/действует без доверенности/i.test(t);
  f.bigDeal=/крупн[а-яё]+ сделк/i.test(t);
  f.sole=/единственн[а-яё]+ участник/i.test(t)?'единственный участник':/общее собрание участников/i.test(t)?'общее собрание участников':'';
  return f;
}
const norm=s=>String(s||'').toLowerCase().replace(/[«»"“”'.,]/g,'').replace(/общество с ограниченной ответственностью|ооо|индивидуальный предприниматель|ип/g,'').replace(/\s+/g,' ').trim();
/* сверка с тем, что компания указала у нас; ctx={name,head,post} */
function check(f,ctx){
  const w=[];
  if(f.fullName&&ctx.name&&norm(f.fullName).indexOf(norm(ctx.name))<0&&norm(ctx.name).indexOf(norm(f.fullName))<0)w.push('Название в уставе («'+(f.shortName||f.fullName)+'») отличается от названия при регистрации («'+ctx.name+'»). Договоры и приказы подписываем так, как в уставе.');
  if(f.head&&ctx.post&&norm(f.head)!==norm(ctx.post))w.push('В уставе руководитель называется «'+f.head+'», а в анкете компании указано «'+ctx.post+'». В документах будет название из устава.');
  if(f.head&&!f.noPoa)w.push('В уставе не нашли, что руководитель действует без доверенности. Проверьте пункт о полномочиях.');
  return w;
}
async function read(file){
  if(!file||!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf')return {ok:false,reason:'not_pdf'};
  let t;try{t=await text(file);}catch(e){return {ok:false,reason:e.message==='lib'?'lib':'broken'};}
  if(t.length<400)return {ok:false,reason:'scan'};
  const f=parse(t);return {ok:true,fields:f,chars:t.length,found:['fullName','address','capital','head','term'].filter(k=>f[k]).length};
}
window.SHTATKA_USTAV={read,parse,check,text};
})();
