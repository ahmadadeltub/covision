importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDvrAuM_ayogZP-11lTwMpwHTg73VpHI9M",
  authDomain: "covision-41ab1.firebaseapp.com",
  projectId: "covision-41ab1",
  storageBucket: "covision-41ab1.firebasestorage.app",
  messagingSenderId: "386746679174",
  appId: "1:386746679174:web:20c85b0a7804b1d23db607",
  measurementId: "G-MWD7S893XY"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
