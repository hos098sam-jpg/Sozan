import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// دمج البيانات الجديدة ديناميكياً لتأمين منصة المتفلسفة وفصل السيرفر تماماً مجاناً 100%
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alesraa-academy.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alesraa-academy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alesraa-academy.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "158593983527",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:158593983527:web:1867211dfdfaa6ca109a02"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
