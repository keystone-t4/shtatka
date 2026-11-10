/* Производственный календарь: 2026–2028, данные в calendar-data.js */
(function(){
const C=window.SHTATKA_CAL,$=s=>document.querySelector(s);
const MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const P=n=>String(n).padStart(2,'0'),dm=ds=>ds.slice(8)+'.'+ds.slice(5,7)+'.'+ds.slice(0,4);
const now=new Date(),today=now.getFullYear()+'-'+P(now.getMonth()+1)+'-'+P(now.getDate());
let Y=C.years.includes(now.getFullYear())?now.getFullYear():C.years[0];
const plu=(n,a,b,c)=>{const m=n%100,k=n%10;return (m>10&&m<20)?c:k===1?a:(k>=2&&k<=4)?b:c;};
const lab=p=>{const f=x=>dm(x).slice(0,5)+(x.slice(0,4)!==String(Y)?'.'+x.slice(0,4):'');return p.a===p.b?f(p.a):f(p.a)+' – '+f(p.b);};
function periods(y){ /* подряд идущие нерабочие дни, в которых есть праздник или перенос */
  const out=[];let cur=null;const end=new Date(y+1,0,15);
  for(let d=new Date(y-1,11,28);d<=end;d.setDate(d.getDate()+1)){
    const ds=d.getFullYear()+'-'+P(d.getMonth()+1)+'-'+P(d.getDate()),k=C.kind(ds),off=k==='holiday'||k==='moved'||k==='weekend';
    if(off){if(!cur)cur={a:ds,b:ds,sp:false};cur.b=ds;if(k==='holiday'||k==='moved')cur.sp=true;}else{if(cur&&cur.sp)out.push(cur);cur=null;}}
  if(cur&&cur.sp)out.push(cur);
  return out.filter(p=>p.b>=y+'-01-01'&&p.a<=y+'-12-31').map(p=>{const n=Math.round((new Date(p.b+'T12:00:00')-new Date(p.a+'T12:00:00'))/864e5)+1;return {a:p.a,b:p.b,n};});
}
function month(y,m){
  const first=new Date(y,m,1),lead=(first.getDay()+6)%7,n=new Date(y,m+1,0).getDate(),st=C.month(y,m);
  let h='';for(let i=0;i<lead;i++)h+='<span class="cy-d cy-e"></span>';
  for(let i=1;i<=n;i++){const ds=y+'-'+P(m+1)+'-'+P(i),k=C.kind(ds);
    h+=`<button type="button" class="cy-d ${k}${ds===today?' today':''}" data-d="${ds}" aria-label="${dm(ds)}: ${C.title(ds)}">${i}</button>`;}
  return `<div class="cy-m"><h3>${MN[m]}<small>${st.work} раб. · ${st.hours} ч</small></h3><div class="cy-t">${['пн','вт','ср','чт','пт','сб','вс'].map(x=>`<b>${x}</b>`).join('')}${h}</div></div>`;
}
function draw(){
  const T=C.year(Y),info=C.YEARS[Y];
  const per=periods(Y).filter(p=>p.n>=3||C.names.some(f=>Y+'-'+f[0]>=p.a&&Y+'-'+f[0]<=p.b));
  $('#cal').innerHTML=`<div class="cy-tabs" role="tablist">${C.years.map(y=>`<button type="button" class="cy-tab" role="tab" data-y="${y}" aria-selected="${y===Y}">${y}${C.YEARS[y].status==='draft'?' · план':''}</button>`).join('')}</div>
  ${info.status==='draft'?`<p class="cy-note w"><b>Календарь на ${Y} год ещё не утверждён.</b> Показаны праздники по ст. 112 ТК. Переносы, в том числе на новогодние каникулы, Правительство обычно утверждает осенью предыдущего года. Мы обновим календарь, когда выйдет постановление.</p>`:`<p class="cy-note">${info.doc}.</p>`}
  <div class="cy-sum"><div><b>${T.work}</b><span>рабочих дней</span></div><div><b>${T.off}</b><span>выходных и праздничных</span></div><div><b>${T.hours}</b><span>часов при 40-часовой неделе</span></div><div><b>${T.short}</b><span>${plu(T.short,'сокращённый день','сокращённых дня','сокращённых дней')}</span></div></div>
  <div class="cy-leg"><span><i style="background:#fff;border:1px solid var(--line)"></i>рабочий</span><span><i style="background:#EBE5D8"></i>выходной</span><span><i style="background:#D9342B"></i>праздничный</span><span><i style="background:#F08A24"></i>перенесённый выходной</span><span><i style="background:#F6D86B"></i>сокращённый (на 1 час)</span><span><i style="background:#2E9A5B"></i>рабочая суббота</span></div>
  <div class="cy-g">${Array.from({length:12},(_,m)=>month(Y,m)).join('')}</div>
  <div class="cy-i" id="cyI" aria-live="polite">Нажмите на день, чтобы увидеть, что это за день.</div>
  <div class="cy-ls"><h2>Периоды отдыха</h2>${per.map(p=>`<div><b>${lab(p)}</b><span>${p.n} ${plu(p.n,'день','дня','дней')}</span></div>`).join('')}</div>`;
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-y]');if(t){Y=+t.dataset.y;draw();return;}
  const d=e.target.closest('[data-d]');if(d){const ds=d.dataset.d,w=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][new Date(ds+'T12:00:00').getDay()];$('#cyI').innerHTML='<b>'+dm(ds)+', '+w+'.</b> '+C.title(ds)+'.';}
});
draw();
})();
