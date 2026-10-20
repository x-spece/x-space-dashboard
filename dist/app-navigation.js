
export function createAppNavigation({key,capture,restore,notify}){
 let restoring=false,ready=false,exitAt=0,timer;const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}};
 const write=state=>{try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}};
 const current=()=>({...capture(),savedAt:Date.now()});
 const save=()=>{if(!ready||restoring)return;const state=current();write(state);if(history.state?.appKey===key&&!history.state?.base)history.replaceState({...history.state,snapshot:state},'');};
 const path=state=>JSON.stringify({...state,scroll:undefined,scrolls:undefined,savedAt:undefined});
 function commit(replace=false){if(!ready||restoring)return;const state=current(),old=history.state;write(state);if(replace||old?.appKey!==key||path(old.snapshot||{})===path(state))history.replaceState({appKey:key,index:old?.index||0,snapshot:state},'');else history.pushState({appKey:key,index:(old.index||0)+1,snapshot:state},'');}
 async function apply(state){restoring=true;try{await restore(state);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.scrollTo({top:state.scroll||0,behavior:'instant'});for(const [id,top] of Object.entries(state.scrolls||{})){const el=document.getElementById(id);if(el)(el.closest?.('dialog.section-screen')||el).scrollTop=top;}}catch(e){notify('تعذّر استرجاع بعض التفاصيل؛ تم عرض آخر بيانات متاحة.');}finally{restoring=false;commit(true);}}
 const back=()=>{if(!ready)return;save();history.back();};
 const pop=async event=>{if(!ready)return;const state=event.state;if(state?.appKey===key&&!state.base){exitAt=0;await apply(state.snapshot);return;}if(Date.now()-exitAt<2200){ready=false;if(history.length<=2){window.close();setTimeout(()=>{ready=true;history.pushState({appKey:key,index:0,snapshot:read()||current()},'');notify('المتصفح يمنع إغلاق النافذة تلقائيًا؛ أغلقها من زر التطبيقات.');},300);}else history.back();return;}exitAt=Date.now();notify('اضغط رجوع مرة ثانية للخروج');history.pushState({appKey:key,index:0,snapshot:read()||current()},'');};
 const onBack=e=>{if(ready){e.detail.handled=true;back();}},onChange=e=>commit(Boolean(e.detail?.replace));
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(save,120);};
 window.addEventListener('popstate',pop);window.addEventListener('tkt-navigation-back',onBack);window.addEventListener('tkt-navigation-change',onChange);window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);document.addEventListener('scroll',schedule,true);
 return{commit,back,save,get restoring(){return restoring},async start(){history.scrollRestoration='manual';const snapshot=read();if(history.state?.appKey!==key){history.replaceState({appKey:key,base:true},'');history.pushState({appKey:key,index:0,snapshot:snapshot||current()},'');}ready=true;if(snapshot)await apply(snapshot);else commit(true);},clear(){ready=false;clearTimeout(timer);try{sessionStorage.removeItem(key);}catch{}window.removeEventListener('popstate',pop);window.removeEventListener('tkt-navigation-back',onBack);window.removeEventListener('tkt-navigation-change',onChange);document.removeEventListener('scroll',schedule,true);window.removeEventListener('pagehide',save);window.removeEventListener('beforeunload',save);}};
}
export function requestAppBack(fallback){const detail={handled:false};window.dispatchEvent(new CustomEvent('tkt-navigation-back',{detail}));if(!detail.handled)fallback?.();}
export function navigationChanged(replace=false){window.dispatchEvent(new CustomEvent('tkt-navigation-change',{detail:{replace}}));}

