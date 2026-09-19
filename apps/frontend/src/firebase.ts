import { initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyDoHsBaiO3s4GhnesF5ArMhtjWgHvx-XHQ',
  authDomain: 'dongochat-f97e4.firebaseapp.com',
  projectId: 'dongochat-f97e4',
  storageBucket: 'dongochat-f97e4.firebasestorage.app',
  messagingSenderId: '720739861188',
  appId: '1:720739861188:web:5dd31c8166056be259ff91',
  measurementId: 'G-TMWZWS2W2',
};

export const firebaseApp = initializeApp(firebaseConfig);

export async function getWebPushToken(vapidKey: string) {
  if (!(await isSupported())) {
    console.log('[Web Push] Firebase Messaging no está soportado');
    return null;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.warn('[Web Push] Permiso:', permission);
    return null;
  }

  const messaging = getMessaging(firebaseApp);

  const serviceWorkerRegistration =
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  return token;
}

export async function listenToWebPush(
  callback: (payload: unknown) => void,
) {
  if (!(await isSupported())) {
    return () => { };
  }

  const messaging = getMessaging(firebaseApp);

  return onMessage(messaging, payload => {
    console.log('[Web Push] Mensaje recibido:', payload);
    callback(payload);
  });
}
