import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyDvrAuM_ayogZP-11lTwMpwHTg73VpHI9M",
  authDomain: "covision-41ab1.firebaseapp.com",
  projectId: "covision-41ab1",
  storageBucket: "covision-41ab1.firebasestorage.app",
  messagingSenderId: "386746679174",
  appId: "1:386746679174:web:20c85b0a7804b1d23db607",
  measurementId: "G-MWD7S893XY"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics (safe for all browser environments)
export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Initialize Messaging
let messagingInstance: any = null;
try {
  if (typeof window !== "undefined") {
    messagingInstance = getMessaging(app);
  }
} catch (e) {
  console.warn("Firebase Messaging not supported in this browser environment", e);
}

export const messaging = messagingInstance;

// The VAPID key provided by the user
export const VAPID_KEY = "UBoQOu9uQR7jqiJsfXOAP087XGtR1mgZ0pYjeosHYZQ";

export const requestForToken = async () => {
  try {
    if (!messaging) return null;
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
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
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
