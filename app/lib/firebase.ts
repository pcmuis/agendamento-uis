// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAKcPt2kRxwuNaWBnMg-l6VOrZsOIg_MBE",
  authDomain: "uis-agendamento.firebaseapp.com",
  projectId: "uis-agendamento",
  storageBucket: "uis-agendamento.firebasestorage.app",
  messagingSenderId: "823959630726",
  appId: "1:823959630726:web:50011817b422f505133207"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
