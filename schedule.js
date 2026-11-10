/* График смен: хранится в карточке данных кадрового ядра (ST.sch) и считается здесь.
   Ячейка = «сотрудник|дата» → код вида смены или 'off'. Пустая ячейка — не назначено. */
(function(){
const R=window.SHTATKA_HR,J=window.SHTATKA_JOBS,H=window.SHTATKA_HOME;if(!R)return;
const d=R.d,ST=()=>R.state();
const S=()=>{const s=ST();s.sch=s.sch||{};s.sch.cells=s.sch.cells||{};s.sch.incl=s.sch.incl||{};return s.sch;};
const PRESET={
 food:[['Открытие','08:00','16:00'],['Закрытие','14:00','22:00']],foodprod:[['Утро','06:00','14:00'],['День','14:00','22:00']],
 foodtrade:[['Утро','09:00','15:00'],['Вечер','15:00','21:00']],trade:[['Утро','09:00','15:00'],['Вечер','15:00','21:00']],
 hotel:[['День','08:00','20:00'],['Ночь','20:00','08:00']],clinic:[['Утро','08:00','14:00'],['Вечер','14:00','20:00']],
 beauty:[['Утро','09:00','15:00'],['Вечер','15:00','21:00']],factory:[['Смена 1','07:00','15:00'],['Смена 2','15:00','23:00']],
 pvz:[['Утро','09:00','15:00'],['Вечер','15:00','21:00']],clean:[['День','08:00','17:00'],['Вечер','17:00','22:00']],
 transport:[['Рейс день','06:00','18:00'],['Рейс ночь','18:00','06:00']]};
const DEF=[['Утро','08:00','16:00'],['Вечер','14:00','22:00']];
const ind=()=>J?J.industry().id:'';
function types(){const s=S();if(!s.types||!s.types.length){const p=PRESET[ind()]||DEF;s.types=p.map((t,i)=>({id:'t'+(i+1),name:t[0],from:t[1],to:t[2]}));}return s.types;}
const mins=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1]*60+ +m[2]):0;};
const tlen=t=>{let a=mins(t.to)-mins(t.from);if(a<=0)a+=1440;return a;};
const hrs=t=>tlen(t)/60;
const short=t=>t.from.slice(0,2)+'–'+t.to.slice(0,2);
/* минуты в ночное время 22:00–06:00 (ст. 96 ТК) внутри смены */
function nightMin(t){let n=0,a=mins(t.from),L=tlen(t);for(let i=0;i<L;i++){const m=(a+i)%1440;if(m>=1320||m<360)n++;}return n;}
/* официальные праздники с фиксированной датой (ст. 112 ТК) */
const HOL=['01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08','02-23','03-08','05-01','05-09','06-12','11-04'];
const isHol=ds=>HOL.includes(ds.slice(5));
const CAL=window.SHTATKA_CAL;
const monday=ds=>{const x=d.D(ds),w=(x.getDay()+6)%7;return d.addDays(ds,-w);};
const week=ds=>{const m=monday(ds);return [0,1,2,3,4,5,6].map(i=>d.addDays(m,i));};
const key=(e,ds)=>(e.id||e)+'|'+ds;
const cell=(e,ds)=>S().cells[key(e,ds)]||'';
function set(e,ds,v){const s=S();if(!v)delete s.cells[key(e,ds)];else s.cells[key(e,ds)]=v;R.save();}
const typeOf=v=>types().find(t=>t.id===v)||null;
/* кто в графике: сменные режимы или сфера со сменами; удалёнка и офис — нет, если не включено вручную */
function inSchedule(e){
  const s=S();if(e.out)return false;if(s.incl[e.id]===true)return true;if(s.incl[e.id]===false)return false;
  if(e.workMode==='shift'||e.workMode==='2/2')return true;
  if(e.remote)return false;
  return !!(J&&J.needsShifts(ind(),e.position,false));
}
const staff=()=>R.active().filter(inSchedule);
const others=()=>R.active().filter(e=>!inSchedule(e));
/* показывать ли раздел как рабочий: сфера со сменами, у кого-то сменный режим, есть записи или включено вручную */
function active(){const s=S();if(s.on)return true;if(Object.keys(s.cells).length)return true;
  if(R.active().some(e=>e.workMode==='shift'||e.workMode==='2/2'))return true;
  return !!(J&&J.needsShifts(ind(),'',false));}
function enable(v){S().on=!!v;R.save();}
/* проверки по человеку за неделю */
function warn(e,days){
  const out=[],a=R.age(e.birth);
  const ts=days.map(x=>typeOf(cell(e,x)));
  const worked=ts.filter(Boolean).length;
  if(worked===7)out.push('Нет выходного за неделю. Еженедельный непрерывный отдых — не менее 42 часов (ст. 110 ТК).');
  for(let i=0;i<6;i++){const p=ts[i],n=ts[i+1];if(!p||!n)continue;
    const gap=((mins(n.from)+1440)-(mins(p.from)+tlen(p)))/60;
    if(gap<11)out.push(d.fmt(days[i+1]).slice(0,5)+': между сменами меньше 11 часов отдыха.');}
  if(a!=null&&a<18&&ts.some(t=>t&&nightMin(t)>0))out.push('Несовершеннолетнему нельзя работать ночью, с 22:00 до 06:00 (ст. 96 ТК).');
  days.forEach((x,i)=>{if(ts[i]&&R.onSick(e,x))out.push(d.fmt(x).slice(0,5)+': назначена смена, но у сотрудника больничный.');});
  return out;
}
/* итоги за месяц y,m (m от 0) */
function month(e,y,m){
  const last=new Date(y,m+1,0).getDate();let sh=0,min=0,nt=0,hol=0,hmin=0;
  for(let i=1;i<=last;i++){const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');const t=typeOf(cell(e,ds));if(!t)continue;
    sh++;min+=tlen(t);nt+=nightMin(t);if(isHol(ds)){hol++;hmin+=tlen(t);}}
  return {shifts:sh,hours:min/60,night:nt/60,hol,holHours:hmin/60,norm:CAL?CAL.month(y,m).hours:R.workDaysIn(y,m)*8};
}
/* кто и когда сегодня */
function today(){
  const t=d.today(),by={};types().forEach(x=>by[x.id]=0);let off=0;const list=staff();
  list.forEach(e=>{const v=cell(e,t);if(R.onSick(e,t)||!v||v==='off')off++;else if(by[v]!=null)by[v]++;});
  return {by,off,total:list.length};
}
function copyWeek(from,to){const a=week(from),b=week(to);let n=0;staff().forEach(e=>a.forEach((x,i)=>{const v=cell(e,x);if(v){set(e,b[i],v);n++;}}));return n;}
function clearWeek(ds){staff().forEach(e=>week(ds).forEach(x=>set(e,x,'')));}
/* 2/2: люди через одного работают в противофазе, первый вид смены; на n недель вперёд */
function fill22(ds,n){const t=types()[0];if(!t)return 0;let c=0;const base=d.D('2024-01-01');
  staff().filter(e=>e.workMode==='2/2').forEach((e,k)=>{for(let w=0;w<(n||4);w++)week(d.addDays(ds,7*w)).forEach(x=>{
    const n0=Math.round((d.D(x)-base)/864e5),ph=(n0+(k%2)*2)%4;if(R.onSick(e,x))return;set(e,x,ph<2?t.id:'off');c++;});});return c;}
window.SHTATKA_SCH={types,saveTypes(v){S().types=v;R.save();},short,hrs,tlen,nightMin,isHol,monday,week,cell,set,typeOf,inSchedule,staff,others,active,enable,warn,month,today,copyWeek,clearWeek,fill22,
  setIncl(id,v){const s=S();if(v==null)delete s.incl[id];else s.incl[id]=!!v;R.save();},ind};
})();
