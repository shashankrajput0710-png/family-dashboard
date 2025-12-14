// private.js
// Load Firebase SDKs from CDN
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

// 1. Firebase config (PUT YOUR VALUES HERE)
const firebaseConfig = {
  apiKey: "AIzaSyBhxow1Lf7BFBJY5x9tg8m1jXGWXrd3M_Q",
  authDomain: "famtree-d8ffd.firebaseapp.com",
  projectId: "famtree-d8ffd",
  storageBucket: "famtree-d8ffd.firebasestorage.app",
  messagingSenderId: "607143089368",
  appId: "1:607143089368:web:5c0c73209c14c141e933ad",
  measurementId: "G-BPG2NLE1NW",
};

// 2. Single initialization (no duplicates)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 3. DOM elements (match your HTML IDs)
const messagesList = document.getElementById("private-messages");
const input = document.getElementById("private-input");
const sendBtn = document.getElementById("private-send");

// Set this from your UI when user clicks on a friend
let otherUserUid = null;

// Conversation tracking
let conversationId = null;
let unsubscribeMessages = null;

// 4. Create or get conversation between two users
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

// 5. Listen to messages
function listenToMessages(convId) {
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesCol = collection(db, "conversations", convId, "messages");
  const q = query(messagesCol, orderBy("createdAt", "asc"));

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    messagesList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.textContent = `${data.senderName || data.senderUid}: ${data.text}`;
      messagesList.appendChild(li);
    });
  });
}

// 6. Send a private message
async function sendPrivateMessage() {
  const text = input.value.trim();
  if (!text || !conversationId) return;

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    const messagesCol = collection(
      db,
      "conversations",
      conversationId,
      "messages"
    );

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

// 7. Auth state and startup
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in first.");
    return;
  }

  // TODO: set this based on which user is selected in your UI
  // Example only; replace with real UID from your users list:
  // otherUserUid = "TARGET_USER_UID";
  if (!otherUserUid) return;

  conversationId = await getOrCreateConversation(user.uid, otherUserUid);
  listenToMessages(conversationId);
});

// 8. UI events
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

