import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyD7vnjAbV-aOJ0gG34-h1X1XM5XheFeXEc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "hybrid-engineer.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "https://hybrid-engineer-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "hybrid-engineer",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "hybrid-engineer.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "54927804226",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:54927804226:web:179b24936ab111b28d6adb"
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const ADMIN_LOGIN = {
  username: "rao sahab",
  email: import.meta.env.VITE_ADMIN_AUTH_EMAIL ?? "raosahab.admin@hybrid-engineer.local"
};
