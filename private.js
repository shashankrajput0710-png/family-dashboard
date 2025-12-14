// private.js  (Firebase v9+ modular, used with <script type="module">)

// 1. Firebase imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 2. Your Firebase config (FILL WITH REAL VALUES)
const firebaseConfig = {
  apiKey: "AIzaSyBhxow1Lf7BFBJY5x9tg8m1jXGWXrd3M_Q",
  authDomain: "famtree-d8ffd.firebaseapp.com",
  projectId: "famtree-d8ffd",
  storageBucket: "famtree-d8ffd.firebasestorage.app",
  messagingSenderId: "607143089368",
  appId: "1:607143089368:web:5c0c73209c14c141e933ad",
  measurementId: "G-BPG2NLE1NW",
};

// 3. Initialize once
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 4. DOM elements (match your HTML IDs)
const messagesList = document.getElementById("pv-list");
const input = document.getElementById("pv-input");
const sendBtn = document.getElementById("pv-send");
const titleEl = document.getElementById("pv-title");
const statusEl = document.getElementById("pv-status");

// 5. State
// IMPORTANT: put a REAL other user's UID here for testing
let otherUserUid = "TARGET_USER_UID_HERE";
let conversationId = null;
let unsubscribeMessages = null;

// 6. Conversation helpers
async function getOrCreateConversation(currentUid, otherUid) {
  const convId = [currentUid, otherUid].sort().join("_");
  const convRef = doc(db, "conversations", convId);

  await setDoc(
    convRef,
    {
      members: [currentUid, otherUid],
      lastMessage: "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return convId;
}

function listenToMessages(convId, myUid) {
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesCol = collection(db, "conversations", convId, "messages");
  const q = query(messagesCol, orderBy("createdAt", "asc"));

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    console.log("SNAPSHOT SIZE:", snapshot.size);
    messagesList.innerHTML = "";

    if (snapshot.empty) {
      const div = document.createElement("div");
      div.className = "sub";
      div.textContent = "No messages yet.";
      messagesList.appendChild(div);
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "item" + (data.senderUid === myUid ? " item-me" : "");
      div.innerHTML = `
        <div class="item-author">${data.senderUid === myUid ? "You" : (data.senderName || "Friend")}</div>
        <div class="item-text">${data.text}</div>
      `;
      messagesList.appendChild(div);
    });

    messagesList.scrollTop = messagesList.scrollHeight;
  });
}

// 7. Send message (with debug log)
async function sendPrivateMessage() {
  const text = input.value.trim();
  console.log("SEND CLICK", { text, conversationId });

  if (!text || !conversationId) return;

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    const messagesCol = collection(db, "conversations", conversationId, "messages");
    await addDoc(messagesCol, {
      text,
      senderUid: user.uid,
      senderName: user.displayName || "Unknown",
      createdAt: serverTimestamp(),
    });

    await setDoc(
      doc(db, "conversations", conversationId),
      {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    input.value = "";
  } catch (e) {
    alert("Error sending message: " + e.message);
  }
}

// 8. Auth and startup (with debug log)
onAuthStateChanged(auth, async (user) => {
  console.log("AUTH STATE:", user);

  if (!user) {
    statusEl.textContent = "Please log in first.";
    return;
  }

  statusEl.textContent = "Connected as " + (user.email || user.uid);

  // These two lines must NOT block you
  if (!otherUserUid || otherUserUid === user.uid) {
    statusEl.textContent += " (set otherUserUid in private.js)";
    return;
  }

  titleEl.textContent = "Chat with " + otherUserUid.slice(0, 6) + "...";

  conversationId = await getOrCreateConversation(user.uid, otherUserUid);
  console.log("CONVERSATION ID:", conversationId);
  listenToMessages(conversationId, user.uid);
});

// 9. UI events
sendBtn.addEventListener("click", (e) => {
  e.preventDefault();
  sendPrivateMessage();
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendPrivateMessage();
  }
});

