// private.js  (simple public chat, no auth required for now)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Firebase config – PUT YOUR REAL VALUES
const firebaseConfig = {
  apiKey: "AIzaSyBhxow1Lf7BFBJY5x9tg8m1jXGWXrd3M_Q",
  authDomain: "famtree-d8ffd.firebaseapp.com",
  projectId: "famtree-d8ffd",
  storageBucket: "famtree-d8ffd.firebasestorage.app",
  messagingSenderId: "607143089368",
  appId: "1:607143089368:web:5c0c73209c14c141e933ad",
  measurementId: "G-BPG2NLE1NW",
};

// 2. Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. DOM
const statusEl = document.getElementById("status");
const listEl = document.getElementById("msg-list");
const inputEl = document.getElementById("msg-input");
const sendBtn = document.getElementById("msg-send");

// 4. Listen to messages from "messages" collection
const messagesCol = collection(db, "messages");
const q = query(messagesCol, orderBy("createdAt", "asc"));

onSnapshot(q, (snapshot) => {
  console.log("SNAP SIZE:", snapshot.size);
  listEl.innerHTML = "";

  if (snapshot.empty) {
    const div = document.createElement("div");
    div.className = "sub";
    div.textContent = "No messages yet.";
    listEl.appendChild(div);
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-author">${data.name || "Anon"}</div>
      <div class="item-text">${data.text}</div>
    `;
    listEl.appendChild(div);
  });

  listEl.scrollTop = listEl.scrollHeight;
});

statusEl.textContent = "Connected (public chat)";

// 5. Send message
async function sendMessage() {
  const text = inputEl.value.trim();
  console.log("SEND CLICK", text);
  if (!text) return;

  try {
    await addDoc(messagesCol, {
      text,
      name: "Anon",
      createdAt: serverTimestamp(),
    });
    inputEl.value = "";
  } catch (e) {
    alert("Error sending: " + e.message);
  }
}

sendBtn.addEventListener("click", (e) => {
  e.preventDefault();
  sendMessage();
});

inputEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});
