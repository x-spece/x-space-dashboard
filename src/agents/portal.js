import {normalizeIraqiPhone} from './phone.js?v=4';
import{$,db,rpc,run,notice,money,date,phone,el,renderTransactions,renderMessages}from'./client.js?v=4';
let token=sessionStorage.getItem('tkt-exchange-token'),captain=null,me=null,pending=null,page='activate',mode='login',sharedLocation=null,authenticated=false,failures=0,transactionRows=[],settlementRows=[],recoverySession=null;
const call=(action,data={})=>rpc(action,{...data,token});

const menu=$('appMenu');
function closeMenu(){if(menu.open)menu.close();$('menuToggle').setAttribute('aria-expanded','false');}
$('menuToggle').onclick=()=>{menu.showModal();$('menuToggle').setAttribute('aria-expanded','true');};
$('menuClose').onclick=closeMenu;
menu.addEventListener('close',()=>{$('menuToggle').setAttribute('aria-expanded','false');$('menuToggle').focus();});
menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();}});
document.addEventListener('contextmenu',e=>{if(!e.target.closest('input,textarea,[contenteditable="true"]'))e.preventDefault();});
document.addEventListener('dragstart',e=>{if(!e.target.closest('input,textarea'))e.preventDefault();});
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>{installPrompt=null;$('installApp').hidden=true;});
if(window.matchMedia('(display-mode: standalone)').matches)$('installApp').hidden=true;
$('installApp').onclick=async()=>{closeMenu();if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;}else{$('installInstructions').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'من Safari اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».':'من قائمة المتصفح ⋮ اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». إذا الرابط مفتوح داخل تطبيق ثاني، افتحه أولًا بمتصفح Chrome.';$('installHelp').showModal();}};
$('closeInstallHelp').onclick=()=>$('installHelp').close();
if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});});

const provinces=['بغداد','البصرة','نينوى','أربيل','السليمانية','دهوك','حلبجة','كركوك','ديالى','الأنبار','صلاح الدين','بابل','كربلاء','النجف','واسط','القادسية','ذي قار','ميسان','المثنى'];
$('province').append(...provinces.map(p=>new Option(p,p)));
const registrationIds=['personalName','shopName','shopPhone','province','area','street'];
function setMode(value){mode=value;const creating=value!=='login';for(const id of ['registrationFields','shopFields','privacyLabel'])$(id).hidden=!creating;for(const id of registrationIds)$(id).required=creating;$('privacy').required=creating;$('passwordFields').hidden=value==='complete';$('loginPin').required=value!=='complete';$('loginPin').minLength=value==='register'?8:1;$('loginPin').autocomplete=value==='register'?'new-password':'current-password';$('confirmLabel').hidden=value!=='register';$('confirmPassword').required=value==='register';$('loginPhone').readOnly=value==='complete';$('authTitle').textContent=value==='login'?'دخول حساب الصيرفة':value==='register'?'إنشاء حساب صيرفة':'إكمال بيانات الصيرفة';$('authSubmit').textContent=value==='login'?'تسجيل الدخول':value==='register'?'إنشاء الحساب':'حفظ بيانات الصيرفة';$('authHint').textContent=value==='login'?'ادخل برقمك الشخصي وكلمة سر حسابك بتكتوكة.':value==='register'?'إذا رقمك الشخصي مسجّل بتكتوكة، اختار «عندي حساب» وادخل بنفس كلمة السر.':'تم التحقق من حسابك. كمّل بيانات الصيرفة وشارك موقعها.';$('registerTab').classList.toggle('chosen',creating);$('loginTab').classList.toggle('chosen',!creating);}
$('registerTab').onclick=()=>setMode(authenticated?'complete':'register');$('loginTab').onclick=()=>setMode('login');$('eye').onclick=()=>{$('loginPin').type=$('loginPin').type==='password'?'text':'password';$('eye').textContent=$('loginPin').type==='password'?'إظهار':'إخفاء';};
function problem(text){throw Object.assign(new Error(text),{userMessage:text});}
async function phoneAuth(body){if(Object.hasOwn(body,'phone')){const ph=normalizeIraqiPhone(body.phone);if(!ph){$('loginPhone').focus();problem('الرقم الشخصي مو صحيح. اكتب رقم عراقي يبدأ بـ 07 ويتكوّن من 11 رقم.');}body={...body,phone:ph};}const{data,error}=await db.functions.invoke('taktooka-phone-auth',{body});let failure=data?.error;if(error){try{failure=(await error.context.json()).error;}catch{}}if(error||failure){const messages={WRONG_PASSWORD:'كلمة السر غير صحيحة.',ACCOUNT_EXISTS:'هذا الرقم مسجّل بتكتوكة. اختار «عندي حساب» وادخل بنفس كلمة السر.',INVALID_PASSWORD:'كلمة السر الجديدة من 8 إلى 128 حرفًا.',INVALID_PHONE:'اكتب رقم عراقي صحيح من 11 رقم يبدأ بـ 07.',PRIVACY_CONSENT_REQUIRED:'وافق على سياسة الخصوصية أولًا.',RATE_LIMIT:'محاولات كثيرة؛ انتظر قليلًا وحاول مرة ثانية.',CONTACT_SUPPORT:'تواصل ويا الدعم للتحقق من حسابك.',LOGIN_LOCKED:'افتح محادثة الدعم لاستعادة حسابك.'};if(failure==='WRONG_PASSWORD'){failures++;if(failures>=3)$('recovery').hidden=false;}problem(messages[failure]||'تعذّر الاتصال بنظام الدخول. حاول مرة ثانية.');}return data;}
function registrationData(){const personalPhone=normalizeIraqiPhone($('loginPhone').value),shopPhone=normalizeIraqiPhone($('shopPhone').value);if(!personalPhone){$('loginPhone').focus();problem('تحقق من رقم الهاتف الشخصي؛ لازم رقم عراقي صحيح.');}if(!shopPhone){$('shopPhone').focus();problem('تحقق من رقم هاتف الصيرفة؛ لازم رقم عراقي صحيح.');}$('loginPhone').value=phone(personalPhone);$('shopPhone').value=phone(shopPhone);const data={personal_name:$('personalName').value.trim(),shop_name:$('shopName').value.trim(),personal_phone:personalPhone,shop_phone:shopPhone,province:$('province').value,area:$('area').value.trim(),street:$('street').value.trim(),...sharedLocation};if(data.personal_name.split(/\s+/).length<3)problem('اكتب اسمك الثلاثي كاملًا.');if(!sharedLocation)problem('شارك لوكيشن الصيرفة أولًا.');return data;}
$('shareLocation').onclick=()=>run(async()=>{if(!navigator.geolocation)problem('المتصفح ما يدعم الموقع. افتح الرابط بمتصفح Chrome.');$('locationStatus').textContent='جاري تحديد موقع الصيرفة…';let p;try{p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));}catch{sharedLocation=null;$('locationStatus').textContent='ما تمّت مشاركة الموقع.';problem('اسمح بالموقع من إعدادات المتصفح وشغّل GPS، ثم حاول مرة ثانية.');}const{latitude:lat,longitude:lng,accuracy:accuracy_m}=p.coords;if(lat<29||lat>38||lng<38||lng>49)problem('موقع الصيرفة لازم يكون داخل العراق.');sharedLocation={lat,lng,accuracy_m};$('locationStatus').textContent='تمت مشاركة الموقع ✓ · دقة تقريبية '+Math.round(accuracy_m)+' متر';$('locationLink').href='https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lng+'#map=17/'+lat+'/'+lng;$('locationLink').hidden=false;});
async function refresh(){const first=!me;me=await call('me');$('balance').textContent=Number(me.balance).toLocaleString('en-US');renderDebt();$('agentName').textContent=me.name;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('walletCard').hidden=false;$('authBack').hidden=true;if(first)await showPage('activate');}
async function loadAccount(){const a=await rpc('account');authenticated=true;if(a.needs_registration){setMode('complete');$('personalName').value=a.personal_name||'';$('loginPhone').value=phone(a.personal_phone);$('logout').hidden=false;return;}await refresh();}
$('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const creating=mode!=='login',data=creating?registrationData():null;if(mode==='register'&&$('loginPin').value!==$('confirmPassword').value)problem('كلمتا السر مو متطابقتين.');if(mode!=='complete'){const r=await phoneAuth({op:mode==='register'?'register':'login',name:$('personalName').value.trim(),phone:$('loginPhone').value,password:$('loginPin').value,privacy_version:$('privacy').checked?'2026-10-11':null});$('loginPin').value='';$('confirmPassword').value='';const result=await db.auth.refreshSession({refresh_token:r.refresh_token});if(result.error)throw result.error;authenticated=true;sessionStorage.removeItem('tkt-exchange-token');token=null;if(creating)setMode('complete');}if(creating){const verified=await rpc('account');const verifiedPhone=normalizeIraqiPhone(verified.personal_phone);if(!verifiedPhone)problem('تعذّر التحقق من رقم الحساب. سجّل الدخول من جديد.');data.personal_phone=verifiedPhone;$('loginPhone').value=phone(verifiedPhone);await rpc('register',data);await refresh();notice('تم إنشاء حساب الصيرفة. الرصيد الحالي صفر؛ تواصل ويا الإدارة للشحن.');}else{await loadAccount();notice('تم تسجيل الدخول.');}});};
$('logout').onclick=()=>run(async()=>{if(token)await call('logout');await db.auth.signOut();sessionStorage.removeItem('tkt-exchange-token');location.reload();});
$('forgot').onclick=()=>{$('recovery').hidden=false;$('recovery').scrollIntoView({behavior:'smooth'});};
$('startRecovery').onclick=()=>run(async()=>{recoverySession=await phoneAuth({op:'recovery_create',phone:$('loginPhone').value,name:$('personalName').value.trim()});sessionStorage.setItem('tkt-exchange-recovery',JSON.stringify(recoverySession));$('recoveryChat').hidden=false;await recoveryMessages();});
async function recoveryMessages(){if(!recoverySession)return;const r=await phoneAuth({op:'recovery_read',...recoverySession});renderMessages(r.messages||[],$('recoveryMessages'));}
let recoveryMessageId=null;$('recoveryBody').oninput=()=>recoveryMessageId=null;$('recoveryForm').onsubmit=e=>{e.preventDefault();run(async()=>{recoveryMessageId??=crypto.randomUUID();const r=await phoneAuth({op:'recovery_send',...recoverySession,message_id:recoveryMessageId,body:$('recoveryBody').value});renderMessages(r.messages||[],$('recoveryMessages'));$('recoveryBody').value='';recoveryMessageId=null;});};
$('refresh').onclick=()=>run(refresh);
async function showPage(name){
 closeMenu();
 if(!me&&!['about','qr'].includes(name)){
  page='activate';$('workspace').hidden=true;$('login').hidden=false;$('authBack').hidden=true;$('title').textContent='دخول حساب الصيرفة';
  if(name==='support'){$('recovery').hidden=false;notice('للاستفسار عن حسابك، افتح محادثة الدعم من الأسفل.');}else notice('سجّل الدخول حتى تفتح التفعيل والمعاملات الخاصة بصيرفتك.');
  $('login').scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 page=name;$('workspace').hidden=false;$('login').hidden=true;$('walletCard').hidden=!me;$('authBack').hidden=Boolean(me);
 for(const item of document.querySelectorAll('.page'))item.hidden=item.id!==name;
 for(const b of document.querySelectorAll('nav button'))b.classList.toggle('selected',b.dataset.page===name);
 $('title').textContent={activate:'تفعيل اشتراك',transactions:'المعاملات والتحويلات',settlements:'التسديد والذمة',support:'دعم الصيرفات',about:'حول الشركة',qr:'باركود البوابة'}[name];notice('');
 if(name==='settlements')await settlements();if(name==='transactions')await transactions();if(name==='support')await messages();
}
$('authBack').onclick=()=>run(()=>showPage('activate'));
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>run(()=>showPage(b.dataset.page));
function resetCaptain(){captain=null;pending=null;$('captainBox').hidden=true;$('receipt').hidden=true;}
$('captainPhone').oninput=resetCaptain;
$('searchForm').onsubmit=e=>{e.preventDefault();run(async()=>{resetCaptain();const ph=normalizeIraqiPhone($('captainPhone').value);if(!ph)problem('اكتب رقم هاتف الكابتن العراقي بصورة صحيحة.');captain=await call('lookup',{phone:ph});$('captainName').textContent=captain.name;$('captainNumber').textContent=phone(captain.phone);$('expiry').textContent='نهاية الاشتراك الحالي: '+date(captain.expires_at);$('captainBox').hidden=false;notice('تحقق من اسم الكابتن ورقمه قبل المتابعة.');});};
function updatePlan(){pending=null;const w=Number($('weeks').value);$('total').textContent=Number.isInteger(w)&&w>=1&&w<=52?money(w*5000):'حدد مدة صحيحة';for(const b of document.querySelectorAll('[data-weeks]'))b.classList.toggle('chosen',Number(b.dataset.weeks)===w);}
for(const b of document.querySelectorAll('[data-weeks]'))b.onclick=()=>{$('weeks').value=b.dataset.weeks;updatePlan();};$('weeks').oninput=updatePlan;
$('review').onclick=()=>run(async()=>{const w=Number($('weeks').value);if(!captain||!Number.isInteger(w)||w<1||w>52)throw new Error('INVALID_WEEKS');await refresh();if(me.balance<w*5000)throw new Error('INSUFFICIENT_BALANCE');if(!pending)pending={id:crypto.randomUUID(),phone:captain.phone,captain_id:captain.id,weeks:w};$('confirmationDetails').replaceChildren(el('h3',captain.name),el('p',phone(captain.phone)),el('p',`${w} أسبوع — ${w*7} يوم`),el('h3',money(w*5000)),el('p','الرصيد بعد الخصم: '+money(me.balance-w*5000)));$('confirmation').showModal();});
$('edit').onclick=()=>$('confirmation').close();
$('confirm').onclick=()=>run(async()=>{if(!pending)return;const receipt=await call('activate',pending);$('confirmation').close();$('captainBox').hidden=true;$('receipt').hidden=false;$('receipt').replaceChildren(el('h2','✓ تم تفعيل الاشتراك بنجاح'),el('p',captain.name+' · '+phone(captain.phone)),el('p',`${receipt.weeks} أسبوع · ${money(receipt.amount)}`),el('p','الاشتراك حتى: '+date(receipt.expires_at)),el('p','رقم المعاملة: '+receipt.id));pending=null;await refresh();notice('تم الخصم وتفعيل الاشتراك.');});

function renderDebt(){
 $('walletDue').textContent=money(me.due);
 $('currentDue').textContent=money(me.due);$('totalSpent').textContent=money(me.spent);$('totalSettled').textContent=money(me.settled);
 $('dueStatus').textContent=Number(me.due)>0?'هذا المبلغ المطلوب تسديده للشركة.':Number(me.spent)>0?'✓ ذمّتك مصفّرة حاليًا.':'ما عندك مبالغ بذمّتك.';
 $('lastPayment').textContent=me.last_payment_at?date(me.last_payment_at):'ماكو تسديد مسجّل بعد';
 $('lastCleared').textContent=me.last_cleared_at?date(me.last_cleared_at):'ماكو عملية تصفير مسجّلة بعد';
}
async function settlements(more=false){
 await refresh();
 const rows=await call('settlements',{offset:more?settlementRows.length:0});settlementRows=more?[...settlementRows,...rows]:rows;
 const box=$('settlementList');box.replaceChildren();if(!settlementRows.length)box.append(el('p','ماكو تسديدات مسجّلة لحد الآن.'));
 for(const s of settlementRows){const row=el('article',null,'record');row.append(el('strong',(Number(s.due_after)===0?'✓ تسديد وتصفير الذمّة — ':'تسديد جزئي — ')+money(s.amount)),el('p','وقت تسجيل الاستلام: '+date(s.created_at)),el('p','الذمّة قبل التسديد: '+money(s.due_before)),el('p','المتبقّي بعد التسديد: '+money(s.due_after)));if(s.note)row.append(el('p',s.note));row.append(el('small','رقم الوصل: '+s.id));box.append(row);}
 $('moreSettlements').hidden=rows.length<100;
}
$('openDebt').onclick=()=>run(()=>showPage('settlements'));
$('reloadSettlements').onclick=()=>run(()=>settlements());
$('moreSettlements').onclick=()=>run(()=>settlements(true));
setInterval(()=>{if(me&&!document.hidden&&!document.body.dataset.busy)run(()=>page==='settlements'?settlements():refresh());},30000);

async function transactions(more=false){const rows=await call('transactions',{offset:more?transactionRows.length:0});transactionRows=more?[...transactionRows,...rows]:rows;renderTransactions(transactionRows,$('transactionList'));$('moreTransactions').hidden=rows.length<100;}async function messages(){renderMessages(await call('messages'),$('messages'));}
$('reloadTransactions').onclick=()=>run(()=>transactions());$('moreTransactions').onclick=()=>run(()=>transactions(true));
let messageId=null;$('messageBody').oninput=()=>messageId=null;
$('messageForm').onsubmit=e=>{e.preventDefault();run(async()=>{messageId??=crypto.randomUUID();renderMessages(await call('send',{body:$('messageBody').value,id:messageId}),$('messages'));$('messageBody').value='';messageId=null;});};
setInterval(()=>{if(me&&page==='support'&&!document.hidden&&!document.body.dataset.busy)messages().catch(()=>{});},7000);
run(async()=>{try{recoverySession=JSON.parse(sessionStorage.getItem('tkt-exchange-recovery'));}catch{}if(recoverySession){$('recovery').hidden=false;$('recoveryChat').hidden=false;await recoveryMessages().catch(()=>{});}const{data}=await db.auth.getSession();if(data.session)await loadAccount();else if(token)await refresh();});
setInterval(()=>{if(recoverySession&&!$('recovery').hidden&&!document.hidden&&!document.body.dataset.busy)recoveryMessages().catch(()=>{});},7000);
