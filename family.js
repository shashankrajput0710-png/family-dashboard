import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* Firebase config */
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

/* DOM */
const dashStatus = document.getElementById("dash-status");
const dashMemberList = document.getElementById("dash-member-list");
const dashMemberCount = document.getElementById("dash-member-count");

const chatList = document.getElementById("chat-list");
const chatCount = document.getElementById("chat-count");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const typingIndicator = document.getElementById("typing-indicator");

const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const taskInput = document.getElementById("task-input");
const taskAddBtn = document.getElementById("task-add-btn");

/* URL param */
const params = new URLSearchParams(window.location.search);
const familyId = params.get("familyId");
if (!familyId && dashStatus) {
  dashStatus.textContent = "No family selected. Open from main page.";
}

/* State */
let familyOwnerUid = null;
let currentUser = null;
let typingTimeout = null;

/* Auth */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    if (dashStatus) dashStatus.textContent = "Please log in again from main page.";
    if (dashMemberList)
      dashMemberList.innerHTML =
        "<div class='empty'>Open the main page, log in, then come here.</div>";
    if (chatList)
      chatList.innerHTML =
        "<div class='empty'>You must be logged in to use chat.</div>";
    if (taskList)
      taskList.innerHTML =
        "<div class='empty'>You must be logged in to see tasks.</div>";
    return;
  }

  if (!familyId) return;
  currentUser = user;

  try {
    const famSnap = await getDoc(doc(db, "families", familyId));
    if (famSnap.exists()) {
      const famData = famSnap.data();
      familyOwnerUid = famData.ownerUid || null;
      const isOwner = familyOwnerUid && user.uid === familyOwnerUid;

      if (dashStatus) {
        dashStatus.textContent =
          (famData.name || "Family") +
          " — " +
          (isOwner ? "You are the owner" : "Signed in as ") +
          (isOwner ? "" : (user.displayName || user.email || ""));
      }
    } else if (dashStatus) {
      dashStatus.textContent = "Family not found.";
    }
  } catch (e) {
    console.error("Error loading family:", e);
  }

  const membersQuery = query(
    collection(db, "familyMembers"),
    where("familyId", "==", familyId)
  );
  onSnapshot(membersQuery, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    renderMembers(items);
  });

  const generalRef = collection(db, "families", familyId, "generalMessages");
  onSnapshot(query(generalRef), (snap) => {
    const msgs = [];
    snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
    renderChat(msgs);
  });

  const typingDocRef = doc(db, "families", familyId, "meta", "typingStatus");
  onSnapshot(typingDocRef, (snap) => {
    if (!snap.exists()) {
      typingIndicator.textContent = "";
      return;
    }
    const data = snap.data();
    if (!data.isTyping || !data.userName) {
      typingIndicator.textContent = "";
      return;
    }
    if (data.userUid === currentUser.uid) {
      typingIndicator.textContent = "";
      return;
    }
    typingIndicator.textContent = (data.userName || "Someone") + " is typing...";
  });

  if (chatInput) {
    chatInput.addEventListener("input", async () => {
      if (!currentUser) return;
      const isTyping = chatInput.value.trim().length > 0;
      try {
        await setDoc(
          typingDocRef,
          {
            isTyping,
            userUid: currentUser.uid,
            userName:
              currentUser.displayName || currentUser.email || "Member",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error("typing update error", e);
      }
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(async () => {
        try {
          await setDoc(
            typingDocRef,
            { isTyping: false, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (e) {
          console.error("typing clear error", e);
        }
      }, 3000);
    });
  }

  if (chatSendBtn) {
    chatSendBtn.onclick = async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      try {
        await addDoc(generalRef, {
          text,
          senderUid: user.uid,
          senderName: user.displayName || user.email || "Member",
          createdAt: serverTimestamp(),
        });
        chatInput.value = "";
        await setDoc(
          typingDocRef,
          { isTyping: false, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        alert("Error sending message: " + err.message);
      }
    };
  }

  const tasksRef = collection(db, "families", familyId, "tasks");
  onSnapshot(tasksRef, (snap) => {
    const tasks = [];
    snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
    renderTasks(tasks);
  });

  if (taskAddBtn) {
    taskAddBtn.onclick = async () => {
      const text = taskInput.value.trim();
      if (!text) return;
      try {
        await addDoc(tasksRef, {
          text,
          done: false,
          assignedUid: currentUser.uid,
          assignedName:
            currentUser.displayName || currentUser.email || "Member",
          createdAt: serverTimestamp(),
        });
        taskInput.value = "";
      } catch (e) {
        alert("Error adding task: " + e.message);
      }
    };
  }
});

/* Renders */

function renderMembers(items) {
  if (!dashMemberList || !dashMemberCount) return;

  dashMemberList.innerHTML = "";
  if (!items.length) {
    dashMemberList.innerHTML =
      "<div class='empty'>No members yet in this family.</div>";
    dashMemberCount.textContent = "0 members";
    return;
  }

  dashMemberCount.textContent =
    items.length + (items.length === 1 ? " member" : " members");

  items.forEach((m) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");

    const nameLine = document.createElement("div");
    nameLine.style.display = "flex";
    nameLine.style.alignItems = "center";
    nameLine.style.gap = "6px";

    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = m.name || "(no name)";

    nameLine.appendChild(label);

    const sub = document.createElement("div");
    sub.className = "list-sub";

    let roleLabel = "Member";
    if (familyOwnerUid && m.userUid === familyOwnerUid) {
      roleLabel = "Owner";
    } else if (m.role) {
      roleLabel = m.role;
    }

    const codeText =
      m.memberCode && m.memberCode !== "N/A"
        ? "Code: " + m.memberCode
        : "Code: N/A";

    sub.textContent = roleLabel + " — " + codeText;

    left.appendChild(nameLine);
    left.appendChild(sub);
    row.appendChild(left);

    if (currentUser && m.userUid && m.userUid !== currentUser.uid) {
      const chatBtn = document.createElement("button");
      chatBtn.className = "btn btn-secondary";
      chatBtn.textContent = "Private chat";
      chatBtn.onclick = () => {
        window.location.href = `private.html?familyId=${familyId}&withUid=${m.userUid}&withName=${encodeURIComponent(
          m.name || ""
        )}`;
      };
      row.appendChild(chatBtn);
    }

    dashMemberList.appendChild(row);
  });
}

function renderChat(items) {
  if (!chatList || !chatCount) return;

  chatList.innerHTML = "";
  if (!items.length) {
    chatList.innerHTML =
      "<div class='empty'>No messages yet. Say hi to your family!</div>";
    chatCount.textContent = "0 messages";
    return;
  }

  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return ta - tb;
  });

  items.forEach((m) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = m.senderName || "Member";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = m.text || "";

    left.appendChild(label);
    left.appendChild(sub);
    row.appendChild(left);

    chatList.appendChild(row);
  });

  chatCount.textContent =
    items.length + (items.length === 1 ? " message" : " messages");
}

function renderTasks(items) {
  if (!taskList || !taskCount) return;

  taskList.innerHTML = "";
  if (!items.length) {
    taskList.innerHTML = "<div class='empty'>No tasks yet.</div>";
    taskCount.textContent = "0 tasks";
    return;
  }

  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  items.forEach((t) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = t.text;

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "By " + (t.assignedName || "Member");

    left.appendChild(label);
    left.appendChild(sub);
    row.appendChild(left);

    taskList.appendChild(row);
  });

  taskCount.textContent =
    items.length + (items.length === 1 ? " task" : " tasks");
}
