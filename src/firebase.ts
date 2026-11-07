import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAn6z4sDy1_sF-YmkLjA0Z1TQwU_iLClf4",
  authDomain: "qalbalelm.firebaseapp.com",
  projectId: "qalbalelm",
  storageBucket: "qalbalelm.firebasestorage.app",
  messagingSenderId: "203955396863",
  appId: "1:203955396863:web:07a1ac17ee0a1ee7a7ecca"
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
