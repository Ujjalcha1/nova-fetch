import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCUvawqZ0pw1xPzxh4LNWFCV7U3M3_v0u4',
  authDomain: 'novafetch-bae91.firebaseapp.com',
  projectId: 'novafetch-bae91',
  storageBucket: 'novafetch-bae91.firebasestorage.app',
  messagingSenderId: '887079945878',
  appId: '1:887079945878:web:1d4e5d7464fd910f6324b7',
  measurementId: 'G-WVKQMP545F'
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
