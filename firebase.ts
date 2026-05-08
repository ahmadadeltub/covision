import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDvrAuM_ayogZP-11lTwMpwHTg73VpHI9M",
  authDomain: "covision-41ab1.firebaseapp.com",
  projectId: "covision-41ab1",
  storageBucket: "covision-41ab1.firebasestorage.app",
  messagingSenderId: "386746679174",
  appId: "1:386746679174:web:20c85b0a7804b1d23db607",
  measurementId: "G-MWD7S893XY"
};

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// The VAPID key provided by the user
export const VAPID_KEY = "UBoQOu9uQR7jqiJsfXOAP087XGtR1mgZ0pYjeosHYZQ";

export const requestForToken = async () => {
  try {
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      // Here you can send the token to your server to dispatch notifications to this user later
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
