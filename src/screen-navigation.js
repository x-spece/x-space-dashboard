import {requestAppBack,navigationChanged} from './app-navigation.js?v=1';
const screens=new Map();let sequence=0,silent=false;
export function openSectionScreen(node,title,onClose){
 const current=screens.get(node);if(current){current.heading.textContent=title;return current.dialog;}
 const owner=node.closest?.('.page')?.id?.replace('page-','')||node.closest?.('.section-screen')?.dataset.ownerPage||'';const wasHidden=node.hidden;const marker=document.createComment('screen-origin');node.parentNode.insertBefore(marker,node);
 const dialog=document.createElement('dialog');dialog.className='section-screen';dialog.dataset.ownerPage=owner;dialog.setAttribute('aria-label',title);
 const header=document.createElement('header');header.className='section-screen-head';const heading=document.createElement('h2');heading.textContent=title;heading.id='section-screen-title-'+(++sequence);dialog.setAttribute('aria-labelledby',heading.id);
 const back=document.createElement('button');back.type='button';back.className='secondary quiet';back.textContent='رجوع ←';back.setAttribute('aria-label','رجوع');back.onclick=()=>requestAppBack(()=>dialog.close());dialog.addEventListener('cancel',event=>{event.preventDefault();requestAppBack(()=>dialog.close());});header.append(heading,back);
 const body=document.createElement('div');body.className='section-screen-body';node.hidden=false;body.append(node);dialog.append(header,body);document.body.append(dialog);
 const record={dialog,marker,heading,node,onClose,wasHidden};screens.set(node,record);
 dialog.addEventListener('close',()=>{if(screens.get(node)!==record)return;screens.delete(node);node.hidden=record.wasHidden;marker.parentNode.replaceChild(node,marker);dialog.remove();document.body.classList.toggle('section-screen-open',screens.size>0);record.onClose?.();if(!silent)navigationChanged(true);});
 document.body.classList.add('section-screen-open');dialog.showModal();dialog.scrollTop=0;navigationChanged();return dialog;
}
export function closeSectionScreen(node){const record=screens.get(node);if(record?.dialog.open)record.dialog.close();}
export function closeAllSectionScreens(){silent=true;try{for(const record of [...screens.values()].reverse())if(record.dialog.open)record.dialog.close();}finally{silent=false;}}

export function getSectionScreens(){return [...screens.values()].map(r=>({id:r.node.id,title:r.heading.textContent,scroll:r.dialog.scrollTop}));}
