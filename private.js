// private.js

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
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app } from "./firebase.js";   // your initialized app

const db = getFirestore(app);
const auth = getAuth(app);

// HTML elements (change IDs if different)
const messagesList = document.getElementById("private-messages");
const input = document.getElementById("private-input");
const sendBtn = document.getElementById("private-send");

// The other user's uid must be known (from list/profile click)
let otherUserUid = null;
let conversationId = null;
let unsubscribeMessages = null;

// 1. Create or get conversation between two users
async function getOrCreateConversation(currentUid, otherUid) {
  // Conversation id is sorted combo of two uids
  const convId = [currentUid, otherUid].sort().join("_");
  const convRef = doc(db, "conversations", convId);

  // Create conversation doc if it doesn't exist
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

// 2. Listen to messages in this conversation
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

// 3. Send a private message
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

    // update conversation metadata
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

// 4. Wire up auth and UI
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in first.");
    return;
  }

  // TODO: set this from your user selection UI
  // Example only:
  // otherUserUid = "TARGET_USER_UID_HERE";
  if (!otherUserUid) return;

  conversationId = await getOrCreateConversation(user.uid, otherUserUid);
  listenToMessages(conversationId);
});

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
