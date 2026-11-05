// Штатка: вход и подтверждение компании по квалифицированной электронной подписи (КЭП).
//
// Как это устроено (так же, как на Госуслугах и электронных площадках):
//  1. Сайт просит у сервера «вызов»: случайную строку (nonce), привязанную к адресу сайта и цели.
//  2. Плагин «КриптоПро ЭЦП Browser plug-in» в браузере даёт выбрать сертификат и подписывает эту строку ключом с токена.
//     Закрытый ключ с токена никуда не уходит: к нам приходят подпись и открытый сертификат.
//  3. Сервер проверяет: (а) подпись верна — значит, ключом владеет тот, кто прислал сертификат; (б) сертификат действует;
//     (в) его выпустил аккредитованный удостоверяющий центр (цепочка до доверенного списка Минцифры); (г) он не отозван (CRL);
//     (д) ИНН и ОГРН из сертификата совпадают с ЕГРЮЛ, а владелец — руководитель из ЕГРЮЛ. Иначе нужна машиночитаемая доверенность (МЧД).
//
// Проверка подписи и цепочки идёт через OpenSSL: этот путь одинаков для любого алгоритма. Для ГОСТ Р 34.10-2012 на сервере
// нужен OpenSSL с модулем gost-engine (переменная ESIGN_OPENSSL_CONF). Без него настоящая КЭП не проверится — и сервис ответит отказом, а не «пропустит».
//
// Переменные окружения:
//   ESIGN_CA_BUNDLE   PEM-файл со всеми аккредитованными УЦ (корень Минцифры и промежуточные) — обязателен
//   ESIGN_OPENSSL     путь к openssl (по умолчанию openssl)
//   ESIGN_OPENSSL_CONF  конфиг OpenSSL с gost-engine
//   ESIGN_SECRET      секрет для подписи сессионного токена (если пусто — случайный на время работы)
//   ESIGN_CRL         try (по умолчанию) | require | off — как относиться к списку отозванных сертификатов
//   ESIGN_TTL_HOURS   срок жизни токена (12)
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

/* ---------- ASN.1 DER ---------- */
function node(buf,off){
  if(off+2>buf.length)throw new Error('der');
  const tag=buf[off];let len=buf[off+1],p=off+2;
  if(len&0x80){const n=len&0x7f;if(n<1||n>4||p+n>buf.length)throw new Error('der');len=0;for(let i=0;i<n;i++)len=len*256+buf[p++];}
  if(p+len>buf.length)throw new Error('der');
  return {tag,start:p,end:p+len,off};
}
const kids=(buf,n)=>{const o=[];let p=n.start;while(p<n.end){const k=node(buf,p);o.push(k);p=k.end;}return o;};
function oidOf(buf,n){const b=buf.subarray(n.start,n.end),out=[Math.floor(b[0]/40),b[0]%40];let v=0;for(let i=1;i<b.length;i++){v=v*128+(b[i]&0x7f);if(!(b[i]&0x80)){out.push(v);v=0;}}return out.join('.');}
function strOf(buf,n){const b=buf.subarray(n.start,n.end);
  if(n.tag===0x1e){let s='';for(let i=0;i+1<b.length;i+=2)s+=String.fromCharCode(b.readUInt16BE(i));return s;}
  return n.tag===0x14?b.toString('latin1'):b.toString('utf8');}
function timeOf(buf,n){
  const s=buf.subarray(n.start,n.end).toString('ascii');let m;
  if(n.tag===0x17){m=/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/.exec(s);if(!m)throw new Error('der');const y=+m[1]+(+m[1]>=50?1900:2000);return new Date(Date.UTC(y,+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)));}
  m=/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/.exec(s);if(!m)throw new Error('der');return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)));
}
const nameOf=(buf,n)=>{const out=[];for(const rdn of kids(buf,n))for(const atv of kids(buf,rdn)){const [o,v]=kids(buf,atv);out.push({oid:oidOf(buf,o),value:strOf(buf,v)});}return out;};
function uris(buf,start,end,out,depth=0){ // все URI (тег 0x86) внутри расширения; вглубь идём только по составным тегам
  let p=start;while(p<end&&depth<8){const n=node(buf,p);
    if(n.tag===0x86)out.push(buf.subarray(n.start,n.end).toString('ascii'));
    else if(n.tag&0x20)uris(buf,n.start,n.end,out,depth+1);
    p=n.end;}
  return out;
}

const OID={cn:'2.5.4.3',sn:'2.5.4.4',g:'2.5.4.42',o:'2.5.4.10',t:'2.5.4.12',inn:'1.2.643.3.131.1.1',innle:'1.2.643.100.4',ogrn:'1.2.643.100.1',ogrnip:'1.2.643.100.5',snils:'1.2.643.100.3',cdp:'2.5.29.31',ku:'2.5.29.15'};

/* Разбор сертификата X.509 без OpenSSL: работает с любым алгоритмом подписи, в том числе с ГОСТ. */
export function parseCert(der){
  const buf=Buffer.from(der);
  const cert=node(buf,0);const [tbs]=kids(buf,cert);const k=kids(buf,tbs);
  let i=k[0].tag===0xa0?1:0;
  const serial=buf.subarray(k[i].start,k[i].end).toString('hex');i+=2;       // серийный номер, алгоритм подписи
  const issuer=nameOf(buf,k[i++]);const v=kids(buf,k[i++]);
  const notBefore=timeOf(buf,v[0]),notAfter=timeOf(buf,v[1]);
  const subject=nameOf(buf,k[i++]);
  let cdp=[];const ext=k.find(x=>x.tag===0xa3);
  if(ext){const seq=kids(buf,ext)[0];
    for(const e of kids(buf,seq)){const parts=kids(buf,e);if(oidOf(buf,parts[0])===OID.cdp){const val=parts[parts.length-1];cdp=uris(buf,val.start,val.end,[]);}}}
  const get=(list,o)=>((list.find(x=>x.oid===o))||{}).value||'';
  const digits=s=>String(s||'').replace(/\D/g,'');
  let inn=digits(get(subject,OID.inn));const innle=digits(get(subject,OID.innle));
  if(inn.length===12&&inn.startsWith('00'))inn=inn.slice(2);                 // старые сертификаты юрлиц: ИНН из 10 цифр с двумя нулями
  const ogrn=digits(get(subject,OID.ogrn)),ogrnip=digits(get(subject,OID.ogrnip));
  const orgInn=innle||(inn.length===10?inn:'');
  const kind=ogrnip?'ip':(orgInn||ogrn)?'org':'person';
  const personInn=inn.length===12?inn:'';
  const fio=[get(subject,OID.sn),get(subject,OID.g)].join(' ').trim()||get(subject,OID.cn);
  return {serial,notBefore,notAfter,cdp,kind,
    orgInn:kind==='ip'?personInn:orgInn,personInn,ogrn:kind==='ip'?ogrnip:ogrn,snils:digits(get(subject,OID.snils)),
    fio,title:get(subject,OID.t),orgName:get(subject,OID.o)||(kind==='org'?get(subject,OID.cn):''),
    issuer:get(issuer,OID.cn)||get(issuer,OID.o),issuerDn:issuer.map(x=>x.oid+'='+x.value).join(','),
    thumbprint:crypto.createHash('sha1').update(buf).digest('hex').toUpperCase()};
}

/* ---------- вспомогательное ---------- */
const pem=(der,label)=>`-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').replace(/.{1,64}/g,'$&\n')}-----END ${label}-----\n`;
const run=(bin,args,env)=>new Promise(res=>execFile(bin,args,{timeout:20000,maxBuffer:1<<20,env:{...process.env,...(env||{})}},(err,so,se)=>res({ok:!err,out:String(so)+String(se)})));
const words=s=>String(s||'').toLowerCase().replace(/ё/g,'е').split(/[^а-яa-z-]+/).filter(w=>w&&!['ип','индивидуальный','предприниматель'].includes(w));
export const sameFio=(a,b)=>{const x=words(a),y=words(b);return x.length>=2&&x.length===y.length&&x.every(w=>y.includes(w));};
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export function createEsign({lookup,env=process.env}={}){
  const cfg={openssl:env.ESIGN_OPENSSL||'openssl',conf:env.ESIGN_OPENSSL_CONF||'',ca:env.ESIGN_CA_BUNDLE||'',crl:env.ESIGN_CRL||'try',
    ttl:(+env.ESIGN_TTL_HOURS||12)*3600e3,secret:env.ESIGN_SECRET||crypto.randomBytes(32).toString('hex')};
  const osslEnv=cfg.conf?{OPENSSL_CONF:cfg.conf}:{};
  const chal=new Map(),crls=new Map();

  function challenge(host,purpose){
    const now=Date.now();for(const [k,v] of chal)if(v.exp<now)chal.delete(k);
    if(chal.size>5000)throw Object.assign(new Error('busy'),{code:'busy'});
    const nonce=crypto.randomBytes(24).toString('hex'),issued=new Date(now).toISOString();
    const p=purpose==='register'?'register':'login';
    const data=`SHTATKA-AUTH\npurpose=${p}\nnonce=${nonce}\nhost=${host}\nissued=${issued}`;
    chal.set(nonce,{data,exp:now+5*60e3,host,purpose:p});
    return {nonce,data,purpose:p,expiresAt:new Date(now+5*60e3).toISOString()};
  }
  async function cmsVerify(sig,data,cert){
    const dir=await mkdtemp(path.join(tmpdir(),'es-'));
    try{await Promise.all([writeFile(dir+'/s.der',sig),writeFile(dir+'/d.bin',data),writeFile(dir+'/c.pem',pem(cert,'CERTIFICATE'))]);
      const r=await run(cfg.openssl,['cms','-verify','-inform','DER','-in',dir+'/s.der','-content',dir+'/d.bin','-binary','-noverify','-nointern','-certfile',dir+'/c.pem','-out','/dev/null'],osslEnv);
      return r.ok;}
    finally{await rm(dir,{recursive:true,force:true});}
  }
  async function fetchCrl(url){
    const hit=crls.get(url);if(hit&&Date.now()-hit.at<30*60e3)return hit.pem;
    try{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),10000);
      const r=await fetch(url,{signal:ac.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; Shtatka/1.0)'}});clearTimeout(t);
      if(!r.ok)return null;const b=Buffer.from(await r.arrayBuffer());if(b.length>10e6||b.length<20)return null;
      const p=b.subarray(0,10).toString('ascii').includes('-----')?b.toString('ascii'):pem(b,'X509 CRL');crls.set(url,{at:Date.now(),pem:p});return p;}
    catch(e){return null;}
  }
  /* цепочка до доверенных УЦ: 'ok' | 'untrusted' | 'no_trust_store'; потом отзыв: 'ok' | 'revoked' | 'unknown' */
  async function chain(cert,cdp){
    if(!cfg.ca)return {chain:'no_trust_store',revocation:'unknown'};
    const dir=await mkdtemp(path.join(tmpdir(),'es-'));
    try{await writeFile(dir+'/c.pem',pem(cert,'CERTIFICATE'));
      const base=['verify','-CAfile',cfg.ca,'-no-CApath','-partial_chain','-purpose','any'];
      const r=await run(cfg.openssl,[...base,dir+'/c.pem'],osslEnv);
      if(!r.ok)return {chain:'untrusted',revocation:'unknown'};
      if(cfg.crl==='off')return {chain:'ok',revocation:'unknown'};
      // CRL берём только у сертификата, который уже прошёл цепочку: адрес в нём задал аккредитованный УЦ, а не злоумышленник
      const lists=(await Promise.all(cdp.filter(u=>/^http:\/\//i.test(u)).slice(0,3).map(fetchCrl))).filter(Boolean);
      if(!lists.length)return {chain:'ok',revocation:'unknown'};
      await writeFile(dir+'/l.pem',lists.join('\n'));
      const r2=await run(cfg.openssl,[...base,'-crl_check','-CRLfile',dir+'/l.pem',dir+'/c.pem'],osslEnv);
      if(r2.ok)return {chain:'ok',revocation:'ok'};
      return {chain:'ok',revocation:/revoked/i.test(r2.out)?'revoked':'unknown'};}
    finally{await rm(dir,{recursive:true,force:true});}
  }
  const sign=p=>{const body=b64u(JSON.stringify(p));return body+'.'+b64u(crypto.createHmac('sha256',cfg.secret).update(body).digest());};
  function checkToken(t){
    const [body,mac]=String(t||'').split('.');if(!body||!mac)return null;
    const want=Buffer.from(b64u(crypto.createHmac('sha256',cfg.secret).update(body).digest())),got=Buffer.from(mac);
    if(want.length!==got.length||!crypto.timingSafeEqual(want,got))return null;
    try{const p=JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));return p.exp>Date.now()?p:null;}catch(e){return null;}
  }

  /* body: {nonce, signature (base64 CMS), cert (base64 DER), inn?} */
  async function verify(body,host){
    const fail=(error,extra)=>({ok:false,error,...extra});
    if(!body||typeof body.nonce!=='string'||typeof body.signature!=='string'||typeof body.cert!=='string')return fail('bad_request');
    const c=chal.get(body.nonce);
    if(!c||c.exp<Date.now())return fail('challenge_expired');
    chal.delete(body.nonce);                                           // вызов одноразовый
    if(c.host!==host)return fail('bad_host');
    let der,sig,id;
    try{der=Buffer.from(body.cert.replace(/-----[^-]+-----|\s/g,''),'base64');sig=Buffer.from(body.signature.replace(/-----[^-]+-----|\s/g,''),'base64');id=parseCert(der);}
    catch(e){return fail('cert_parse');}
    const now=new Date();
    if(now<id.notBefore)return fail('cert_not_yet',{identity:publicId(id)});
    if(now>id.notAfter)return fail('cert_expired',{identity:publicId(id)});
    if(!(await cmsVerify(sig,Buffer.from(c.data,'utf8'),der)))return fail('bad_signature',{identity:publicId(id),hint:cfg.conf?'':'Для ГОСТ-подписи на сервере нужен OpenSSL с gost-engine (ESIGN_OPENSSL_CONF).'});
    const tr=await chain(der,id.cdp);
    if(tr.chain==='no_trust_store')return fail('no_trust_store',{identity:publicId(id)});
    if(tr.chain!=='ok')return fail('untrusted_issuer',{identity:publicId(id)});
    if(tr.revocation==='revoked')return fail('revoked',{identity:publicId(id),trust:{signature:'ok',...tr}});
    if(tr.revocation==='unknown'&&cfg.crl==='require')return fail('crl_unavailable',{identity:publicId(id),trust:{signature:'ok',...tr}});
    const out={ok:true,purpose:c.purpose,identity:publicId(id),trust:{signature:'ok',...tr},confirmed:false,needsMchd:false};
    // сверка с ЕГРЮЛ/ЕГРИП
    if(id.orgInn&&lookup){
      let co=null;try{co=await lookup(id.orgInn);}catch(e){out.registryError=true;}
      if(co&&!co.notFound){
        const active=!co.status||co.status==='active';
        out.company={name:co.name,inn:co.inn,ogrn:co.ogrn||null,status:co.status||'active',headName:co.headName||null};
        out.match={ogrn:!id.ogrn||!co.ogrn?null:id.ogrn===co.ogrn,active,head:co.headName?sameFio(id.fio,co.headName):null};
        if(body.inn&&String(body.inn)!==id.orgInn){out.ok=false;out.error='inn_mismatch';}
        else if(!active){out.ok=false;out.error='company_inactive';}
        else if(out.match.ogrn===false){out.ok=false;out.error='ogrn_mismatch';}
        else out.confirmed=out.match.head===true||id.kind==='ip';
      }else if(co&&co.notFound){out.ok=false;out.error='company_not_found';}
    }
    if(out.ok&&c.purpose==='register'&&!out.confirmed)out.needsMchd=true;
    if(out.ok&&c.purpose==='register'&&body.inn&&!id.orgInn)out.needsMchd=true;   // обычная подпись физлица: полномочия нужно подтвердить доверенностью
    if(out.ok)out.token=sign({v:1,kind:id.kind,inn:id.orgInn||null,pinn:id.personInn||null,ogrn:id.ogrn||null,fio:id.fio,tp:id.thumbprint,confirmed:out.confirmed,exp:Date.now()+cfg.ttl});
    return out;
  }
  const publicId=id=>({kind:id.kind,inn:id.orgInn||null,personInn:id.personInn||null,ogrn:id.ogrn||null,fio:id.fio,title:id.title||null,orgName:id.orgName||null,issuer:id.issuer,notAfter:id.notAfter.toISOString(),thumbprint:id.thumbprint,snilsEnding:id.snils?'***'+id.snils.slice(-2):null});
  return {challenge,verify,checkToken,config:()=>({trustStore:!!cfg.ca,gostConf:!!cfg.conf,crl:cfg.crl})};
}
