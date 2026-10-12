const firebaseConfig = {"appId":"1:167183187140:web:40e0b785c9af81749ddd91","apiKey":"AIzaSyCBWhfSKKEiYCzpRLGn1X26FdgFcFSWfWs","projectId":"x-spece","authDomain":"x-spece.firebaseapp.com","storageBucket":"x-spece.firebasestorage.app","messagingSenderId":"167183187140"};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
 event.stopImmediatePropagation();event.notification.close();
 const data=event.notification.data?.FCM_MSG?.data||event.notification.data||{};
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const target=windows.find(w=>w.url.startsWith(self.registration.scope));
  if(target){target.postMessage({type:'tkt-notice-click',id:data.notification_id});return target.focus();}
  const url=new URL(self.registration.scope);if(data.notification_id)url.searchParams.set('notice',data.notification_id);
  return clients.openWindow(url.href);
 })());
});
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
firebase.initializeApp(firebaseConfig);
firebase.messaging().onBackgroundMessage(async payload=>{
 const d=payload.data||{};
 if(d.kind==='offer_end'||(d.expires_at&&Date.parse(d.expires_at)<=Date.now()))return;
 // FCM already displays notification payloads. Data messages need an explicit display.
 if(payload.notification)return;
 if(!d.title)return;
 await self.registration.showNotification(d.title,{body:d.body||'',tag:d.notification_id,
  icon:new URL('./assets/logo.png',self.registration.scope).href,data:d});
});
