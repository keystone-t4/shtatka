/* Штатка: даты везде в формате дд.мм.гггг.
   Поля type="date" заменяются текстовыми с маской. Остальной код по-прежнему читает и пишет value в виде ГГГГ-ММ-ДД. */
(function(){
const D=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
const iso2ru=v=>{const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(v||'');return m?m[3]+'.'+m[2]+'.'+m[1]:(v||'');};
const ru2iso=s=>{const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s||'');if(!m)return '';const d=+m[1],mo=+m[2],y=+m[3],t=new Date(y,mo-1,d);
  return t.getFullYear()===y&&t.getMonth()===mo-1&&t.getDate()===d?y+'-'+m[2]+'-'+m[1]:'';};
const mask=s=>{const d=String(s).replace(/\D/g,'').slice(0,8);return d.length>4?d.slice(0,2)+'.'+d.slice(2,4)+'.'+d.slice(4):d.length>2?d.slice(0,2)+'.'+d.slice(2):d;};
function conv(el){
  if(el.dataset.ru)return;el.dataset.ru='1';
  const init=el.value;
  el.type='text';el.inputMode='numeric';el.autocomplete='off';el.maxLength=10;if(!el.placeholder)el.placeholder='дд.мм.гггг';
  Object.defineProperty(el,'value',{configurable:true,get(){return ru2iso(D.get.call(el));},set(v){D.set.call(el,iso2ru(v));}});
  D.set.call(el,iso2ru(init));
  el.addEventListener('input',e=>{if(e.inputType&&/^delete/.test(e.inputType))return;const m=mask(D.get.call(el));if(m!==D.get.call(el))D.set.call(el,m);});
  el.addEventListener('blur',()=>{const t=D.get.call(el);el.setCustomValidity&&el.setCustomValidity(t&&!ru2iso(t)?'Дата в формате дд.мм.гггг':'');el.classList.toggle('bad-date',!!t&&!ru2iso(t));});
}
/* пока дата неполная, остальной код событие не получает (как у обычного поля даты) */
['input','change'].forEach(n=>document.addEventListener(n,e=>{const el=e.target;
  if(el&&el.dataset&&el.dataset.ru){const t=D.get.call(el);if(t&&!ru2iso(t))e.stopPropagation();}},true));
const scan=r=>(r.querySelectorAll?r.querySelectorAll('input[type=date]'):[]).forEach(conv);
scan(document);
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches&&n.matches('input[type=date]'))conv(n);scan(n);}}))).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>scan(document));
window.SHTATKA_DATE={iso2ru,ru2iso};
})();
