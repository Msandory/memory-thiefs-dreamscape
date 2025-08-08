// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBeCbJiJOlSH3Nz8LEuBsPnK1HAfMKUw7Q",
  authDomain: "memorytheftgame.firebaseapp.com",
  projectId: "memorytheftgame",
  storageBucket: "memorytheftgame.firebasestorage.app",
  messagingSenderId: "449945412191",
  appId: "1:449945412191:web:747c44992d95786548f1ea",
  measurementId: "G-E9FM6XEH9V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Initialize Firestore and export
export const db = getFirestore(app);