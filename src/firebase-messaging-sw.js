/* Firebase config must belong to the same project as the server sender. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data?.FCM_MSG?.data||event.notification.data||{};event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const target=windows.find(w=>w.url.startsWith(self.registration.scope));if(target){target.postMessage({type:'tkt-notice-click',id:data.notification_id});return target.focus();}const url=new URL(self.registration.scope);if(data.notification_id)url.searchParams.set('notice',data.notification_id);return clients.openWindow(url.href);}));});
fetch('./firebase-config.json').then(r=>r.ok?r.json():null).then(config=>{if(config?.apiKey){firebase.initializeApp(config);firebase.messaging();}});
