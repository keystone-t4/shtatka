/* Штатка: правила расчёта обязательных платежей с зарплаты на 2026 год.
   Чистые функции без DOM — их же можно вызывать на сервере.
   Источники: НК РФ ст. 224, 421, 425, 427 (ред. 425-ФЗ от 28.11.2025); МРОТ — 429-ФЗ;
   предельная база — пост. Правительства № 1705 от 31.10.2025; перечень ОКВЭД для 15% — распоряжение № 4125-р от 27.12.2025. */
(function(root){
const R={
  year:2026,
  mrot:27093,                 // федеральный МРОТ с 01.01.2026
  base:2979000,               // единая предельная база взносов на 2026 год
  general:{in:0.30,over:0.151},
  it:{in:0.15,over:0.076},    // аккредитованные IT-компании с 2026 года
  mspPriority:0.15,           // МСП с основным ОКВЭД из перечня 4125-р, свыше 1,5 МРОТ
  mspManufacturing:0.076,     // МСП обрабатывающих производств (перечень 3689-р), свыше 1,5 МРОТ
  ndfl:[[2400000,0.13],[5000000,0.15],[20000000,0.18],[50000000,0.20],[Infinity,0.22]],
  injuryMin:0.002,            // травматизм: от 0,2 % до 8,5 % по классу риска, ставку присылает СФР
  ausnInjuryYear:2959         // АУСН: фиксированный взнос на травматизм за год
};
/* Доп. тариф на ОПС (ст. 428 НК): по классу условий труда из СОУТ; без СОУТ — по спискам досрочной пенсии (ст. 30 400-ФЗ) */
const SOUT={'1':0,'2':0,'3.1':0.02,'3.2':0.04,'3.3':0.06,'3.4':0.07,'4':0.08};
const EARLY={'1':0.09,'2':0.06};
const extraRate=e=>{e=e||{};if(e.sout&&SOUT[e.sout]!=null)return SOUT[e.sout];return EARLY[e.early]||0;};
/* Перечень 4125-р: классы и подклассы ОКВЭД 2 (54 позиции) */
const PRIORITY=['01','03','10','11','13','14','15','16','17','18','21','22','23','24','25','26','27','28','29','30','31','32','33',
 '36','37','38','39','50','51','53','55','56','58','59','60','61','62','63','68.3','72','74','75','79','80','84','85','87','88','90','91','93.1','94','95','96'];
const okvedNorm=c=>String(c||'').trim().replace(/[^\d.]/g,'');
const inPriority=c=>{c=okvedNorm(c);if(!c)return false;return PRIORITY.some(p=>c===p||c.startsWith(p+(p.includes('.')?'':'.'))||(p.includes('.')&&c.startsWith(p)));};
const isManufacturing=c=>{const k=parseInt(okvedNorm(c),10);return k>=10&&k<=33;};

/* Какой тариф взносов у компании. co: {msp, okved, taxSystem, it, share70} */
function tariff(co){
  co=co||{};
  const why=[];const msp=co.msp&&co.msp!=='none';
  if(co.taxSystem==='ausn')return {kind:'ausn',title:'АУСН: взносов по единому тарифу нет',why:['Травматизм — фиксированно '+R.ausnInjuryYear.toLocaleString('ru-RU')+' ₽ в год']};
  if(co.it)return {kind:'it',title:'IT-компания: 15 % до предельной базы, 7,6 % сверх',why:['Аккредитация Минцифры — отмечено вами']};
  why.push((msp?'✓':'✗')+' Реестр МСП'+(co.msp==null?': нет данных':msp?': '+({micro:'микро',small:'малое',medium:'среднее'}[co.msp]||co.msp):': не состоит'));
  const pr=inPriority(co.okved);
  why.push((pr?'✓':'✗')+' Основной ОКВЭД '+(co.okved||'не указан')+(pr?' в перечне 4125-р':' не в перечне 4125-р'));
  why.push((co.share70?'✓':'✗')+' Доход от основного вида не меньше 70 %');
  if(msp&&pr&&co.share70){
    if(isManufacturing(co.okved)&&co.manuf!==false)return {kind:'msp',low:R.mspManufacturing,title:'МСП, обработка: 30 % до 1,5 МРОТ, 7,6 % свыше',why:why.concat('Код должен быть в перечне 3689-р — проверьте')};
    return {kind:'msp',low:R.mspPriority,title:'МСП: 30 % до 1,5 МРОТ, 15 % свыше',why};
  }
  return {kind:'general',title:'Общий тариф: 30 % до предельной базы, 15,1 % сверх',why};
}

/* Взносы за один месяц. pay — начислено за месяц, cum — облагаемая база с начала года до этого месяца */
function contribMonth(pay,cum,t){
  if(t.kind==='ausn')return 0;
  const within=Math.max(0,Math.min(pay,R.base-cum)),over=pay-within;
  if(t.kind==='it')return within*R.it.in+over*R.it.over;
  if(t.kind==='msp'){
    const low=Math.min(pay,1.5*R.mrot),high=pay-low;
    const lowIn=Math.min(low,within),lowOver=low-lowIn;
    return lowIn*R.general.in+lowOver*R.general.over+high*t.low;
  }
  return within*R.general.in+over*R.general.over;
}
/* НДФЛ резидента нарастающим итогом с начала года */
function ndflTotal(inc){let tax=0,prev=0;for(const [lim,r] of R.ndfl){if(inc<=prev)break;tax+=(Math.min(inc,lim)-prev)*r;prev=lim;}return tax;}

/* Год помесячно для одного человека. row: {gross, director}; opt: {injury (доля), months (1..12)} */
function yearFor(row,t,opt){
  opt=opt||{};const months=opt.months||12,inj=t.kind==='ausn'?0:(opt.injury==null?R.injuryMin:opt.injury);
  const out=[];let cumBase=0,cumInc=0,ndflPrev=0;
  for(let m=1;m<=months;m++){
    const pay=+row.gross||0;
    const base=row.director&&pay<R.mrot?R.mrot:pay;   // ст. 421: за руководителя база не меньше МРОТ
    const c=contribMonth(base,cumBase,t);cumBase+=base;
    cumInc+=pay;const nTot=Math.round(ndflTotal(cumInc));const n=nTot-ndflPrev;ndflPrev=nTot;
    const injury=pay*inj;
    out.push({m,pay,ndfl:n,net:pay-n,contrib:round2(c),injury:round2(injury),cost:round2(pay+c+injury),toBudget:round2(n+c+injury),base});
  }
  return out;
}
const round2=x=>Math.round(x*100)/100;
/* Сводка по штату. rows: [{title, gross, count, director}] */
function calc(rows,co,opt){
  const t=tariff(co);
  const res=rows.filter(r=>+r.gross>0||r.director).map(r=>{
    const y=yearFor(r,t,opt),n=Math.max(1,+r.count||1);
    const sum=k=>round2(y.reduce((a,x)=>a+x[k],0)*n),first=k=>round2(y[0][k]*n);
    const notes=[];
    const iNd=y.findIndex((x,i)=>i>0&&x.ndfl>y[0].ndfl+1);if(iNd>0)notes.push('НДФЛ 15 % и выше с '+MON[iNd]);
    const iB=y.findIndex(x=>x.contrib<y[0].contrib-0.5);if(iB>0)notes.push('Взносы ниже с '+MON[iB]+': превышена предельная база');
    if(r.director&&+r.gross<R.mrot)notes.push('Взносы за руководителя — с МРОТ');
    return {row:r,count:n,months:y,month:{pay:first('pay'),ndfl:first('ndfl'),net:first('net'),contrib:first('contrib'),injury:first('injury'),cost:first('cost'),toBudget:first('toBudget')},
      year:{pay:sum('pay'),ndfl:sum('ndfl'),net:sum('net'),contrib:sum('contrib'),injury:sum('injury'),cost:sum('cost'),toBudget:sum('toBudget')},notes};
  });
  const tot=p=>{const o={};['pay','ndfl','net','contrib','injury','cost','toBudget'].forEach(k=>o[k]=round2(res.reduce((a,x)=>a+x[p][k],0)));return o;};
  const out={tariff:t,rows:res,month:tot('month'),year:tot('year')};
  if(t.kind==='ausn'){out.year.injury=R.ausnInjuryYear;out.year.cost=round2(out.year.cost+R.ausnInjuryYear);out.year.toBudget=round2(out.year.toBudget+R.ausnInjuryYear);
    out.month.injury=round2(R.ausnInjuryYear/12);out.month.cost=round2(out.month.cost+out.month.injury);out.month.toBudget=round2(out.month.toBudget+out.month.injury);}
  return out;
}
const MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
root.SHTATKA_PAYROLL={R,SOUT,EARLY,extraRate,PRIORITY,inPriority,isManufacturing,tariff,contribMonth,ndflTotal,yearFor,calc};
})(typeof window!=='undefined'?window:globalThis);
