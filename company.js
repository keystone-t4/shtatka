/* Раздел «Компания»: реквизиты из регистрации, анкета компании, ссылки на структуру и тариф. */
(function(){
const H=window.SHTATKA_HOME,UI=window.SHTATKA_UI,toast=UI.toast;
const $=s=>document.querySelector(s);
const S=H.state(),ses=H.session()||{};
const FIELDS={qHead:'head',qPost:'post',qMode:'mode',qHours:'hours',qPay:'pay',qVac:'vac',qProb:'prob'};
$('#cName').textContent=ses.company||'Ваша компания';
$('#cMeta').textContent=ses.inn?('ИНН '+ses.inn):'Зарегистрируйтесь, чтобы здесь появились реквизиты.';
const ok=H.verified();
$('#cStatus').textContent=!H.real()?'Демо':ok?'Подтверждена':'Не подтверждена';
if(H.real()&&!ok){$('#cStatus').style.cssText='background:var(--warn-bg);color:var(--warn)';$('#cVerify').hidden=false;}
const us=H.units();
if(us.length)$('#cUnits').textContent=us.map(u=>u.name).join(', ');
$('#cTariff').textContent=S.tariff==='year'?'За год: 1 000 ₽ за сотрудника.':S.tariff==='month'?'Помесячно: 100 ₽ за сотрудника.':'Тариф не выбран.';
Object.entries(FIELDS).forEach(([id,k])=>{if(S.company[k]!=null&&S.company[k]!=='')$('#'+id).value=S.company[k];});
$('#fCo').addEventListener('submit',e=>{
  e.preventDefault();
  if(!$('#qHead').value.trim()||!$('#qPay').value.trim()){$('#qErr').hidden=false;$('#qErr').textContent='Заполните хотя бы руководителя и дни выплаты зарплаты.';return;}
  $('#qErr').hidden=true;
  Object.entries(FIELDS).forEach(([id,k])=>S.company[k]=$('#'+id).value.trim());
  S.company.filled=true;H.persist();toast('Анкета сохранена');
});
})();
