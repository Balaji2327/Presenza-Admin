import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

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
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { db };
