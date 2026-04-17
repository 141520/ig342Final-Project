// ─────────────────────────────────────────────────────────────
// Firebase Configuration — BEATDOWN PWA
// ─────────────────────────────────────────────────────────────
// ⚠️  กรอก Config จาก Firebase Console ของคุณ:
//     Firebase Console > Project Settings > Your apps
//     > SDK setup and configuration > Config
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAgPVxkVhv6LyHChq07Fdxnw9FFEQuxF30",
  authDomain: "ig342-81433.firebaseapp.com",
  projectId: "ig342-81433",
  storageBucket: "ig342-81433.firebasestorage.app",
  messagingSenderId: "995742506330",
  appId: "1:995742506330:web:e079607d25edb7ae986763",
  measurementId: "G-Q64SQF7BBH"
};;

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, signOut, onAuthStateChanged };
