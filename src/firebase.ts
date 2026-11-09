import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Official Cloud Firebase Config for Al-Motafalsifa Platform
const firebaseConfig = {
  apiKey: "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4",
  authDomain: "alesraa-academy.firebaseapp.com",
  databaseURL: "https://alesraa-academy-default-rtdb.firebaseio.com",
  projectId: "alesraa-academy",
  storageBucket: "alesraa-academy.firebasestorage.app",
  messagingSenderId: "158593983527",
  appId: "1:158593983527:web:4646886c1bd03491109a02",
  measurementId: "G-KQ152GCF4W"
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
