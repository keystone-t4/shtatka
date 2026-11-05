/* Штатка: распознавание паспорта РФ. Фото или PDF уменьшается в браузере и уходит на свой сервер (server/company-proxy.mjs → /passport),
   сервер передаёт его в Yandex Vision OCR (модель passport — главный разворот; page — страница с пропиской) и возвращает поля.
   Изображение нигде не сохраняется. Без сервера — демо: поля заполняются примером, и интерфейс прямо говорит, что это пример. */
(function(){
const cfg=window.SHTATKA_CONFIG||{};
const url=()=>cfg.passportUrl||(cfg.companyUrl?cfg.companyUrl.replace(/\/company\/?$/,'/passport'):'')||(cfg.apiUrl?cfg.apiUrl.replace(/\/$/,'')+'/passport':'');
const MAX=12*1024*1024;
const readURL=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(f);});
function loadImg(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('decode'));i.src=src;});}
/* Готовит файл: картинку — до 2400 px по длинной стороне, JPEG 90 %; PDF — как есть. */
async function prepare(file){
  if(!file)throw new Error('nofile');
  const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');
  if(file.size>MAX*2)return {error:'Файл больше 24 МБ. Сфотографируйте страницу ещё раз или сожмите PDF.'};
  const data=await readURL(file);
  if(pdf){if(file.size>MAX)return {error:'PDF больше 12 МБ: сохраните одну страницу.'};return {mime:'PDF',content:data.split(',')[1],preview:null,pdf:true,name:file.name,blob:file};}
  let img;try{img=await loadImg(data);}catch(e){return {error:/heic|heif/i.test(file.type+file.name)?'Формат HEIC браузер не открывает: выберите фото из галереи на телефоне или сохраните как JPG.':'Не удалось открыть изображение. Подойдут JPG, PNG или PDF.'};}
  const k=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const out=c.toDataURL('image/jpeg',0.9);
  const small=document.createElement('canvas'),s=Math.min(1,320/Math.max(c.width,c.height));small.width=Math.round(c.width*s);small.height=Math.round(c.height*s);
  small.getContext('2d').drawImage(c,0,0,small.width,small.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.9));
  return {mime:'JPEG',content:out.split(',')[1],preview:small.toDataURL('image/jpeg',0.8),w:c.width,h:c.height,name:(file.name||'scan').replace(/\.[^.]+$/,'')+'.jpg',blob};
}
function snilsOk(v){const n=String(v||'').replace(/\D/g,'');if(n.length!==11)return false;const d=n.slice(0,9),c=+n.slice(9);
  if(+d<=1001998)return true;let sum=0;for(let i=0;i<9;i++)sum+=(+d[i])*(9-i);
  let k=sum<100?sum:(sum===100||sum===101)?0:sum%101;if(k===100)k=0;return k===c;}
const DEMO={
  snils:{snils:'112-233-445 95'},
  main:{surname:'Иванов',name:'Иван',middle:'Иванович',sex:'m',birth:'1990-03-15',birthPlace:'гор. Санкт-Петербург',series:'4012',number:'345678',issueDate:'2015-04-02',issuedBy:'ГУ МВД России по г. Санкт-Петербургу и Ленинградской области',code:'780-012',citizenship:'Россия'},
  reg:{address:'г. Санкт-Петербург, ул. Примерная, д. 1, кв. 1',regDate:'2015-05-20'}
};
/* recognize: {ok:true, fields, demo?} | {ok:false, reason} */
async function recognize(kind,prep){
  const u=url();
  if(!u){await new Promise(r=>setTimeout(r,700));return {ok:true,demo:true,fields:Object.assign({},DEMO[kind])};}
  try{
    const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({kind,mime:prep.mime,content:prep.content})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return {ok:false,reason:j.error||('http '+r.status)};
    return {ok:true,fields:j.fields||{},text:j.text||''};
  }catch(e){return {ok:false,reason:'offline'};}
}
const REASON={offline:'Сервер распознавания не ответил. Проверьте интернет или заполните вручную.',too_big:'Файл слишком большой.',bad_image:'Не получилось прочитать страницу: снимите ровно, без бликов, чтобы влезла целиком.',not_configured:'Распознавание на сервере не настроено. Заполните вручную.',empty:'На фото не нашли паспортных данных. Проверьте, та ли страница.'};
window.SHTATKA_PASSPORT={prepare,recognize,url,REASON,DEMO,snilsOk};
})();
