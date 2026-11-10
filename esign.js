/* Штатка: вход и подтверждение компании электронной подписью (КЭП).
   Закрытый ключ остаётся на токене: браузер через плагин «КриптоПро ЭЦП Browser plug-in» подписывает строку-вызов от сервера,
   сервер (server/esign.mjs) проверяет подпись, сертификат, удостоверяющий центр и сверяет ИНН и ОГРН с ЕГРЮЛ.
   Работает на компьютере с установленным КриптоПро CSP, плагином и расширением браузера. На телефоне подпись с токеном недоступна. */
(function(){
const cfg=window.SHTATKA_CONFIG||{};
const baseUrl=()=>cfg.authUrl||(cfg.companyUrl?cfg.companyUrl.replace(/\/company\/?$/,'/auth'):(cfg.apiUrl?cfg.apiUrl.replace(/\/$/,'')+'/auth':''));
const PLUGIN=cfg.cadespluginUrl||'https://www.cryptopro.ru/sites/default/files/products/cades/cadesplugin_api.js';
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const b64=s=>btoa(unescape(encodeURIComponent(s)));
const withTimeout=(p,ms,code)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error(code)),ms))]);

const MSG={
 no_server:'Сервер проверки подписи пока не подключён. Подтвердите компанию договором на бумаге или попросите нас подключить сервер.',
 no_plugin:'Не нашли плагин для электронной подписи. Установите «КриптоПро ЭЦП Browser plug-in» и расширение для вашего браузера, затем перезапустите браузер.',
 no_certs:'В браузере нет подходящих сертификатов. Вставьте токен с подписью и попробуйте снова.',
 cancelled:'Вы отменили подпись.',
 mobile:'Подпись с токеном работает на компьютере. С телефона подтвердите компанию договором на бумаге или откройте сайт на компьютере.',
 challenge_expired:'Время на подпись вышло. Нажмите ещё раз.',
 bad_signature:'Подпись не прошла проверку. Попробуйте ещё раз или выберите другой сертификат.',
 bad_host:'Подпись выдана для другого сайта. Откройте Штатку по обычной ссылке и повторите.',
 bad_origin:'Этот адрес сайта не разрешён на сервере проверки.',
 cert_expired:'Срок действия сертификата истёк. Продлите подпись в удостоверяющем центре.',
 cert_not_yet:'Срок действия сертификата ещё не начался. Проверьте дату на компьютере.',
 cert_parse:'Не удалось прочитать сертификат.',
 untrusted_issuer:'Сертификат выдан центром, которого нет в списке аккредитованных. Нужна квалифицированная подпись (КЭП).',
 revoked:'Сертификат отозван удостоверяющим центром. Получите новый.',
 crl_unavailable:'Не удалось проверить, не отозван ли сертификат. Повторите позже.',
 inn_mismatch:'ИНН в сертификате не совпадает с ИНН компании из регистрации.',
 ogrn_mismatch:'ОГРН в сертификате не совпадает с данными ЕГРЮЛ.',
 company_inactive:'По данным ЕГРЮЛ компания не действует.',
 company_not_found:'Компании из сертификата нет в ЕГРЮЛ.',
 no_trust_store:'Сервер проверки ещё не настроен: нет списка аккредитованных центров. Это не ваша ошибка — сообщите нам.',
 busy:'Сервер занят. Повторите через минуту.',
 offline:'Нет связи с сервером проверки. Проверьте интернет и повторите.'
};
const say=c=>MSG[c]||'Не удалось проверить подпись ('+c+').';

async function plugin(){
  if(!window.cadesplugin){
    await withTimeout(new Promise((ok,no)=>{const s=document.createElement('script');s.src=PLUGIN;s.onload=ok;s.onerror=()=>no(new Error('no_plugin'));document.head.appendChild(s);}),15000,'no_plugin');
  }
  try{await withTimeout(Promise.resolve(window.cadesplugin),8000,'no_plugin');}catch(e){throw new Error('no_plugin');}
  if(!window.cadesplugin||!window.cadesplugin.async_spawn)throw new Error('no_plugin');
  return window.cadesplugin;
}
/* сертификаты пользователя с закрытым ключом и действующим сроком */
async function certs(P){
  return P.async_spawn(function*(){
    const store=yield P.CreateObjectAsync('CAdESCOM.Store');
    yield store.Open(P.CAPICOM_CURRENT_USER_STORE,P.CAPICOM_MY_STORE,P.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);
    const list=yield store.Certificates,n=yield list.Count,out=[];
    for(let i=1;i<=n;i++){
      const c=yield list.Item(i),has=yield c.HasPrivateKey(),to=yield c.ValidToDate,from=yield c.ValidFromDate;
      const now=Date.now(),dTo=new Date(to).getTime(),dFrom=new Date(from).getTime();
      if(!has||(dTo&&dTo<now)||(dFrom&&dFrom>now))continue;
      out.push({cert:c,subject:yield c.SubjectName,issuer:yield c.IssuerName,thumb:yield c.Thumbprint,to:new Date(to)});
    }
    yield store.Close();return out;
  });
}
const part=(dn,k)=>{const m=new RegExp('(?:^|,\\s*)'+k+'=("(?:[^"]|"")*"|[^,]*)').exec(dn||'');return m?m[1].replace(/^"|"$/g,'').replace(/""/g,'"'):'';};
const title=c=>[part(c.subject,'CN')||part(c.subject,'SN')+' '+part(c.subject,'G'),part(c.subject,'O')&&part(c.subject,'O')!==part(c.subject,'CN')?part(c.subject,'O'):''].filter(Boolean).join(' · ');
function pick(list){
  if(list.length===1)return Promise.resolve(list[0]);
  return new Promise((ok,no)=>{
    const dl=document.createElement('dialog');dl.className='kep-dlg';
    dl.innerHTML=`<form method="dialog"><h2>Выберите подпись</h2><p class="small">Сертификаты на вашем токене. Для подписи плагин попросит ПИН-код.</p>
     <div class="kep-list">${list.map((c,i)=>`<label class="kep-it"><input type="radio" name="kc" value="${i}"${i===0?' checked':''}><span><b>${esc(title(c))}</b><small>выдан: ${esc(part(c.issuer,'CN')||part(c.issuer,'O'))} · до ${c.to.toLocaleDateString('ru-RU')}</small></span></label>`).join('')}</div>
     <div class="kep-f"><button type="button" class="btn ghost sm" data-c>Отмена</button><button type="submit" class="btn sm">Подписать</button></div></form>`;
    document.body.appendChild(dl);dl.showModal();
    dl.querySelector('[data-c]').onclick=()=>{dl.close();dl.remove();no(new Error('cancelled'));};
    dl.addEventListener('cancel',()=>{dl.remove();no(new Error('cancelled'));});
    dl.querySelector('form').onsubmit=e=>{e.preventDefault();const i=+dl.querySelector('input:checked').value;dl.close();dl.remove();ok(list[i]);};
  });
}
function signData(P,c,text){
  return P.async_spawn(function*(){
    const signer=yield P.CreateObjectAsync('CAdESCOM.CPSigner');
    yield signer.propset_Certificate(c.cert);yield signer.propset_CheckCertificate(true);
    const sd=yield P.CreateObjectAsync('CAdESCOM.CadesSignedData');
    yield sd.propset_ContentEncoding(P.CADESCOM_BASE64_TO_BINARY);   // подписываем байты строки, а не UTF-16: иначе подпись не сойдётся
    yield sd.propset_Content(b64(text));
    const signature=yield sd.SignCades(signer,P.CADESCOM_CADES_BES,true);
    const cert=yield c.cert.Export(P.CAPICOM_ENCODE_BASE64);
    return {signature:String(signature).replace(/\s/g,''),cert:String(cert).replace(/-----[^-]+-----|\s/g,'')};
  });
}
async function call(path,opt){
  try{const r=await fetch(baseUrl()+path,opt);const j=await r.json().catch(()=>({}));return {status:r.status,body:j};}
  catch(e){return {status:0,body:{error:'offline'}};}
}
/* run('login'|'register',{inn}) → {ok, ...ответ сервера} | {ok:false, error, message} */
async function run(purpose,opt){
  opt=opt||{};
  if(!baseUrl())return {ok:false,error:'no_server',message:say('no_server')};
  if(matchMedia&&matchMedia('(pointer:coarse)').matches&&!window.cadesplugin)return {ok:false,error:'mobile',message:say('mobile')};
  let P;try{await plugin();P=window.cadesplugin;}catch(e){console.warn('esign plugin',e);return {ok:false,error:'no_plugin',message:say('no_plugin')};}
  let list;try{list=await certs(P);}catch(e){console.warn('esign certs',e);return {ok:false,error:'no_plugin',message:say('no_plugin')};}
  if(!list.length)return {ok:false,error:'no_certs',message:say('no_certs')};
  let c;try{c=await pick(list);}catch(e){return {ok:false,error:'cancelled',message:say('cancelled')};}
  const ch=await call('/challenge?purpose='+encodeURIComponent(purpose));
  if(ch.status!==200)return {ok:false,error:ch.body.error||'offline',message:say(ch.body.error||'offline')};
  let sg;try{sg=await signData(P,c,ch.body.data);}catch(e){return {ok:false,error:'cancelled',message:say('cancelled')};}
  const r=await call('/esign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:ch.body.nonce,signature:sg.signature,cert:sg.cert,inn:opt.inn||undefined})});
  const b=r.body;if(!b.ok)return Object.assign({ok:false,message:(b.hint&&b.error==='bad_signature'?say(b.error)+' '+b.hint:say(b.error))},b);
  return b;
}
window.SHTATKA_ESIGN={run,say,MSG,available:()=>!!baseUrl(),part,title};
})();
