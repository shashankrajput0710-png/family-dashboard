import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ----- 1. Firebase config (same as other files) ----- */
const firebaseConfig = {
  apiKey: "AIzaSyBhxow1Lf7BFBJY5x9tg8m1jXGWXrd3M_Q",
  authDomain: "famtree-d8ffd.firebaseapp.com",
  projectId: "famtree-d8ffd",
  storageBucket: "famtree-d8ffd.firebasestorage.app",
  messagingSenderId: "607143089368",
  appId: "1:607143089368:web:5c0c73209c14c141e933ad",
  measurementId: "G-BPG2NLE1NW",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ----- 2. DOM & URL ----- */
const pvTitle = document.getElementById("pv-title");
const pvStatus = document.getElementById("pv-status");
const pvList = document.getElementById("pv-list");
const pvInput = document.getElementById("pv-input");
const pvSend = document.getElementById("pv-send");

const params = new URLSearchParams(window.location.search);
const withUid = params.get("withUid");
const withName = decodeURIComponent(params.get("withName") || "Member");

pvTitle.textContent = "Private chat with " + withName;

/* ----- 3. Helpers ----- */
function sortedPair(uid1, uid2) {
  return [uid1, uid2].sort();
}

let currentUser = null;
let msgsRef = null;
let convRef = null;

/* ----- 4. Auth + conversation ----- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    pvStatus.textContent = "Please log in from main page first.";
    pvSend.disabled = true;
    pvInput.disabled = true;
    return;
  }
  currentUser = user;
  pvStatus.textContent = "You: " + (user.displayName || user.email || user.uid);

  if (!withUid) {
    pvStatus.textContent = "Missing chat partner.";
    return;
  }

  const [a, b] = sortedPair(user.uid, withUid);
  const convKey = a + "_" + b;

  convRef = doc(db, "conversations", convKey);
  await setDoc(
    convRef,
    {
      members: [a, b],
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  msgsRef = collection(convRef, "messages");
  const qMsgs = query(msgsRef);
  onSnapshot(qMsgs, (snap) => {
    const msgs = [];
    snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
    msgs.sort((x, y) => {
      const tx = x.createdAt?.toMillis?.() || 0;
      const ty = y.createdAt?.toMillis?.() || 0;
      return tx - ty;
    });
    renderMessages(msgs);
  });

  pvSend.onclick = async () => {
    const text = pvInput.value.trim();
    if (!text) return;
    try {
      await addDoc(msgsRef, {
        text,
        senderUid: user.uid,
        senderName: user.displayName || user.email || "Me",
        createdAt: serverTimestamp(),
      });
      await setDoc(
        convRef,
        { lastMessageAt: serverTimestamp() },
        { merge: true }
      );
      pvInput.value = "";
    } catch (e) {
      alert("Error sending message: " + e.message);
    }
  };
});

/* ----- 5. Render ----- */
function renderMessages(items) {
  pvList.innerHTML = "";
  if (!items.length) {
    pvList.innerHTML = "<div class='sub'>No messages yet.</div>";
    return;
  }

  items.forEach((m) => {
    const wrap = document.createElement("div");
    wrap.className = "item";
    if (currentUser && m.senderUid === currentUser.uid) {
      wrap.classList.add("item-me");
    }

    const author = document.createElement("div");
    author.className = "item-author";
    author.textContent =
      currentUser && m.senderUid === currentUser.uid
        ? "You"
        : m.senderName || "Member";

    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = m.text || "";

    wrap.appendChild(author);
    wrap.appendChild(text);
    pvList.appendChild(wrap);
  });

  pvList.scrollTop = pvList.scrollHeight;
}
