/* Хранилище главной: варианты, начальный экран, структура компании, оформление.
   Пока всё лежит в браузере (localStorage). Когда появится сервер, нужно заменить только load() и persist(). */
(function(){
const {W,TPL,DEMO,UT}=window.SHTATKA_WIDGETS;
const KEY='shtatka-home-v2';
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const fromTpl=t=>t.list.map(e=>{const [id,sz]=e.split(':');return {id,size:sz||W[id].size};});
const clean=l=>(Array.isArray(l)?l:[]).filter(x=>x&&W[x.id]&&W[x.id].sizes.includes(x.size)).map(x=>({id:x.id,size:x.size}));
const uid=()=>Math.random().toString(36).slice(2,9);

/* Примеры структуры по отраслям: название, тип, доля штата */
const EX={
 base:[['Главный офис','office',14],['Филиал','office',10]],
 cafe:[['Кофейня на Невском','point',6],['Кофейня на Васильевском','point',5],['Кофейня в парке','point',3]],
 retail:[['Магазин на Ленина','point',6],['Магазин на Мира','point',6],['Магазин на Парковой','point',6]],
 factory:[['Цех 1','dept',10],['Цех 2','dept',9],['Склад готовой продукции','dept',3],['Администрация','dept',3]],
 warehouse:[['Склад Санкт-Петербург','city',12],['Склад Москва','city',8]],
 transport:[['Водители','dept',7],['Диспетчерская','dept',2],['Механики','dept',1]],
 auto:[['Сервис на Лесной','point',6],['Шиномонтаж на Парнасе','point',3]],
 build:[['Объект «Парковая, 12»','project',10],['Объект «ЖК Река»','project',9],['Объект «Склад»','project',6]],
 clean:[['БЦ «Нева»','project',9],['ТЦ «Мозаика»','project',10],['Школа № 14','project',9]],
 beauty:[['Студия в центре','point',5],['Студия на севере','point',3]],
 clinic:[['Терапия','dept',8],['Диагностика','dept',6],['Регистратура и администрация','dept',8]],
 hotel:[['Отель «Причал»','point',9],['Хостел «Причал-2»','point',6]],
 office:[['Разработка','dept',9],['Дизайн','dept',4],['Продажи','dept',4],['Управление','dept',3]]
};
function example(id){
  const total=parseInt(((DEMO[id]||{}).staff||['24'])[0],10)||24;const ex=EX[id]||EX.base;
  const sum=ex.reduce((a,x)=>a+x[2],0);let left=total;
  return ex.map((x,i)=>{const n=i===ex.length-1?left:Math.max(1,Math.round(x[2]*total/sum));left-=n;return {id:uid(),name:x[0],type:x[1],staff:n};});
}

/* Пункты меню слева. fixed — нельзя скрыть. href — раздел уже есть, иначе кнопка «скоро». */
const MENU=[
 {id:'home',title:'Главная',href:'cabinet.html',fixed:true},
 {id:'people',title:'Люди',href:'people.html'},
 {id:'tasks',title:'Заявки и задания',demoBadge:7},
 {id:'time',title:'Время'},
 {id:'docs',title:'Документы и сроки'},
 {id:'company',title:'Компания',href:'company.html'},
 {id:'tariff',title:'Тариф и оплата',href:'tariff.html'},
 {id:'knowledge',title:'Знания и объявления',demoBadge:1},
 {id:'benefits',title:'Льготы'},
 {id:'costs',title:'Расходы на людей'}
];
const MENU_ON=['home','people','tasks','time','docs','company','tariff'];
function normMenu(m){
  const seen=new Set(),out=[];
  (Array.isArray(m)?m:[]).forEach(x=>{if(x&&MENU.some(i=>i.id===x.id)&&!seen.has(x.id)){seen.add(x.id);out.push({id:x.id,on:!!x.on});}});
  MENU.forEach(i=>{if(!seen.has(i.id))out.push({id:i.id,on:MENU_ON.includes(i.id)});});
  const home=out.findIndex(x=>x.id==='home');const [h]=out.splice(home,1);h.on=true;out.unshift(h);
  return out;
}
let S=null;
function load(){
  S=get(KEY,null);
  if(!S){
    S={variants:[],start:'tpl:base',units:[],scope:null,ui:get('shtatka-cabinet-ui',{theme:'auto',brand:'night'})};
    // перенос из первой версии кабинета
    const old=get('shtatka-cabinet-tpl',[]);
    old.forEach(o=>{if(o&&o.name&&o.layout)S.variants.push({id:uid(),name:o.name,layout:clean(o.layout),demo:'base',at:Date.now()});});
    const ol=get('shtatka-cabinet-v1',null),ot=get('shtatka-cabinet-tplid','base');
    if(Array.isArray(ol)&&clean(ol).length){
      const base=TPL.find(t=>t.id===ot)||TPL[0],bl=JSON.stringify(fromTpl(base));
      if(JSON.stringify(clean(ol))!==bl){const v={id:uid(),name:'Моя главная',layout:clean(ol),demo:ot,at:Date.now()};S.variants.push(v);S.start='my:'+v.id;}
      else S.start='tpl:'+base.id;
    }
  }
  S.variants=(S.variants||[]).map(v=>({...v,layout:clean(v.layout)})).filter(v=>v.layout.length||v.name);
  S.units=Array.isArray(S.units)?S.units.filter(u=>u&&u.id&&u.name):[];
  if(S.scope&&!S.units.some(u=>u.id===S.scope))S.scope=null;
  S.ui=S.ui||{theme:'auto',brand:'night'};
  S.menu=normMenu(S.menu);
  S.employees=Array.isArray(S.employees)?S.employees.filter(e=>e&&e.id&&e.fio):[];
  S.company=S.company&&typeof S.company==='object'?S.company:{};
  S.onboard=S.onboard&&typeof S.onboard==='object'?S.onboard:{seen:false,path:null,hideChecklist:false};
  S.tariff=S.tariff||null;S.demoView=!!S.demoView;
  if(!resolve(S.start))S.start='tpl:base';
  return S;
}
function persist(){put(KEY,S);}
function resolve(id){
  if(!id)return null;
  if(id.startsWith('tpl:')){const t=TPL.find(x=>x.id===id.slice(4));return t?{id,name:t.title,sub:t.sub,layout:fromTpl(t),demo:t.id,builtin:true}:null;}
  if(id.startsWith('my:')){const v=S.variants.find(x=>x.id===id.slice(3));return v?{id,name:v.name,layout:v.layout,demo:v.demo||'base',variant:v}:null;}
  return null;
}
load();
const sess=()=>get('shtatka-session',null);
window.SHTATKA_HOME={
  MENU,normMenu,session:sess,
  /* «мои данные»: человек зарегистрировался в этом браузере. Без регистрации кабинет — демонстрация. */
  real:()=>!!sess(),
  verified:()=>{const x=sess();return !!(x&&x.verified!==false);},
  setVerified(v){const x=sess();if(x){x.verified=!!v;put('shtatka-session',x);}},
  employees:()=>S.employees,
  addEmployee(e){const o={...e,id:uid(),at:Date.now()};S.employees.push(o);persist();return o;},
  removeEmployee(id){S.employees=S.employees.filter(e=>e.id!==id);persist();},
  steps(){const x=sess()||{};return [
    {id:'verify',title:'Подтвердите компанию',sub:'Подписью руководителя или оплатой счёта',href:'register.html#verify',done:x.verified!==false},
    {id:'people',title:'Добавьте сотрудников',sub:'Нового или уже работающих по их договорам',href:'people.html',done:S.employees.length>0},
    {id:'company',title:'Заполните анкету компании',sub:'Режим работы, дни зарплаты, отпуск',href:'company.html',done:!!S.company.filled},
    {id:'home',title:'Настройте главную',sub:'Готовый вариант для вашей отрасли',href:'customize.html',done:S.start!=='tpl:base'},
    {id:'tariff',title:'Выберите тариф',sub:'Помесячно или за год',href:'tariff.html',done:!!S.tariff}];},
  state:()=>S,load,persist,resolve,fromTpl,clean,example,uid,EX,
  units:()=>S.units,
  scopeUnit:()=>S.units.find(u=>u.id===S.scope)||null,
  start:()=>resolve(S.start),
  setScope(id){S.scope=id||null;persist();},
  setStart(id){if(resolve(id)){S.start=id;persist();return true}return false;},
  saveVariant(v){const i=S.variants.findIndex(x=>x.id===v.id);const o={id:v.id||uid(),name:v.name,layout:clean(v.layout),demo:v.demo||'base',at:Date.now()};
    if(i>-1)S.variants[i]=o;else S.variants.push(o);persist();return o;},
  deleteVariant(id){S.variants=S.variants.filter(x=>x.id!==id);if(S.start==='my:'+id)S.start='tpl:base';persist();},
  applyUi(){const r=document.documentElement,u=S.ui;
    if(u.theme==='auto')r.removeAttribute('data-theme');else r.dataset.theme=u.theme;
    if(u.brand==='night')r.removeAttribute('data-brand');else r.dataset.brand=u.brand;}
};
})();
