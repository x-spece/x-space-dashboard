import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';
const db=createClient('https://typbkzwbrmkrfkfxjrgi.supabase.co','sb_publishable_Oto-5IRPHgWceHq_uzrsiw_JBBZbAOT',{auth:{storageKey:'taktooka-web-admin'}});
const $=id=>document.getElementById(id);const status=text=>$('status').textContent=text;
const governorates=['بغداد','البصرة','نينوى','أربيل','السليمانية','دهوك','حلبجة','كركوك','ديالى','الأنبار','صلاح الدين','بابل','كربلاء','النجف','واسط','القادسية','ذي قار','ميسان','المثنى'];
for(const name of governorates){const option=document.createElement('option');option.textContent=name;$('governorate').append(option)}
let zones=[],settings={},map,overlay,points=[],drawing=false,editing=null,busy=false;
function message(error){if(String(error?.message).includes('ADMIN_REQUIRED'))return 'هذا الحساب ليس حساب إدارة';if(String(error?.message).includes('SEARCH_IN_PROGRESS'))return 'توجد طلبات قيد البحث؛ انتظر انتهاءها ثم احفظ';return error?.message||'تعذر تنفيذ العملية، حاول مرة ثانية'}
async function rpc(action,data={}){const {data:result,error}=await db.rpc('tkt_dispatch',{p_action:action,p_data:data});if(error)throw error;return result}
function render(){ $('zones').replaceChildren();overlay.clearLayers();for(const zone of zones){const row=document.createElement('div');row.className='zone';const name=document.createElement('strong');name.textContent=zone.name;const controls=document.createElement('div');const edit=document.createElement('button');edit.textContent='تعديل الحدود';edit.onclick=()=>{editing=zone.id;$('name').value=zone.name;points=zone.geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>[lat,lng]);drawing=true;preview();map.fitBounds(points);status('تعديل المنطقة: اضغط على الخريطة لإضافة نقاط، ثم اعتماد المنطقة')};const remove=document.createElement('button');remove.className='secondary';remove.textContent='حذف';remove.onclick=()=>{if(confirm('إزالة هذه المنطقة من التغطية؟')){zones=zones.filter(z=>z.id!==zone.id);render();status('التغيير لم يُحفظ بعد')}};controls.append(edit,remove);row.append(name,controls);$('zones').append(row);L.polygon(zone.geometry.coordinates[0].map(([lng,lat])=>[lat,lng]),{color:'#d91e27',weight:2}).addTo(overlay)}}
let draft;function preview(){if(draft)map.removeLayer(draft);draft=L.polygon(points,{color:'#e5a600',dashArray:'5 5'}).addTo(map);$('hint').textContent=`عدد نقاط الحدود: ${points.length}`}
function initMap(){if(map)return;map=L.map('map').setView([33.54844,44.41179],14);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);overlay=L.layerGroup().addTo(map);map.on('click',e=>{if(drawing){points.push([e.latlng.lat,e.latlng.lng]);preview()}})}
async function load(){settings=await rpc('settings');zones=structuredClone(settings.zones);$('login').hidden=true;$('admin').hidden=false;document.body.classList.add('signed-in');$('logout').hidden=false;initMap();setTimeout(()=>map.invalidateSize(),0);$('search').value=settings.search_s;$('eta').value=settings.max_eta_s/60;$('stale').value=settings.stale_s;render();await loadPricing();await loadOverview();showPage('overview');startLive();await startNotifications();status('تم تحميل لوحة إدارة تكتوكة')}
async function run(action){if(busy)return;busy=true;document.getElementById('admin').setAttribute('aria-busy','true');try{await action()}catch(e){status(message(e))}finally{busy=false;document.getElementById('admin').removeAttribute('aria-busy')}}
$('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const {data,error}=await db.functions.invoke('taktooka-admin-login',{body:{phone:$('phone').value.trim(),pin:$('pin').value}});$('pin').value='';if(error||!data?.refresh_token)throw error||new Error('بيانات الدخول غير صحيحة');const session=await db.auth.refreshSession({refresh_token:data.refresh_token});if(session.error)throw session.error;await load()})};
$('draw').onclick=()=>{drawing=true;editing=null;points=[];preview();status('انقر حول المنطقة لرسم حدود مغلقة، ثم اعتماد المنطقة')};$('undo').onclick=()=>{points.pop();preview()};
$('finish').onclick=()=>{if(points.length<3)return status('حدد ثلاث نقاط على الأقل');const name=$('name').value.trim();if(!name)return status('اكتب اسم المنطقة');if(points.some(([lat,lng])=>lat<29||lat>38||lng<38||lng>49))return status('المنطقة يجب أن تكون داخل العراق');const ring=points.map(([lat,lng])=>[lng,lat]);ring.push([...ring[0]]);const zone={id:editing||`zone_${crypto.randomUUID().slice(0,8)}`,name:editing?name:`${$('governorate').value} — ${name}`,geometry:{type:'Polygon',coordinates:[ring]}};zones=zones.filter(z=>z.id!==zone.id);zones.push(zone);drawing=false;points=[];if(draft)map.removeLayer(draft);render();status('تم اعتماد المنطقة محليًا؛ اضغط حفظ التغييرات لتفعيلها بالتطبيق')};
$('save').onclick=()=>run(async()=>{if(!zones.length)throw new Error('أضف منطقة خدمة واحدة على الأقل');if(drawing)throw new Error('اعتمد حدود المنطقة قبل الحفظ');await manage('dispatch_configure',{zones,search_s:Number($('search').value),max_eta_s:Number($('eta').value)*60,stale_s:Number($('stale').value)});await load();showPage('coverage');status('تم حفظ وتفعيل مناطق الخدمة بالتطبيق: '+zones.map(z=>z.name).join('، '))});$('reload').onclick=()=>run(load);$('logout').onclick=()=>run(async()=>{stopLive();await stopNotifications();closeDetail();await db.auth.signOut();$('admin').hidden=true;document.body.classList.remove('signed-in');setMenu(false);$('login').hidden=false;$('logout').hidden=true;zones=[];rides=[];users=[];$('rideList').replaceChildren();$('userList').replaceChildren();status('تم تسجيل الخروج')});


let pricing,tiers=[],rides=[],users=[];
const priceKeys=['night_amount','night_min_m','night_start','night_end','overflow_step_m','overflow_amount','max_fare'];
function localPhone(v){const d=String(v??'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[^0-9]/g,'');return /^9647[0-9]{9}$/.test(d)?'0'+d.slice(3):/^7[0-9]{9}$/.test(d)?'0'+d:d;}
const money=n=>new Intl.NumberFormat('en-US').format(n)+' د.ع';
const stateNames={pending:'قيد البحث',accepted:'الكابتن بالطريق',arrived:'وصل الكابتن',in_progress:'الرحلة جارية',completed:'مكتملة',cancelled:'ملغية'};
async function pricingRpc(action,data={}){const {data:result,error}=await db.rpc('tkt_pricing',{p_action:action,p_data:data});if(error){if(error.message.includes('PRICING_CONFLICT'))throw new Error('التسعيرة تغيّرت من جلسة ثانية؛ أعد تحميلها قبل الحفظ');throw error}return result}
function priceNotice(){const bad=tiers.some((t,i)=>i&&t.fare<tiers[i-1].fare);$('priceWarning').hidden=!bad;$('priceWarning').textContent='انتبه: كروة إحدى الشرائح أقل من الشريحة السابقة. راجع الأسعار قبل الحفظ.'}
function renderTiers(){const body=$('tiers');body.replaceChildren();tiers.forEach((tier,i)=>{const tr=document.createElement('tr');const from=document.createElement('td');from.textContent=i?String(tiers[i-1].up_to_m):'0';tr.append(from);for(const key of ['up_to_m','fare']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=key==='up_to_m'?'1':'0';input.max=key==='up_to_m'?'100000':'1000000';input.value=tier[key];input.setAttribute('aria-label',key==='fare'?'الكروة بالدينار':'نهاية المسافة بالمتر');input.oninput=()=>{tier[key]=Number(input.value);priceNotice();[...body.children].forEach((row,j)=>row.firstChild.textContent=j?String(tiers[j-1].up_to_m):'0')};td.append(input);tr.append(td)}const td=document.createElement('td'),remove=document.createElement('button');remove.className='secondary';remove.textContent='حذف';remove.onclick=()=>{tiers.splice(i,1);renderTiers()};td.append(remove);tr.append(td);body.append(tr)});priceNotice()}
async function loadPricing(){pricing=await pricingRpc('get');tiers=structuredClone(pricing.tiers);for(const key of priceKeys)$(key).value=pricing[key];$('priceMeta').textContent=`إصدار التسعيرة ${pricing.revision} · آخر تعديل ${new Date(pricing.updated_at).toLocaleString('ar-IQ')}`;renderTiers();$('previewResult').textContent=''}
function pricingInput(){const data={tiers,expected_revision:pricing.revision};let previous=0;if(!tiers.length||tiers.length>30)throw new Error('أضف من شريحة واحدة إلى 30 شريحة');for(const t of tiers){if(!Number.isInteger(t.up_to_m)||t.up_to_m<=previous||t.up_to_m>100000||!Number.isInteger(t.fare)||t.fare<0||t.fare>1000000)throw new Error('رتب المسافات تصاعديًا وأدخل أسعارًا صحيحة');previous=t.up_to_m}for(const k of priceKeys){data[k]=Number($(k).value);if(!Number.isInteger(data[k])||data[k]<0)throw new Error('أدخل أرقامًا صحيحة في إعدادات التسعيرة')}if(data.night_start>23||data.night_end>23||data.overflow_step_m<1)throw new Error('تحقق من ساعات الليل والمسافة الإضافية');return data}
$('addTier').onclick=()=>{if(tiers.length>=30)return status('الحد الأقصى 30 شريحة');tiers.push({up_to_m:(tiers.at(-1)?.up_to_m||0)+1000,fare:tiers.at(-1)?.fare||500});renderTiers()};
$('savePricing').onclick=()=>run(async()=>{const data=pricingInput();await manage('pricing_save',data);await loadPricing();status('تم حفظ التسعيرة وتفعيلها للمشاوير الجديدة')});
$('reloadPricing').onclick=()=>run(loadPricing);
$('previewFare').onclick=()=>run(async()=>{const distance=Number($('previewDistance').value);if(!Number.isFinite(distance)||distance<=0)throw new Error('أدخل مسافة موجبة');const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Baghdad'});const at=`${day}T${$('previewTime').value==='night'?'23':'12'}:00:00+03:00`;const result=await pricingRpc('preview',{distance_m:distance,at});$('previewResult').textContent=`${money(result.fare)} — أساس ${money(result.base_fare)} + ليل ${money(result.night_surcharge)}`});
let activePage='overview';
function showPage(name){if(dialogMode==='chat')closeDetail();setMenu(false);activePage=name;const selected=document.querySelector(`[data-page="${name}"]`);if(selected)$('pageTitle').textContent=selected.textContent;document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='page-'+name);document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('selected',el.dataset.page===name));if(name==='coverage'&&map)setTimeout(()=>map.invalidateSize(),0)}
function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el}


async function manage(action,data={}){
 const {data:result,error}=await db.rpc('tkt_manage',{p_action:action,p_data:data});
 if(error)throw error;return result;
}
const actionNames={user_edit:'تعديل الحساب',role:'تغيير نوع الحساب',renew:'تجديد الاشتراك',block:'تغيير الحظر',subscription_edit:'تعديل نهاية الاشتراك',topup:'شحن محفظة',settle:'تسديد مستحقات',coupon_admin:'حفظ كود خصم',coupon_delete:'حذف كود خصم',favorite_edit:'تعديل عنوان',favorite_delete:'حذف عنوان',ride_cancel:'إلغاء رحلة',recovery_send:'رد استرجاع الحساب',send:'رد الدعم',unlock_phone:'فتح محاولات الدخول',password_reset_record:'تعيين كلمة سر',archive:'أرشفة',restore:'استرجاع',pricing_save:'تعديل التسعيرة',dispatch_configure:'تعديل التغطية والتوزيع',application_reject:'رفض طلب كابتن',captain_approved:'الموافقة على تسجيل المركبة',captain_changes_required:'إعادة تسجيل المركبة للتعديل'};
const archiveNames={user:'حساب',ride:'رحلة',support:'دردشة دعم',recovery:'استرجاع حساب'};
const ledgerNames={topup:'شحن',settle:'تسديد مستحقات',ride_payment:'دفع مشوار',refund:'استرجاع مبلغ',captain_earning:'أرباح كابتن'};
const dates=value=>value?new Date(value).toLocaleString('ar-IQ',{timeZone:'Asia/Baghdad'}):'—';
const activeStates=['pending','accepted','arrived','in_progress'];
let liveMap,liveLayers,liveChannel,liveTimer,liveEventTimer,lastLiveRefresh=0,refreshing=false,serverTime=Date.now(),captains=[];const liveCaptainMarkers=new Map();
let dialogMap,dialogLayer,dialogMode=null,dialogKey=null,dialogEpoch=0,dialogRefreshing=false,chatSignature=null,finance={},favorites=[],security=[],audit=[],archives=[],recovery=[],openLedger=null;
function button(label,fn,cls='secondary'){const el=text('button',label);el.type='button';el.className=cls;el.onclick=()=>run(fn);return el}
function facts(entries){const dl=text('dl','');dl.className='facts';for(const [label,value]of entries){const item=text('div','');item.append(text('dt',label),text('dd',value??'—'));dl.append(item)}return dl}
function record(title,subtitle,controls=[]){const row=text('article','');row.className='record';const info=text('div','');info.append(text('strong',title),Array.isArray(subtitle)?facts(subtitle):text('p',subtitle));const actions=text('div','');actions.className='controls';actions.append(...controls);row.append(info,actions);return row}
function empty(list){if(!list.childElementCount)list.append(Object.assign(text('p','ماكو بيانات حالياً'),{className:'empty'}))}
function inputField(label,value,type='text'){const box=text('label',label),input=document.createElement('input');input.type=type;input.value=value??'';box.append(input);return {box,input}}
function openDetail(title){closeDetail();$('detailTitle').textContent=title;$('detailBody').replaceChildren();$('detailDialog').showModal();return $('detailBody')}
function closeDetail(){if(!$('chatScreen').hidden){$('chatScreen').hidden=true;document.body.classList.remove('chat-open');$('chatWorkspace').replaceChildren();}dialogEpoch++;dialogMode=null;dialogKey=null;chatSignature=null;if(dialogMap){dialogMap.remove();dialogMap=null;dialogLayer=null}if($('detailDialog').open)$('detailDialog').close()}
$('closeDialog').onclick=closeDetail;$('detailDialog').addEventListener('cancel',closeDetail);
function mapFor(id){const m=L.map(id).setView([33.54844,44.41179],14);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);return m}
function fresh(p){return !!p.location_at && Math.max(0,serverTime-Date.parse(p.location_at))<=15000}
function locationLabel(p){const age=p.location_at?Math.max(0,Math.floor((serverTime-Date.parse(p.location_at))/1000)):null;return age===null?'لم يصل موقع':age<=15?'مباشر · قبل '+age+' ثانية':'متأخر · قبل '+age+' ثانية'}
function captainMarker(p){return L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:`<div class="map-marker ${fresh(p)?'':'muted-marker'}"></div>`,iconSize:[20,20]})}).bindPopup(text('span',`${p.name||'كابتن'} · ${locationLabel(p)} · ${dates(p.location_at)}`))}
async function loadOverview(){
 const stats=await manage('overview');serverTime=Date.parse(stats.server_now);const snapshot=await liveSnapshot();stats.applications=snapshot.pending_applications??stats.applications;stats.online=snapshot.captains.filter(fresh).length;
 $('metrics').replaceChildren();for(const [label,key]of [['مستخدم','users'],['كابتن','captains'],['كابتن موقعه مباشر','online'],['رحلة فعالة','active_rides'],['رحلة اليوم','today_rides'],['قيمة الرحلات المكتملة اليوم','today_completed'],['طلب كابتن','applications']]){const box=text('div',label);box.className='metric';box.prepend(text('strong',key==='today_completed'?money(stats[key]):String(stats[key])));$('metrics').append(box)}
 $('workerStatus').textContent=`آخر تحديث توزيع: ${dates(stats.worker?.heartbeat)}${stats.worker?.last_error?' · تنبيه في توزيع الطلبات':''}`;
 captains=snapshot.captains;
 if(!liveMap){liveMap=mapFor('liveMap');liveLayers=L.layerGroup().addTo(liveMap)}
 $('liveCaptains').replaceChildren();const seenCaptains=new Set();
 for(const p of captains){if(Number.isFinite(p.lat)&&Number.isFinite(p.lng)){seenCaptains.add(p.user_id);let marker=liveCaptainMarkers.get(p.user_id);if(marker){marker.setLatLng([p.lat,p.lng]);marker.bindPopup(text('span',`${p.name||'كابتن'} · ${locationLabel(p)} · ${dates(p.location_at)}`));if(marker.setIcon)marker.setIcon(L.divIcon({className:'',html:`<div class="map-marker ${fresh(p)?'':'muted-marker'}"></div>`,iconSize:[20,20]}))}else{marker=captainMarker(p).addTo(liveLayers);liveCaptainMarkers.set(p.user_id,marker)}}$('liveCaptains').append(record(p.name||'كابتن',[['الهاتف',localPhone(p.phone)],['الموقع',locationLabel(p)],['آخر تحديث',dates(p.location_at)],['حالة العمل',p.ride_id?'في رحلة · '+(stateNames[p.ride_status]||p.ride_status):p.in_service===false?'خارج منطقة الخدمة':fresh(p)?'متاح لاستقبال رحلة':'الموقع متأخر؛ تحقق من الاتصال'],['الرحلة',p.ride_id||'—']],[button('إظهار على الخريطة',async()=>{if(p.lat!=null&&p.lng!=null)liveMap.setView([p.lat,p.lng],17)})]))}empty($('liveCaptains'));
 for(const [id,marker]of liveCaptainMarkers)if(!seenCaptains.has(id)){if(liveLayers.removeLayer)liveLayers.removeLayer(marker);liveCaptainMarkers.delete(id)}
 if(activePage==='overview')setTimeout(()=>liveMap.invalidateSize(),0);
}
async function liveSnapshot(){const {data,error}=await db.rpc('tkt_admin_live');if(error)throw error;return data}
function stopLive(){if(liveChannel){db.removeChannel(liveChannel);liveChannel=null}clearInterval(liveTimer);clearTimeout(liveEventTimer);liveEventTimer=null;liveTimer=null;$('liveStatus').textContent='غير متصل'}
async function backgroundRefresh(){if(refreshing||busy||document.hidden||$('admin').hidden)return;refreshing=true;lastLiveRefresh=Date.now();try{
 if(dialogMode==='track')await updateTrack();else if(dialogMode==='chat')await updateChat();
 else if(['overview','rides','support','security','applications'].includes(activePage))await loadPage(activePage);
 if(!liveChannel)$('liveStatus').textContent='تحديث دوري';
}catch(e){status(message(e));$('liveStatus').textContent='تعذّر التحديث'}finally{refreshing=false}}
function scheduleLiveRefresh(){if(liveEventTimer)return;liveEventTimer=setTimeout(()=>{liveEventTimer=null;backgroundRefresh()},Math.max(0,1000-(Date.now()-lastLiveRefresh)))}
function startLive(){stopLive();liveChannel=db.channel('taktooka-dashboard-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'tkt_profiles'},()=>scheduleLiveRefresh()).on('postgres_changes',{event:'*',schema:'public',table:'tkt_rides'},()=>scheduleLiveRefresh()).on('postgres_changes',{event:'*',schema:'public',table:'tkt_messages'},()=>scheduleLiveRefresh()).subscribe(value=>{$('liveStatus').textContent=value==='SUBSCRIBED'?'متصل مباشرة':'تحديث دوري'});liveTimer=setInterval(backgroundRefresh,2500)}
async function loadRides(more=false){const data=await manage('rides',{offset:more?rides.length:0,limit:200,status:$('rideStatus').value,search:$('rideSearch').value.trim()});rides=more?[...rides,...data]:data;renderRides();$('moreRides').disabled=data.length<200}
function renderRides(){const list=$('rideList');list.replaceChildren();$('rideCount').textContent=`${rides.length} رحلة معروضة`;for(const r of rides){const controls=[button('التفاصيل والتتبع',()=>trackRide(r.id))];if(['pending','accepted','arrived'].includes(r.status))controls.push(button('إلغاء الرحلة',async()=>{if(confirm('إلغاء الرحلة ورد مبلغ المحفظة حسب النظام؟')){await manage('ride_cancel',{id:r.id});await loadRides()}},'danger'));if(!activeStates.includes(r.status))controls.push(button('أرشفة الرحلة',()=>archive('ride',r.id),'danger'));list.append(record(`${r.pickup_name||'انطلاق محدد'} ← ${r.destination_name||'وجهة محددة'}`,[['الحالة',stateNames[r.status]||r.status],['الكروة',money(r.fare)],['الدفع',r.payment_method==='wallet'?'دفع من المحفظة':'دفع كاش'],['الزبون',`${r.rider_name||'—'} · ${localPhone(r.rider_phone)}`],['الكابتن',r.captain_name||'لم يُحدد'],['إنشاء الرحلة',dates(r.created_at)],['مرجع الرحلة',r.id]],controls))}empty(list)}
async function trackRide(id){const body=openDetail('تفاصيل الرحلة والتتبع');dialogMode='track';dialogKey=id;body.append(Object.assign(text('div',''),{id:'rideTrackMap',className:'admin-map'}),Object.assign(text('div',''),{id:'rideTrackInfo'}),Object.assign(text('div',''),{id:'rideOffers'}));dialogMap=mapFor('rideTrackMap');dialogLayer=L.layerGroup().addTo(dialogMap);await updateTrack(true)}
async function updateTrack(fit=false){if(dialogRefreshing||dialogMode!=='track')return;dialogRefreshing=true;const epoch=dialogEpoch,id=dialogKey;try{const result=await manage('track',{id});if(epoch!==dialogEpoch||dialogMode!=='track')return;serverTime=Date.parse(result.server_now);const r=result.ride,p=result.captain;dialogLayer.clearLayers();const bounds=[];if(r.geometry){const line=L.geoJSON(r.geometry,{style:{color:'#d92527',weight:5}}).addTo(dialogLayer);bounds.push(...line.getBounds().isValid()?[line.getBounds().getSouthWest(),line.getBounds().getNorthEast()]:[])}for(const [point,label]of[[r.pickup,'الانطلاق'],[r.destination,'الوصول']])if(Array.isArray(point)){L.circleMarker(point,{radius:8,color:'#d92527',fillOpacity:1}).bindPopup(text('span',label)).addTo(dialogLayer);bounds.push(point)}if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)){captainMarker(p).addTo(dialogLayer);bounds.push([p.lat,p.lng])}
 if(fit&&bounds.length)dialogMap.fitBounds(bounds,{padding:[30,30],maxZoom:17});
 $('rideTrackInfo').replaceChildren(facts([['مرجع الرحلة',r.id],['الحالة',stateNames[r.status]||r.status],['الانطلاق',r.pickup_name||'نقطة محددة'],['الوجهة',r.destination_name||'نقطة محددة'],['الكروة',money(r.fare)],['الخصم',money(r.discount||0)],['المطلوب من الزبون',money(r.customer_due??r.fare)],['طريقة الدفع',r.payment_method==='wallet'?'دفع من المحفظة':'دفع كاش'],['مسافة الطريق',((r.distance_m||0)/1000).toFixed(2)+' كم'],['مدة الطريق المقدرة',Math.ceil((r.duration_s||0)/60)+' دقيقة'],['إنشاء الرحلة',dates(r.created_at)],['آخر تعديل',dates(r.updated_at)]]),p?facts([['الكابتن',p.name],['هاتف الكابتن',localPhone(p.phone)],['تحديث الموقع',locationLabel(p)],['آخر موقع GPS',dates(p.location_at)]]):text('p','لم يوافق كابتن بعد'));

 $('rideOffers').replaceChildren(text('h3','عروض توزيع الطلب'));for(const o of result.offers)$('rideOffers').append(text('p',`${o.captain_name||o.captain_id} · ${localPhone(o.captain_phone)} · وصول مقدر ${o.eta_s==null?"—":Math.ceil(o.eta_s/60)+" دقيقة"} · ${{offered:'بانتظار الرد',accepted:'تم القبول',expired:'انتهت المهلة',rejected:'مرفوض',cancelled:'ملغي'}[o.status]||o.status} · أنشئ ${dates(o.created_at)} · ينتهي ${dates(o.expires_at)} · المتبقي ${Math.max(0,Math.min(30,Math.ceil((Date.parse(o.expires_at)-serverTime)/1000)))||0} ثانية`));
 }finally{dialogRefreshing=false}}
async function loadUsers(more=false){const data=await manage('users',{offset:more?users.length:0,limit:200,search:$('userSearch').value.trim()});users=more?[...users,...data]:data;renderUsers();$('moreUsers').disabled=data.length<200}
async function userAction(action,data){await manage(action,data);await loadUsers();status('تم تحديث الحساب')}
function renderUsers(){$('userList').replaceChildren();for(const u of users){const controls=[button('تعديل البيانات',()=>editUser(u)),button('المحفظة والسجل',()=>ledger(u)),button('تعيين كلمة سر',()=>resetPassword(u))];if(!u.admin){controls.push(button(u.captain?'إلغاء صلاحية كابتن':'تفعيل كابتن',async()=>{if(confirm('تأكيد تغيير نوع الحساب؟'))await userAction('role',{user_id:u.user_id,captain:!u.captain})}),button(u.blocked?'رفع الحظر':'حظر',async()=>{if(confirm('تأكيد تغيير الحظر؟'))await userAction('block',{user_id:u.user_id,blocked:!u.blocked})}),button('أرشفة الحساب',()=>archive('user',u.user_id),'danger'));if(u.captain)controls.push(button('تجديد 7 أيام — 5,000 د.ع',async()=>{if(confirm('تأكيد تسجيل دفعة وتجديد الاشتراك؟'))await userAction('renew',{user_id:u.user_id,payment_id:crypto.randomUUID()})}),button('تعديل انتهاء الاشتراك',()=>editSubscription(u)))}$('userList').append(record(u.name||'بدون اسم',[['الهاتف',localPhone(u.phone)],['نوع الحساب',u.admin?'إدارة':u.captain?'كابتن':'زبون'],['الحساب',u.blocked?'محظور':'فعال'],['استقبال الطلبات',u.captain?(u.online?'مفعّل':'متوقف'):'—'],['الاشتراك',u.captain?dates(u.expires_at):'—']],controls))}empty($('userList'))}
function editUser(u){const body=openDetail('تعديل بيانات الحساب'),name=inputField('الاسم الكامل',u.name),phone=inputField('رقم الهاتف',localPhone(u.phone),'tel');body.append(name.box,phone.box,button('حفظ',async()=>{await manage('user_edit',{user_id:u.user_id,name:name.input.value,phone:phone.input.value});closeDetail();await loadUsers();status('تم حفظ البيانات')}))}
function editSubscription(u){const body=openDetail('تعديل نهاية الاشتراك'),expiry=inputField('نهاية الاشتراك بتوقيت بغداد',toLocal(u.expires_at),'datetime-local');body.append(expiry.box,button('حفظ',async()=>{await manage('subscription_edit',{user_id:u.user_id,expires_at:baghdadISO(expiry.input.value)});closeDetail();await loadUsers()}))}
function toLocal(date){return date?new Date(Date.parse(date)+3*3600000).toISOString().slice(0,16):''}
function baghdadISO(value){if(!value)throw new Error('حدد التاريخ والوقت');return new Date(value+'+03:00').toISOString()}
async function archive(kind,id){if(!confirm(kind==='user'?'إيقاف الحساب وإزالته من القائمة؟ تبقى سجلات الرحلات والأموال محفوظة.':'أرشفة وإزالة هذا السجل من القائمة؟ يمكن استرجاعه من الأرشيف.'))return;await manage('archive',{kind,entity_id:id});closeDetail();await loadPage(activePage);status('تمت الأرشفة')}
async function loadFinance(){finance=await manage('finance');renderWallets();renderCoupons()}
function renderWallets(){const list=$('walletList');list.replaceChildren();const search=$('walletSearch').value.trim();for(const u of (finance.wallets||[]).filter(u=>`${u.name} ${localPhone(u.phone)}`.includes(search))){const controls=[button('شحن المحفظة',()=>moneyAction(u,'topup')),button('كشف الحساب',()=>ledger(u))];if(u.captain)controls.push(button('تسديد مستحقات الكابتن',()=>moneyAction(u,'settle')));if(u.captain_requested_at)controls.push(button('مراجعة تسجيل المركبة',async()=>{showPage('applications');await loadApplications()}));list.append(record(u.name||u.phone,[['الهاتف',localPhone(u.phone)],['نوع الحساب',u.captain?'كابتن':'زبون'],[u.captain?'مستحقات الكابتن':'رصيد المحفظة',money(u.balance||0)],['طلب تسجيل كابتن',dates(u.captain_requested_at)]],controls))}empty(list)}
function moneyAction(u,op){const body=openDetail(op==='topup'?'شحن محفظة':'تسجيل تسديد مستحقات'),amount=inputField('المبلغ بالدينار','','number'),id=crypto.randomUUID();amount.input.min=1;amount.input.max=10000000;body.append(text('p',`${u.name} · ${localPhone(u.phone)}`),amount.box,button('تأكيد العملية',async()=>{const value=Number(amount.input.value);if(!Number.isInteger(value)||value<1||value>10000000)throw new Error('أدخل مبلغاً صحيحاً');if(!confirm(`تأكيد ${money(value)}؟`))return;await manage(op,{user_id:u.user_id,amount:value,id});closeDetail();await loadFinance();status('تم تسجيل العملية المالية')}))}
async function ledger(u){const data=await manage('ledger',{user_id:u.user_id,limit:500});openLedger={...data,user:u};const body=openDetail('كشف الحساب');body.append(text('p',`${u.name||''} · ${localPhone(u.phone)} · الرصيد ${money(data.balance||0)}`));const table=document.createElement('table');const head=document.createElement('thead'),row=document.createElement('tr');for(const title of['الوقت','النوع','المبلغ','الرحلة'])row.append(text('th',title));head.append(row);table.append(head);const tbody=document.createElement('tbody');for(const e of data.entries){const tr=document.createElement('tr');for(const v of[dates(e.created_at),ledgerNames[e.kind]||e.kind,money(e.amount),e.ride_id||'—'])tr.append(text('td',v));tbody.append(tr)}table.append(tbody);const wrap=text('div','');wrap.className='table-wrap';wrap.append(table);body.append(wrap,text('h3','مدفوعات الاشتراك'));for(const p of data.payments)body.append(text('p',`${money(p.amount)} · ${dates(p.created_at)} · الاشتراك حتى ${dates(p.expires_at)}`));body.append(button('تصدير CSV',async()=>exportLedger()))}
function exportLedger(){if(!openLedger)return status('افتح كشف حساب أولاً');const escape=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'")+'"';const rows=[['وقت','نوع','مبلغ','رحلة'],...openLedger.entries.map(e=>[e.created_at,e.kind,e.amount,e.ride_id])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(escape).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='taktooka-ledger.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function renderCoupons(){const list=$('couponList');list.replaceChildren();for(const c of finance.coupons||[])list.append(record(c.code,[['قيمة الخصم',money(c.amount)],['الحالة',!c.active?'متوقف':Date.parse(c.expires_at)<=Date.now()?'منتهي':'فعال'],['نهاية الصلاحية',dates(c.expires_at)],['الحد الأقصى للاستخدام',c.max_uses]],[button('تعديل',async()=>{$('couponCode').value=c.code;$('couponAmount').value=c.amount;$('couponExpiry').value=toLocal(c.expires_at);$('couponUses').value=c.max_uses;$('couponActive').checked=c.active;$('couponForm').scrollIntoView({behavior:'smooth'})}),button('حذف / إيقاف',async()=>{if(confirm('حذف الكود؟ الكود المستخدم سابقاً يتوقف مع حفظ سجلاته.')){await manage('coupon_delete',{code:c.code});await loadFinance()}},'danger')]));empty(list)}
$('couponForm').onsubmit=e=>{e.preventDefault();run(async()=>{await manage('coupon_admin',{code:$('couponCode').value,amount:Number($('couponAmount').value),expires_at:baghdadISO($('couponExpiry').value),max_uses:Number($('couponUses').value),active:$('couponActive').checked});await loadFinance();status('تم حفظ الكود بالتطبيق')})};$('clearCoupon').onclick=()=>{$('couponForm').reset();$('couponUses').value=100;$('couponActive').checked=true};
let supportRooms=[], supportSearch='', supportFilter='all';
async function loadSupport(){supportRooms=await manage('support_rooms');recovery=await manage('recovery');renderSupport()}
function renderSupport(){
 const q=supportSearch.toLowerCase(),matches=r=>`${r.name||''} ${localPhone(r.phone)}`.toLowerCase().includes(q);
 $('supportRooms').replaceChildren();$('recoveryRooms').replaceChildren();
 const showSupport=supportFilter!=='recovery',showRecovery=!['support','unread'].includes(supportFilter);
 $('supportHeading').hidden=$('supportRooms').hidden=!showSupport;$('recoveryHeading').hidden=$('recoveryRooms').hidden=!showRecovery;
 for(const [kind,rooms,list]of [['support',supportRooms,$('supportRooms')],['recovery',recovery,$('recoveryRooms')]]){
  for(const r of (rooms||[]).filter(matches).filter(r=>supportFilter!=='unread'||r.unread>0)){
   const row=text('article','');row.className='support-conversation';
   const open=document.createElement('button');open.type='button';open.className='conversation-open';
   const avatar=text('span',(r.name||'م').trim().slice(0,1));avatar.className='support-avatar';
   const summary=text('span','');summary.className='support-summary';summary.append(text('strong',r.name||localPhone(r.phone)),text('span',kind==='support'?'محادثة دعم · '+localPhone(r.phone):'استرجاع حساب · '+localPhone(r.phone)),text('small',dates(r.last_at||r.created_at)));
   const unread=text('span',r.unread>0?String(r.unread):'فتح');unread.className=r.unread>0?'unread-count':'conversation-state';open.append(avatar,summary,unread);open.onclick=()=>run(()=>chat(kind,r));
   const actions=text('div','');actions.className='conversation-actions';if(kind==='recovery')actions.append(button('تعيين كلمة سر',()=>resetPassword(r)));actions.append(button('أرشفة',()=>archive(kind,kind==='support'?r.user_id:r.id)));row.append(open,actions);list.append(row);
  }empty(list);
 }
}
$('supportSearch').oninput=e=>{supportSearch=e.target.value.trim();renderSupport()};$('supportFilter').onchange=e=>{supportFilter=e.target.value;renderSupport()};$('chatBack').onclick=closeDetail;
function appendLinks(element,body){const pattern=/https?:\/\/[^\s<>]+/g;let end=0;for(const match of body.matchAll(pattern)){element.append(document.createTextNode(body.slice(end,match.index)));const a=text('a',match[0]);a.href=match[0];a.target='_blank';a.rel='noopener noreferrer';element.append(a);end=match.index+match[0].length;}element.append(document.createTextNode(body.slice(end)));}
async function chat(kind,room){
 closeDetail();dialogMode='chat';dialogKey={kind,room};const epoch=dialogEpoch;
 $('chatTitle').textContent=room.name||'محادثة الدعم';$('chatSubtitle').textContent=(kind==='recovery'?'استرجاع الحساب':'دعم المستخدم')+' · '+localPhone(room.phone||'');$('chatScreen').hidden=false;document.body.classList.add('chat-open');setMenu(false);
 const body=$('chatWorkspace');body.replaceChildren();const log=Object.assign(text('div',''),{id:'chatLog',className:'chat-log'});log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.append(text('p','جاري تحميل المحادثة…'));body.append(log);
 const form=document.createElement('form');form.className='chat-compose';const input=document.createElement('textarea');input.id='chatInput';input.placeholder='اكتب رسالتك…';input.setAttribute('aria-label','نص الرد');input.required=true;input.maxLength=2000;input.rows=1;
 const send=text('button','إرسال');send.type='submit';const error=text('p','');error.className='chat-error';error.setAttribute('role','alert');let pending=null;form.append(input,send,error);
 form.onsubmit=async e=>{e.preventDefault();const bodyText=input.value.trim();if(!bodyText||send.disabled)return;pending=pending?.body===bodyText?pending:{id:crypto.randomUUID(),body:bodyText};send.disabled=true;error.textContent='';try{
 if(kind==='support')await manage('send',{user_id:room.user_id,id:pending.id,body:bodyText});else await manage('recovery_send',{id:room.id,message_id:pending.id,body:bodyText});if(epoch!==dialogEpoch)return;if(input.value.trim()===bodyText)input.value='';pending=null;await updateChat();log.scrollTop=log.scrollHeight;
 }catch(e){if(epoch===dialogEpoch)error.textContent=message(e)}finally{send.disabled=false;}};
 body.append(form);input.focus();try{await updateChat()}catch(e){if(epoch===dialogEpoch){log.replaceChildren(text('p','تعذّر تحميل المحادثة.'));error.textContent=message(e)}}
}
async function updateChat(){if(dialogRefreshing||dialogMode!=='chat')return;dialogRefreshing=true;const epoch=dialogEpoch,{kind,room}=dialogKey;try{
 const rows=kind==='support'?await manage('read',{user_id:room.user_id}):await manage('recovery_messages',{id:room.id});if(epoch!==dialogEpoch||dialogMode!=='chat')return;const sig=rows.map(m=>m.id).join(',');if(sig===chatSignature)return;const first=chatSignature===null;chatSignature=sig;
 const log=$('chatLog'),nearBottom=first||log.scrollHeight-log.scrollTop-log.clientHeight<60;log.replaceChildren();let day='';
 for(const m of rows){const date=new Date(m.created_at).toLocaleDateString('ar-IQ',{timeZone:'Asia/Baghdad'});if(date!==day){const label=text('span',date);label.className='chat-day';log.append(label);day=date;}
 const box=text('div','');box.className='chat-message'+(m.is_admin?' admin-message':'');const content=text('div','');content.className='message-content';appendLinks(content,m.body||'');box.append(content,text('small',`${m.is_admin?'الدعم':room.name||'المستخدم'} · ${new Date(m.created_at).toLocaleTimeString('ar-IQ',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit'})}`));log.append(box);
 }if(!rows.length)log.append(text('p','ابدأ المحادثة بإرسال رسالة.'));if(nearBottom)log.scrollTop=log.scrollHeight;
 }finally{dialogRefreshing=false}}
function setMenu(open){document.body.classList.toggle('menu-open',open);$('menuBackdrop').hidden=!open;$('menuToggle').setAttribute('aria-expanded',String(open));}
$('menuToggle').onclick=()=>setMenu(!document.body.classList.contains('menu-open'));$('menuBackdrop').onclick=()=>setMenu(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);if(dialogMode==='chat')closeDetail()}});
function resetPassword(u){const body=openDetail('تعيين كلمة سر جديدة'),password=inputField('كلمة السر الجديدة','','password');password.input.minLength=8;password.input.maxLength=128;body.append(text('p',`الحساب: ${u.name||''} · ${localPhone(u.phone)} — تأكد من هوية صاحب الحساب قبل التغيير.`),password.box,button('تأكيد تعيين كلمة السر',async()=>{if(password.input.value.length<8)throw new Error('كلمة السر 8 أحرف على الأقل');if(!confirm('تحققت من صاحب الحساب وتريد تغيير كلمة السر؟'))return;const {data,error}=await db.functions.invoke('taktooka-account-admin',{body:{op:'reset_password',user_id:u.user_id,phone:u.phone,password:password.input.value}});if(error||!data?.ok)throw new Error(data?.error||'تعذر تعيين كلمة السر');password.input.value='';closeDetail();status('تم تعيين كلمة السر وفتح محاولات الدخول')}))}
async function loadFavorites(){favorites=await manage('favorites',{limit:500});renderFavorites()}
function renderFavorites(){const list=$('favoriteList');list.replaceChildren();const q=$('favoriteSearch').value.trim();for(const f of favorites.filter(f=>`${f.label} ${f.name} ${localPhone(f.phone)}`.includes(q)))list.append(record(f.label,[['المستخدم',f.name],['الهاتف',localPhone(f.phone)],['خط العرض',f.lat],['خط الطول',f.lng]],[button('تعديل',()=>editFavorite(f)),button('حذف',async()=>{if(confirm('حذف العنوان المفضل من حساب المستخدم؟')){await manage('favorite_delete',{id:f.id});await loadFavorites()}},'danger')]));empty(list)}
function editFavorite(f){const body=openDetail('تعديل العنوان المفضل'),label=inputField('اسم العنوان',f.label),lat=inputField('خط العرض',f.lat,'number'),lng=inputField('خط الطول',f.lng,'number');lat.input.step=lng.input.step='any';body.append(label.box,lat.box,lng.box,Object.assign(text('div',''),{id:'favoriteMap',className:'admin-map'}),button('حفظ',async()=>{await manage('favorite_edit',{id:f.id,label:label.input.value,lat:Number(lat.input.value),lng:Number(lng.input.value)});closeDetail();await loadFavorites()}));dialogMap=mapFor('favoriteMap');dialogMap.setView([f.lat,f.lng],17);const marker=L.marker([f.lat,f.lng],{draggable:true}).addTo(dialogMap);const set=p=>{lat.input.value=p.lat;lng.input.value=p.lng;marker.setLatLng(p)};marker.on('dragend',()=>set(marker.getLatLng()));dialogMap.on('click',e=>set(e.latlng))}
async function loadSecurity(){security=await manage('security');$('securityList').replaceChildren();for(const p of security)$('securityList').append(record(localPhone(p.phone),[['طلبات النافذة',p.requests+' / 40'],['بداية النافذة',dates(p.window_at)],['حالة النافذة',Date.now()-Date.parse(p.window_at)<900000?'جارية لمدة 15 دقيقة':'انتهت؛ العداد تاريخي'],['كلمة المرور الخاطئة','لا تحظر الحساب']],[button('فتح المحاولات',async()=>{if(confirm('فتح محاولات الدخول لهذا الرقم؟')){await manage('unlock_phone',{phone:p.phone});await loadSecurity()}})]));empty($('securityList'))}
async function loadAudit(){audit=await manage('audit',{limit:500});archives=await manage('archives',{limit:500});$('auditList').replaceChildren();for(const a of audit){const row=record(`${a.actor_name||a.actor_id} · ${actionNames[a.action]||a.action}`,`${a.entity_id||''} · ${dates(a.created_at)}`),details=text('details',''),summary=text('summary','تفاصيل العملية');details.append(summary,Object.assign(text('pre',JSON.stringify(a.details,null,2)),{className:'audit-details'}));row.append(details);$('auditList').append(row)}empty($('auditList'));$('archiveList').replaceChildren();for(const a of archives)$('archiveList').append(record(`${archiveNames[a.kind]||a.kind} · ${a.entity_id}`,dates(a.created_at),[button('استرجاع',async()=>{if(confirm('استرجاع السجل إلى القائمة؟')){await manage('restore',{kind:a.kind,entity_id:a.entity_id});await loadAudit()}})]));empty($('archiveList'))}
async function loadPage(name){if(name==='wheel')return loadWheel();if(name==='banners')return loadBanners();if(name==='applications')return loadApplications();if(name==='overview')return loadOverview();if(name==='rides')return loadRides();if(name==='users')return loadUsers();if(name==='finance')return loadFinance();if(name==='support')return loadSupport();if(name==='favorites')return loadFavorites();if(name==='security')return loadSecurity();if(name==='audit')return loadAudit()}
for(const el of document.querySelectorAll('[data-page]'))el.onclick=()=>run(async()=>{showPage(el.dataset.page);await loadPage(el.dataset.page);if(activePage==='overview'&&liveMap)setTimeout(()=>liveMap.invalidateSize(),0)});
for(const [id,fn]of[['refreshOverview',loadOverview],['reloadRides',loadRides],['reloadUsers',loadUsers],['refreshFinance',loadFinance],['refreshSupport',loadSupport],['refreshFavorites',loadFavorites],['refreshSecurity',loadSecurity],['refreshAudit',loadAudit]])$(id).onclick=()=>run(()=>fn());
$('moreRides').onclick=()=>run(()=>loadRides(true));$('moreUsers').onclick=()=>run(()=>loadUsers(true));
let searchTimer;for(const [id,fn]of[['rideSearch',loadRides],['userSearch',loadUsers]])$(id).oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>run(()=>fn()),350)};
$('rideStatus').onchange=()=>run(()=>loadRides());$('walletSearch').oninput=renderWallets;$('favoriteSearch').oninput=renderFavorites;$('exportLedger').onclick=exportLedger;


const applicationNames={pending:'قيد المراجعة',changes_required:'يحتاج تعديل',approved:'تمت الموافقة'};
const documentLabels={id_front:'وجه الجنسية',id_back:'خلف الجنسية',residence_front:'وجه بطاقة السكن',residence_back:'خلف بطاقة السكن',selfie:'صورة فحص الوجه',portrait:'صورة البروفايل'};
let applications=[];
async function applicationRpc(action,data={}){const result=await db.rpc('tkt_captain_registration',{p_action:action,p_data:data});if(result.error)throw result.error;return result.data}
async function loadApplications(more=false){const rows=await applicationRpc('list',{status:$('applicationStatus').value,search:$('applicationSearch').value.trim(),limit:100,offset:more?applications.length:0});applications=more?[...applications,...rows]:rows;const list=$('applicationList');list.replaceChildren();for(const a of applications)list.append(record(a.full_name,`${localPhone(a.phone)} · ${applicationNames[a.status]||a.status} · ${a.province||'—'} — ${a.area||'—'} · ${dates(a.submitted_at)}`,[button('التفاصيل والمستمسكات',()=>applicationDetail(a))]));empty(list);$('moreApplications').hidden=rows.length<100}
async function applicationDetail(a){
 const body=openDetail('تسجيل المركبات — '+a.full_name),epoch=dialogEpoch;
 const details=text('div','');details.className='application-summary';
 for(const [label,value]of [['الاسم الكامل',a.full_name],['رقم الهاتف',localPhone(a.phone)],['المحافظة',a.province],['المنطقة',a.area],['حالة الطلب',applicationNames[a.status]],['تاريخ الإرسال',dates(a.submitted_at)],['تاريخ المراجعة',dates(a.reviewed_at)],['نسخة الطلب',a.revision]])details.append(text('p',`${label}: ${value??'—'}`));

 if(a.reason)details.append(text('p','التعديل المطلوب: '+a.reason));body.append(details);
 const gallery=text('div','');gallery.className='application-documents';body.append(gallery);
 for(const [slot,label]of Object.entries(documentLabels)){
  if(!a.documents?.[slot]&&!['id_front','id_back'].includes(slot))continue;
  const card=text('figure',''),caption=text('figcaption',label);card.append(caption);gallery.append(card);
  const path=a.documents?.[slot];if(!path){card.append(text('p','الصورة غير متاحة'));continue}
  const {data,error}=await db.storage.from('captain-documents').createSignedUrl(path,600);
  if(epoch!==dialogEpoch)return;
  if(error||!data?.signedUrl){card.append(text('p','تعذّر عرض الصورة. أغلق التفاصيل وافتحها مجدداً.'));continue}
  const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';const img=document.createElement('img');img.src=data.signedUrl;img.alt=label;img.referrerPolicy='no-referrer';link.append(img);card.append(link);
 }
 if(a.status!=='pending')return;
 const form=document.createElement('form'),label=text('label','التعديل المطلوب عند رفض الطلب'),reason=document.createElement('textarea');reason.id='applicationReason';reason.maxLength=2000;reason.rows=3;reason.placeholder='اكتب السبب وما يحتاج الكابتن تعديله';label.append(reason);form.append(label);
 async function review(decision){const why=reason.value.trim();if(decision==='changes_required'&&why.length<3){reason.focus();throw new Error('اكتب سبب الرفض والتعديل المطلوب')}if(decision==='approved'&&!confirm('الموافقة على المستمسكات وتفعيل حساب الكابتن؟'))return;await applicationRpc('review',{user_id:a.user_id,revision:a.revision,decision,reason:why});closeDetail();await loadApplications();status(decision==='approved'?'تمت الموافقة وتفعيل حساب الكابتن':'تم إرسال سبب التعديل للكابتن')}
 form.onsubmit=e=>{e.preventDefault();run(()=>review('changes_required'))};const actions=text('div','');actions.className='controls';actions.append(button('موافقة وتفعيل الكابتن',()=>review('approved'),'approve'),button('رفض لغرض التعديل',()=>review('changes_required'),'danger'));form.append(actions);body.append(form);
}
$('refreshApplications').onclick=()=>run(()=>loadApplications());$('moreApplications').onclick=()=>run(()=>loadApplications(true));$('applicationStatus').onchange=()=>run(()=>loadApplications());$('applicationSearch').onchange=()=>run(()=>loadApplications());

let notificationChannel,notificationTimer,notificationRows=[],notificationUser,webMessaging,webToken;
const notified=new Set();
async function noticeRpc(action,data={}){const r=await db.rpc('tkt_notification_action',{p_action:action,p_data:data});if(r.error)throw r.error;return r.data;}
async function refreshNotifications(){if(!notificationUser)return;notificationRows=await noticeRpc('list');const count=notificationRows.filter(n=>!n.read_at&&n.kind!=='offer_end').length;$('notifications').textContent=`الإشعارات${count?' ('+count+')':''}`;}
async function startNotifications(){await stopNotifications();notificationUser=(await db.auth.getUser()).data.user?.id;if(!notificationUser)return;$('notifications').hidden=false;$('enableNotifications').hidden=false;await refreshNotifications();
 notificationChannel=db.channel('admin-notifications-'+notificationUser).on('postgres_changes',{event:'INSERT',schema:'public',table:'tkt_notifications',filter:'user_id=eq.'+notificationUser},async payload=>{const n=payload.new;if(!notified.has(n.id)&&n.kind!=='offer_end'){notified.add(n.id);if(!webMessaging&&globalThis.Notification?.permission==='granted'){const popup=new Notification(n.title,{body:n.body,tag:n.id});popup.onclick=()=>{window.focus();run(()=>openNotification(n));popup.close();}}}await refreshNotifications();}).subscribe();
 notificationTimer=setInterval(()=>refreshNotifications().catch(()=>{}),15000);
}
async function stopNotifications(){clearInterval(notificationTimer);if(notificationChannel)await db.removeChannel(notificationChannel);notificationChannel=null;if(webToken&&notificationUser){try{await noticeRpc('unregister',{token:webToken});}catch(_){}}notificationUser=null;notificationRows=[];webToken=null;webMessaging=null;notified.clear();$('notifications').hidden=true;$('enableNotifications').hidden=true;}
async function openNotification(n){await noticeRpc('read',{id:n.id});await refreshNotifications();const t=n.target||{};
 if(t.screen==='ride'){showPage('rides');await loadRides();await trackRide(t.ride_id);}
 else if(t.screen==='support'){showPage('support');await loadSupport();await chat('support',supportRooms.find(r=>r.user_id===t.user_id)||{user_id:t.user_id,name:'محادثة دعم'});}
 else if(t.screen==='recovery'){showPage('support');await loadSupport();const r=recovery.find(r=>r.id===t.thread_id);if(r)await chat('recovery',r);}
 else if(t.screen==='application'){showPage('applications');await loadApplications();const a=applications.find(a=>a.user_id===t.user_id);if(a)await applicationDetail(a);else { $('applicationStatus').value='';$('applicationSearch').value=t.user_id;const rows=await applicationRpc('list',{limit:200});const found=rows.find(a=>a.user_id===t.user_id);if(found)await applicationDetail(found); }}
 else if(t.screen==='finance'||t.screen==='wallet'){showPage('finance');await loadFinance();}
 else {showPage('users');await loadUsers();}
}
$('notifications').onclick=()=>run(async()=>{await refreshNotifications();const body=openDetail('الإشعارات');body.append(button('قراءة الكل',async()=>{await noticeRpc('read_all');await refreshNotifications();closeDetail();}));for(const n of notificationRows.filter(n=>n.kind!=='offer_end'))body.append(record((n.read_at?'':'● ')+n.title,n.body+' · '+dates(n.created_at),[button('فتح',()=>openNotification(n))]));empty(body);});
$('enableNotifications').onclick=()=>run(async()=>{if(!('Notification'in window))throw new Error('هذا المتصفح لا يدعم إشعارات الجهاز');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('اسمح بالإشعارات من إعدادات المتصفح');
 try{const config=await fetch('./firebase-config.json').then(r=>r.ok?r.json():null);if(!config?.apiKey){status('الإشعارات أثناء فتح اللوحة مفعّلة؛ إشعارات الخلفية تحتاج إعداد Firebase للويب');return;}
 const [appApi,msgApi]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js')]);
 if(!await msgApi.isSupported())throw new Error('المتصفح لا يدعم Firebase Messaging');const app=appApi.initializeApp(config);webMessaging=msgApi.getMessaging(app);const registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js');webToken=await msgApi.getToken(webMessaging,{vapidKey:config.vapidKey||undefined,serviceWorkerRegistration:registration});await noticeRpc('register',{token:webToken,platform:'web'});msgApi.onMessage(webMessaging,m=>{const d=m.data||{};if(d.recipient_id!==notificationUser)return;const popup=new Notification(d.title,{body:d.body,tag:d.notification_id});popup.onclick=()=>{window.focus();run(()=>openNotification({id:d.notification_id,target:d}));popup.close();};refreshNotifications().catch(()=>{});});status('تم تفعيل إشعارات الجهاز والخلفية');
 }catch(e){status('الإشعارات داخل اللوحة مفعّلة؛ تعذّر ربط إشعارات الخلفية: '+message(e));}});
if('serviceWorker'in window.navigator)window.navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='tkt-notice-click'&&notificationUser)run(async()=>{await refreshNotifications();const n=notificationRows.find(n=>n.id===event.data.id);if(n)await openNotification(n);});});
const {data:{session}}=await db.auth.getSession();if(session){await run(load);const id=new URL(window.location.href).searchParams.get('notice');if(id){const n=notificationRows.find(n=>n.id===id);if(n)await run(()=>openNotification(n));}}


// Promotional images are public; row/storage mutation permissions are admin-only.
let bannerRows=[], bannerUploads=false;
const bannerBucket=db.storage.from('taktooka-banners');
async function loadBanners(){
 const {data,error}=await db.from('tkt_home_banners').select('*').order('sort_order').order('created_at').order('id').limit(100);
 if(error)throw error;bannerRows=data;renderBanners();
}
function renderBanners(){
 for(const slot of [1,2]){
  const list=$('bannerList'+slot);list.replaceChildren();
  for(const row of bannerRows.filter(x=>x.slot===slot)){
   const card=text('article','');card.className='banner-item';
   const image=document.createElement('img');image.src=bannerBucket.getPublicUrl(row.image_path).data.publicUrl;image.alt=row.title||'صورة البنر';image.loading='lazy';
   card.append(image,text('strong',row.title||'بدون عنوان'),text('small',`الترتيب: ${row.sort_order} · ${row.enabled?'فعّالة':'متوقفة'} · ${dates(row.created_at)}`));
   const controls=text('div','');controls.className='banner-controls';
   controls.append(button('تعديل',()=>editBanner(row)),button(row.enabled?'إيقاف':'تفعيل',async()=>{await saveBanner(row.id,{enabled:!row.enabled});await loadBanners()}),button('حذف',async()=>{
    if(!confirm('حذف هذه الصورة من البنر نهائياً؟'))return;
    const {error}=await db.from('tkt_home_banners').delete().eq('id',row.id).select('id').single();if(error)throw error;
    const removed=await bannerBucket.remove([row.image_path]);await loadBanners();status(removed.error?'حُذفت من التطبيق، لكن تعذّر تنظيف ملف الصورة من التخزين.':'تم حذف صورة البنر');
   },'danger'));
   card.append(controls);list.append(card);
  }empty(list);
 }
}
async function saveBanner(id,fields){const {error}=await db.from('tkt_home_banners').update(fields).eq('id',id).select('id').single();if(error)throw error;}
function editBanner(row){
 const body=openDetail('تعديل صورة البنر'),title=inputField('عنوان الصورة',row.title),order=inputField('الترتيب — الرقم الأصغر أولاً',row.sort_order,'number');title.input.maxLength=120;order.input.min=0;order.input.max=10000;
 const label=text('label','مكان الصورة'),slot=document.createElement('select');for(const [value,name]of [[1,'بنر 1 — فوك'],[2,'بنر 2 — جوه']]){const option=text('option',name);option.value=value;slot.append(option)}slot.value=row.slot;label.append(slot);
 body.append(title.box,label,order.box,button('حفظ التعديل',async()=>{const n=Number(order.input.value);if(!Number.isInteger(n)||n<0||n>10000)throw new Error('الترتيب رقم من 0 إلى 10000');await saveBanner(row.id,{title:title.input.value.trim(),slot:Number(slot.value),sort_order:n});closeDetail();await loadBanners();status('تم حفظ صورة البنر')}));
}
async function bannerJpeg(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw new Error('اختَر JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();if(!image.width||!image.height)throw new Error('الصورة غير صالحة');
  const scale=Math.min(1,1600/image.width,1600/image.height),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('تعذّر ضغط الصورة')),'image/jpeg',.88));
 }finally{URL.revokeObjectURL(url)}
}
let bannerPreviewUrls=[];
function clearBannerPreviews(){bannerPreviewUrls.forEach(url=>URL.revokeObjectURL(url));bannerPreviewUrls=[];$('bannerPreview').replaceChildren();}
$('bannerFiles').onchange=()=>{clearBannerPreviews();for(const file of [...$('bannerFiles').files].slice(0,10)){const url=URL.createObjectURL(file);bannerPreviewUrls.push(url);const img=document.createElement('img');img.src=url;img.alt=file.name;$('bannerPreview').append(img)}};
$('reloadBanners').onclick=()=>run(loadBanners);
$('bannerForm').onsubmit=e=>{e.preventDefault();if(bannerUploads)return;run(async()=>{
 const files=[...$('bannerFiles').files],slot=Number($('bannerSlot').value),title=$('bannerTitle').value.trim();
 if(!files.length||files.length>10)throw new Error('اختَر من صورة واحدة إلى 10 صور');
 // Validate the entire selection before starting any upload.
 for(const file of files)if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw new Error('كل صورة لازم تكون JPG / PNG / WebP وأقل من 5 ميغابايت');
 bannerUploads=true;$('uploadBanners').disabled=true;let done=0;
 try{
  await loadBanners();let order=Math.max(-1,...bannerRows.filter(x=>x.slot===slot).map(x=>x.sort_order));
  if(order+files.length>10000)throw new Error('عدّل ترتيب الصور الحالية قبل الإضافة');
  for(const file of files){
   $('bannerProgress').textContent=`جاري رفع ${done+1} من ${files.length}…`;const jpeg=await bannerJpeg(file),path=crypto.randomUUID()+'.jpg';
   const upload=await bannerBucket.upload(path,jpeg,{contentType:'image/jpeg',upsert:false});if(upload.error)throw upload.error;
   const saved=await db.from('tkt_home_banners').insert({slot,image_path:path,title,sort_order:++order,enabled:true});
   if(saved.error){await bannerBucket.remove([path]);throw saved.error}done++;
  }
  $('bannerForm').reset();clearBannerPreviews();status('تم رفع وتفعيل صور البنر؛ تظهر بالتطبيق خلال 30 ثانية أو عند فتح الرئيسية');
 }catch(e){throw new Error(`${done?`تم حفظ ${done} صورة. `:''}${message(e)}`)}
 finally{bannerUploads=false;$('uploadBanners').disabled=false;$('bannerProgress').textContent=`تم حفظ ${done} من ${files.length} صور`;await loadBanners()}
})};

// Inventory and spin results are determined transactionally by the server.
async function wheelRpc(action,data={}){const {data:result,error}=await db.rpc('tkt_wheel',{p_action:action,p_data:data});if(error){if(error.message.includes('WHEEL_STOCK_CHANGED'))throw new Error('المخزون تغيّر بسبب لفة أو تعديل آخر؛ حدّث الصفحة قبل الحفظ');throw error}return result}
let wheelData={},wheelClaims=[];
async function loadWheel(more=false){
 wheelData=await wheelRpc('admin_snapshot',{status:$('wheelClaimStatus').value,offset:more?wheelClaims.length:0});
 wheelClaims=more?[...wheelClaims,...wheelData.claims]:wheelData.claims;
 $('wheelEnabled').checked=wheelData.enabled;$('wheelMetrics').textContent=`اللفات: ${wheelData.spins} · الجوائز الرابحة: ${wheelData.wins} · بانتظار التسليم: ${wheelData.pending}`;
 $('wheelPrizes').replaceChildren();
 for(const prize of wheelData.prizes){
  const card=text('article','');card.className='banner-item';const title=text('h3',prize.title),info=text('small',`المتوفر: ${prize.remaining} · ${prize.enabled?'مفعلة':'متوقفة'}`);
  const form=document.createElement('form'),quantity=inputField('عدد الجوائز المتوفرة',prize.remaining,'number');quantity.input.min=0;quantity.input.max=100000;quantity.input.required=true;
  const toggle=text('label',''),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=prize.enabled;toggle.append(enabled,document.createTextNode(' الجائزة فعالة'));
  const save=text('button','حفظ المخزون');save.type='submit';
  form.append(quantity.box,toggle,save);form.onsubmit=e=>{e.preventDefault();run(async()=>{const n=Number(quantity.input.value);if(!Number.isInteger(n)||n<0||n>100000)throw new Error('عدد الجوائز رقم صحيح من 0 إلى 100000');save.disabled=true;try{await wheelRpc('stock',{key:prize.key,remaining:n,enabled:enabled.checked,revision:prize.revision});await loadWheel();status('تم تحديث مخزون '+prize.title)}finally{save.disabled=false}})};
  card.append(title,info,form);$('wheelPrizes').append(card);
 }
 const list=$('wheelClaims');list.replaceChildren();
 for(const claim of wheelClaims){
  const controls=claim.status==='pending'?[button('تأكيد تسليم الجائزة',async()=>{if(!confirm('تأكيد أن الفائز استلم '+claim.prize_title+' فعلياً؟'))return;await wheelRpc('deliver',{id:claim.id});await loadWheel();status('تم تسجيل تسليم الجائزة')})]:[];
  list.append(record(claim.prize_title,[['الفائز',claim.name||'—'],['الهاتف',localPhone(claim.phone)],['رقم الجائزة',claim.id],['وقت الفوز',dates(claim.created_at)],['الحالة',claim.status==='pending'?'بانتظار التسليم':'تم التسليم'],['وقت التسليم',dates(claim.delivered_at)],['اللفة القادمة',dates(new Date(Date.parse(claim.created_at)+259200000).toISOString())]],controls));
 }empty(list);$('moreWheelClaims').hidden=wheelData.claims.length<100;
}
$('reloadWheel').onclick=()=>run(()=>loadWheel());$('moreWheelClaims').onclick=()=>run(()=>loadWheel(true));$('wheelClaimStatus').onchange=()=>run(()=>loadWheel());
$('saveWheelState').onclick=()=>run(async()=>{await wheelRpc('configure',{enabled:$('wheelEnabled').checked});await loadWheel();status(wheelData.enabled?'العجلة مفعّلة':'العجلة متوقفة مؤقتاً')});
