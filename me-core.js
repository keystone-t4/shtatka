/* Личный кабинет сотрудника: упаковка и распаковка данных.
   Данные сотрудника шифруются кодом доступа (PBKDF2 + AES-GCM) и кладутся в ссылку. Код работодатель отправляет другим каналом
   (СМС, почта, мессенджер). Без кода ссылка бесполезна. Это работает без сервера; с сервером ссылку заменит токен, а данные будут обновляться сами. */
(function(){
const enc=new TextEncoder(),dec=new TextDecoder();
const ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(x=>ABC[x%32]).join('');
const showCode=c=>c.slice(0,4)+'-'+c.slice(4);
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const u8=b=>{const s=String(b).replace(/-/g,'+').replace(/_/g,'/');const bin=atob(s+'='.repeat((4-s.length%4)%4)),o=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)o[i]=bin.charCodeAt(i);return o;};
const b64u=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
async function pipe(data,Ctor,fmt){const s=new Blob([data]).stream().pipeThrough(new Ctor(fmt));return new Uint8Array(await new Response(s).arrayBuffer());}
async function key(code,salt,use){const m=await crypto.subtle.importKey('raw',enc.encode(normCode(code)),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,[use]);}
/* → строка для ссылки после m= */
async function seal(obj,code){
  let raw=enc.encode(JSON.stringify(obj)),z=0;
  if(typeof CompressionStream!=='undefined'){try{raw=await pipe(raw,CompressionStream,'deflate-raw');z=1;}catch(e){}}
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(code,salt,'encrypt'),raw));
  const out=new Uint8Array(2+16+12+ct.length);out[0]=1;out[1]=z;out.set(salt,2);out.set(iv,18);out.set(ct,30);return b64u(out);
}
async function open(str,code){
  const a=u8(str);if(a[0]!==1)throw new Error('format');
  let raw;try{raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:a.slice(18,30)},await key(code,a.slice(2,18),'decrypt'),a.slice(30)));}catch(e){throw new Error('code');}
  if(a[1]===1)raw=await pipe(raw,DecompressionStream,'deflate-raw');
  return JSON.parse(dec.decode(raw));
}
const SEC=['td','gph','rent','self','order','mat','pd'];
/* то, что увидит сотрудник. Паспортных данных, окладов других людей и служебных заметок здесь нет */
function build(e){
  const R=window.SHTATKA_HR,C=window.SHTATKA_SCH,d=R.d,H=window.SHTATKA_HOME,ses=H.session()||{};
  const t0=d.today(),v=R.vacation(e);
  const p={v:1,id:Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10),issued:t0,exp:d.addDays(t0,7),expAt:Date.now()+7*24*3600*1000,co:ses.company||'',
    emp:{id:e.id,fio:e.fio,position:e.position||'',start:e.start,contract:e.contract,contractNo:e.contractNo||'',end:e.contractEnd||''},
    vac:{acc:v.acc,used:v.used,left:v.left,canTake:v.canTake},sch:null,foreign:null,docs:[]};
  if(C&&C.inSchedule(e)){const T=C.types(),days={};for(let i=0;i<28;i++){const ds=d.addDays(t0,i),x=C.cell(e,ds);if(x)days[ds]=R.onSick(e,ds)?'sick':x;}
    p.sch={types:T.map(t=>({id:t.id,name:t.name,from:t.from,to:t.to})),days};}
  R.docsFor(e).filter(x=>SEC.includes(x[0])).forEach(x=>p.docs.push({key:x[0],title:x[1],html:R.docHtml(e,x[0])}));
  return p;
}
window.SHTATKA_ME={newCode,showCode,normCode,seal,open,build};
})();
