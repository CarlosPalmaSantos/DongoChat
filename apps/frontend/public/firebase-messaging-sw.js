// Firebase Cloud Messaging Service Worker
importScripts(
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyDoHsBaiO3s4GhnesF5ArMhtjWgHvx-XHQ',
  authDomain: 'dongochat-f97e4.firebaseapp.com',
  projectId: 'dongochat-f97e4',
  storageBucket: 'dongochat-f97e4.firebasestorage.app',
  messagingSenderId: '720739861188',
  appId: '1:720739861188:web:5dd31c8166056be259ff91',
  measurementId: 'G-TMWZWS2W2',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log(
    '[firebase-messaging-sw.js] Mensaje recibido:',
    payload,
  );
});
