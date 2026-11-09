import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Independent Firebase Configuration for Al-Motafalsifa Platform (Teacher Suzan Karim Al-Kholy)
// Grounded with live Alesraa Academy credentials for seamless deployment
const firebaseConfig = {
  apiKey: "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4",
  authDomain: "alesraa-academy.firebaseapp.com",
  databaseURL: "https://firebaseio.com",
  projectId: "alesraa-academy",
  storageBucket: "alesraa-academy.firebasestorage.app",
  messagingSenderId: "158593983527",
  appId: "1:158593983527:web:4646886c1bd03491109a02",
  measurementId: "G-KQ152GCF4W"
};

// Initialize App safely avoiding duplicates
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with robust multi-tab caching to preserve student exam progress offline
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}

// Export Authentication and Database instances
export const auth = getAuth(app);
export const db = firestoreDb;

// Isolated Isolation Keys for Al-Motafalsifa Platform (100% data decoupling)
export const PLATFORM_CONFIG = {
  collectionName: "al_motafalsifa_data",
  sessionKey: "al_motafalsifa_device_session_id",
  tokenKey: "al_motafalsifa_token",
  theme: {
    primary: "#1e1145", // Royal Imperial Indigo
    accent: "#d4af37",  // Antique Gold
    amber: "#f59e0b"   // Amber Flare
  }
};
    
