import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Firebase web config keys are designed to be public (they are identifiers,
// not secrets). Access is controlled by Firestore Security Rules, Firebase
// Auth, and App Check — not by hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyCc6HC9JZyjHrqiTa5f9LGWwbx1ZPLlKAE",
  authDomain: "cams-f36be.firebaseapp.com",
  projectId: "cams-f36be",
  storageBucket: "cams-f36be.firebasestorage.app",
  messagingSenderId: "49676082600",
  appId: "1:49676082600:web:bc5fc82b4526c01217519d",
  measurementId: "G-SVGMV3CYTF"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Removed experimentalForceLongPolling — it's a dev workaround that degrades
// performance in production by preventing efficient WebSocket connections.
const db = initializeFirestore(app, {});
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };
