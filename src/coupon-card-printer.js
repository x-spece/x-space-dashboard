import {buildCouponCardsPdf,loadCouponTemplate,downloadCouponPdf} from './coupon-card-pdf.js?v=1.6.65';

export function randomCardCode(){
 const digits=[];while(digits.length<10){const values=crypto.getRandomValues(new Uint8Array(16));for(const n of values){if(n>=250)continue;if(!digits.length&&n%10===0)continue;digits.push(String(n%10));if(digits.length===10)break;}}return digits.join('');
}

export function createCouponCardPrinter({document,rpc,canEdit,run,notify,dates,template=loadCouponTemplate,build=buildCouponCardsPdf,download=downloadCouponPdf}) {
 const $=id=>document.getElementById(id);let pending=null,lastBatch=null,lastPdf=null,epoch=0,loading=false,activeMode=false;
 const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 const filename=batch=>`Taktooka-Free-Rides-${batch.codes.length}-${batch.id.slice(0,8)}.pdf`;
 function sync(){ $('downloadCards').disabled=!lastPdf;$('cardCount').disabled=!activeMode||!canEdit()||loading; }
 function mode({free,editing}){ activeMode=free&&!editing; $('cardOptions').hidden=!free||editing;$('rewardCode').readOnly=free||editing;$('rewardUses').parentElement.hidden=free&&!editing;
  if(free&&!editing){if(!/^\d{10}$/.test($('rewardCode').value))$('rewardCode').value=randomCardCode();$('rewardUses').value=1;}
  $('rewardSave').textContent=free&&!editing?'توليد الكارتات':'حفظ الكود';$('cardPreviewCode').textContent=free&&!editing?$('rewardCode').value:'1234567890';sync();
 }
 async function generate(){
  if(!canEdit()||loading)return;const count=Number($('cardCount').value.replace(/[,٬\s]/g,'')),expiry=new Date($('rewardExpiry').value).toISOString();if(!Number.isInteger(count)||count<1||count>500)throw new Error('حدد من 1 إلى 500 كارت');
  loading=true;sync();try{
   const image=await template();const data={count,expires_at:expiry,active:$('rewardActive').checked,first_code:$('rewardCode').value};const signature=JSON.stringify(data);if(pending?.signature!==signature)pending={signature,id:crypto.randomUUID(),...data};
   const batch=await rpc('generate',pending);lastBatch=batch;lastPdf=build({...image,codes:batch.codes});pending=null;$('rewardCode').value=batch.codes[0];$('cardPreviewCode').textContent=batch.codes[0];$('cardGenerated').textContent=`تم توليد ${batch.codes.length} كارت؛ كل كارت بكود مختلف واستخدام واحد.`;notify('الكارتات جاهزة؛ اضغط تنزيل PDF');await load();
  }finally{loading=false;sync();}
 }
 async function load(){const current=++epoch;const batches=await rpc('list');if(current!==epoch)return;const list=$('cardBatches');list.replaceChildren();for(const batch of batches){const row=node('article','');row.className='record';row.append(node('strong',`${batch.card_count} كارت`),node('p',`تاريخ التوليد: ${dates(batch.created_at)} · استُخدم ${batch.used_cards} كارت`));const button=node('button','تنزيل PDF');button.type='button';button.className='secondary';button.onclick=()=>run(async()=>{button.disabled=true;try{const image=await template(),result=await rpc('get',{id:batch.id});download(build({...image,codes:result.codes}),filename(result),document);}finally{button.disabled=false;}});row.append(button);list.append(row);}if(!batches.length)list.append(node('p','لا توجد دفعات طباعة بعد'));}
 $('downloadCards').onclick=()=>{if(lastPdf&&lastBatch)download(lastPdf,filename(lastBatch),document);};sync();return {mode,generate,load,sync};
}
