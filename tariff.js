/* Раздел «Тариф и оплата»: расчёт по числу сотрудников и выбор тарифа. Счёт появится вместе с сервером. */
(function(){
const H=window.SHTATKA_HOME,UI=window.SHTATKA_UI,toast=UI.toast;
const $=s=>document.querySelector(s);
const S=H.state();
const fmt=n=>n.toLocaleString('ru-RU')+' ₽';
const n0=H.employees().length;
$('#tN').value=Math.max(1,n0);
$('#tHint').textContent=n0?('В разделе «Люди» '+n0+' чел. Можно посчитать на другое число.'):'Сейчас в разделе «Люди» никого нет, поэтому считаем на 1 человека.';
function calc(){
  const n=Math.max(1,parseInt($('#tN').value,10)||1);
  $('#tM').textContent=fmt(100*n);$('#tY').textContent=fmt(1000*n);
  $('#tY2').textContent='в год · около '+fmt(Math.round(1000*n/12))+' в месяц';
  $('#pMonth').setAttribute('aria-current',S.tariff==='month');$('#pYear').setAttribute('aria-current',S.tariff==='year');
  $('#tStatus').textContent=S.tariff==='year'?'Выбран тариф «За год»':S.tariff==='month'?'Выбран тариф «Помесячно»':'Тариф не выбран';
  $('#tInvoice').disabled=!S.tariff;
}
$('#tN').addEventListener('input',calc);
document.addEventListener('click',e=>{const b=e.target.closest('[data-plan]');if(!b)return;S.tariff=b.dataset.plan;H.persist();calc();toast('Тариф выбран. Счёт появится здесь, когда подключим сервер.');});
calc();
})();
