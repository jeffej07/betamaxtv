// Firebase setup for BetamaxTV
// Docs: https://firebase.google.com/docs/web/setup

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCDwe7uwzPr-lZ_34bSVtxcEpj6ruVze7c",
  authDomain: "betamaxtv-9132a.firebaseapp.com",
  projectId: "betamaxtv-9132a",
  storageBucket: "betamaxtv-9132a.firebasestorage.app",
  messagingSenderId: "1047626751050",
  appId: "1:1047626751050:web:de5c1f52d178c061891ab3",
  measurementId: "G-WKKD9RTVTF",
};

const app = initializeApp(firebaseConfig);

// auth handles sign up / sign in / sign out / session state
export const auth = getAuth(app);

// db (Firestore) holds the extra profile fields Firebase Auth doesn't:
// username, favorite genre, TV show usually watched
export const db = getFirestore(app);

// functions lets the client call our Cloud Functions (e.g. the AI Live Chat
// reply) without ever touching the Gemini API key directly.
export const functions = getFunctions(app);
