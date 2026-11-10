/* Производственный календарь РФ на 2026–2028 годы.
   2026: постановление Правительства от 24.09.2025 № 1466. 2027: постановление от 17.09.2026 № 1187.
   2028: переносы ещё не утверждены (обычно их утверждают осенью 2027): показаны праздники по ст. 112 ТК и один известный перенос,
   всё остальное помечено как предварительное. Для остальных лет считаем только выходные и фиксированные праздники. */
(function(){
const P=n=>String(n).padStart(2,'0');
const FIX=[['01-01','Новый год'],['01-02','Новогодние каникулы'],['01-03','Новогодние каникулы'],['01-04','Новогодние каникулы'],['01-05','Новогодние каникулы'],['01-06','Новогодние каникулы'],['01-07','Рождество Христово'],['01-08','Новогодние каникулы'],['02-23','День защитника Отечества'],['03-08','Международный женский день'],['05-01','Праздник Весны и Труда'],['05-09','День Победы'],['06-12','День России'],['11-04','День народного единства']];
const YEARS={
 2026:{doc:'Постановление Правительства РФ от 24.09.2025 № 1466',status:'ok',
  X:{'2026-01-09':'Перенос с субботы 3 января','2026-12-31':'Перенос с воскресенья 4 января','2026-03-09':'Перенос с воскресенья 8 марта','2026-05-11':'Перенос с субботы 9 мая'},
  W:[],S:['2026-04-30','2026-05-08','2026-06-11','2026-11-03']},
 2027:{doc:'Постановление Правительства РФ от 17.09.2026 № 1187',status:'ok',
  X:{'2027-11-05':'Перенос с субботы 2 января','2027-12-31':'Перенос с воскресенья 3 января','2027-02-22':'Перенос с субботы 20 февраля','2027-05-03':'Перенос с субботы 1 мая','2027-05-10':'Перенос с воскресенья 9 мая','2027-06-14':'Перенос с субботы 12 июня'},
  W:['2027-02-20'],S:['2027-02-20','2027-04-30','2027-06-11','2027-11-03']},
 2028:{doc:'Переносы выходных на 2028 год ещё не утверждены',status:'draft',
  X:{'2028-11-06':'Предварительно: перенос с субботы 4 ноября (ст. 112 ТК)'},W:[],S:['2028-02-22','2028-03-07','2028-05-08']}
};
const D=s=>new Date(s+'T12:00:00');
const iso=(y,m,d)=>y+'-'+P(m+1)+'-'+P(d);
const names={};FIX.forEach(f=>names[f[0]]=f[1]);
function hol(ds){return names[ds.slice(5)]||null;}
function kind(ds){
  const y=+ds.slice(0,4),Y=YEARS[y],w=D(ds).getDay(),we=w===0||w===6;
  if(Y&&Y.W.includes(ds))return 'worksat';
  if(hol(ds))return 'holiday';
  if(Y&&Y.X[ds])return 'moved';
  if(we)return 'weekend';
  if(Y&&Y.S.includes(ds))return 'short';
  return 'work';
}
const isOff=ds=>{const k=kind(ds);return k==='holiday'||k==='moved'||k==='weekend';};
const isWork=ds=>!isOff(ds);
function isHoliday(ds){return !!hol(ds);}
function title(ds){const y=+ds.slice(0,4),Y=YEARS[y],k=kind(ds);
  if(k==='holiday')return hol(ds);if(k==='moved')return Y.X[ds];if(k==='worksat')return 'Рабочая суббота (перенос)';if(k==='short')return 'Сокращённый день: на 1 час короче';if(k==='weekend')return 'Выходной';return 'Рабочий день';}
function month(y,m){let work=0,off=0,short=0,hrs=0;const n=new Date(y,m+1,0).getDate();
  for(let i=1;i<=n;i++){const ds=iso(y,m,i),k=kind(ds),sh=k==='short'||(k==='worksat'&&YEARS[y].S.includes(ds));if(k==='holiday'||k==='moved'||k==='weekend')off++;else{work++;if(sh){short++;hrs+=7;}else hrs+=8;}}
  return {days:n,work,off,short,hours:hrs};}
function year(y){let a={days:0,work:0,off:0,short:0,hours:0};for(let m=0;m<12;m++){const r=month(y,m);for(const k in a)a[k]+=r[k];}return a;}
const workDaysIn=(y,m)=>month(y,m).work;
function addWork(s,n){const d=D(s);let k=0;while(k<n){d.setDate(d.getDate()+1);if(isWork(iso(d.getFullYear(),d.getMonth(),d.getDate())))k++;}return iso(d.getFullYear(),d.getMonth(),d.getDate());}
window.SHTATKA_CAL={YEARS,kind,isOff,isWork,isHoliday,title,month,year,workDaysIn,addWork,names:FIX,years:Object.keys(YEARS).map(Number)};
})();
