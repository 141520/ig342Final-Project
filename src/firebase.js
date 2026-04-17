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
  apiKey: "AIzaSyDxSYqNsQJ8so7u2vffsfieWzriWaBEd7Q",
  authDomain: "ig342-f1cc4.firebaseapp.com",
  projectId: "ig342-f1cc4",
  storageBucket: "ig342-f1cc4.firebasestorage.app",
  messagingSenderId: "520882963925",
  appId: "1:520882963925:web:495843322049a46eeda95c",
  measurementId: "G-CTQ9CLQ34K"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, signOut, onAuthStateChanged };
