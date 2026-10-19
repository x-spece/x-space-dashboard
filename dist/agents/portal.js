import{$,rpc,run,notice,money,date,phone,el,renderTransactions,renderMessages}from'./client.js';
let token=sessionStorage.getItem('tkt-exchange-token'),captain=null,me=null,pending=null,page='activate';
const call=(action,data={})=>rpc(action,{...data,token});
async function refresh(){me=await call('me');$('balance').textContent=Number(me.balance).toLocaleString('en-US');$('agentName').textContent=me.name;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;}
$('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await rpc('login',{phone:$('loginPhone').value,pin:$('loginPin').value});$('loginPin').value='';token=r.token;sessionStorage.setItem('tkt-exchange-token',token);await refresh();notice('تم تسجيل الدخول.');});};
$('logout').onclick=()=>run(async()=>{await call('logout');sessionStorage.removeItem('tkt-exchange-token');location.reload();});
$('refresh').onclick=()=>run(refresh);
async function showPage(name){page=name;for(const p of document.querySelectorAll('.page'))p.hidden=p.id!==name;for(const b of document.querySelectorAll('nav button'))b.classList.toggle('selected',b.dataset.page===name);$('title').textContent={activate:'تفعيل اشتراك',transactions:'المعاملات والتحويلات',support:'دعم الصيرفات',about:'حول الشركة',qr:'باركود البوابة'}[name];if(name==='transactions')await transactions();if(name==='support')await messages();}
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>run(()=>showPage(b.dataset.page));
function resetCaptain(){captain=null;pending=null;$('captainBox').hidden=true;$('receipt').hidden=true;}
$('captainPhone').oninput=resetCaptain;
$('searchForm').onsubmit=e=>{e.preventDefault();run(async()=>{resetCaptain();captain=await call('lookup',{phone:$('captainPhone').value});$('captainName').textContent=captain.name;$('captainNumber').textContent=phone(captain.phone);$('expiry').textContent='نهاية الاشتراك الحالي: '+date(captain.expires_at);$('captainBox').hidden=false;notice('تحقق من اسم الكابتن ورقمه قبل المتابعة.');});};
function updatePlan(){pending=null;const w=Number($('weeks').value);$('total').textContent=Number.isInteger(w)&&w>=1&&w<=52?money(w*5000):'حدد مدة صحيحة';for(const b of document.querySelectorAll('[data-weeks]'))b.classList.toggle('chosen',Number(b.dataset.weeks)===w);}
for(const b of document.querySelectorAll('[data-weeks]'))b.onclick=()=>{$('weeks').value=b.dataset.weeks;updatePlan();};$('weeks').oninput=updatePlan;
$('review').onclick=()=>run(async()=>{const w=Number($('weeks').value);if(!captain||!Number.isInteger(w)||w<1||w>52)throw new Error('INVALID_WEEKS');await refresh();if(me.balance<w*5000)throw new Error('INSUFFICIENT_BALANCE');if(!pending)pending={id:crypto.randomUUID(),phone:captain.phone,captain_id:captain.id,weeks:w};$('confirmationDetails').replaceChildren(el('h3',captain.name),el('p',phone(captain.phone)),el('p',`${w} أسبوع — ${w*7} يوم`),el('h3',money(w*5000)),el('p','الرصيد بعد الخصم: '+money(me.balance-w*5000)));$('confirmation').showModal();});
$('edit').onclick=()=>$('confirmation').close();
$('confirm').onclick=()=>run(async()=>{if(!pending)return;const receipt=await call('activate',pending);$('confirmation').close();$('captainBox').hidden=true;$('receipt').hidden=false;$('receipt').replaceChildren(el('h2','✓ تم تفعيل الاشتراك بنجاح'),el('p',captain.name+' · '+phone(captain.phone)),el('p',`${receipt.weeks} أسبوع · ${money(receipt.amount)}`),el('p','الاشتراك حتى: '+date(receipt.expires_at)),el('p','رقم المعاملة: '+receipt.id));pending=null;await refresh();notice('تم الخصم وتفعيل الاشتراك.');});
async function transactions(){renderTransactions(await call('transactions'),$('transactionList'));}async function messages(){renderMessages(await call('messages'),$('messages'));}
$('reloadTransactions').onclick=()=>run(transactions);
let messageId=null;$('messageBody').oninput=()=>messageId=null;
$('messageForm').onsubmit=e=>{e.preventDefault();run(async()=>{messageId??=crypto.randomUUID();renderMessages(await call('send',{body:$('messageBody').value,id:messageId}),$('messages'));$('messageBody').value='';messageId=null;});};
setInterval(()=>{if(token&&page==='support'&&!document.hidden&&!document.body.dataset.busy)messages().catch(()=>{});},7000);
if(token)run(refresh);
