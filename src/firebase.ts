import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Independent Firebase Configuration for Al-Motafalsifa Platform (Teacher Suzan Karim Al-Kholy)
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSy_SOZAN_REPLACE_WITH_YOUR_KEY",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "al-motafalsifa.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "al-motafalsifa",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "al-motafalsifa.appspot.com",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "102938475610",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:102938475610:web:motafalsifa789"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
