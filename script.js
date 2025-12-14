
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* -------- 1. Firebase config (PUT YOUR VALUES) ---------- */
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

/* -------- 2. DOM elements ---------- */
const topStatus = document.getElementById("top-status");

/* Owner DOM */
const ownerLoginBtn = document.getElementById("owner-login-btn");
const ownerStatus = document.getElementById("owner-status");
const familyNameInput = document.getElementById("family-name-input");
const createFamilyBtn = document.getElementById("create-family-btn");
const familyCodeLine = document.getElementById("family-code-line");
const ownerArea = document.getElementById("owner-area");
const ownerMemberList = document.getElementById("owner-member-list");
const ownerMemberCount = document.getElementById("owner-member-count");
const openFamilyDashboardBtn = document.getElementById("open-family-dashboard-btn");


/* New: requests list */
const requestList = document.getElementById("request-list");
const requestCount = document.getElementById("request-count");

/* Member DOM */
const memberNameInput = document.getElementById("member-name");
const memberFamilyCodeInput = document.getElementById("member-family-code");
const memberGoogleBtn = document.getElementById("member-google-btn");
const memberStatus = document.getElementById("member-status");
const memberInfo = document.getElementById("member-info");

/* State */
let ownerUser = null;
let ownerFamilyId = null;
let ownerMembersUnsub = null;
let requestsUnsub = null;

let memberUser = null;

/* -------- 3. Helpers ---------- */
function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function getOwnerFamily(ownerUid) {
  const q = query(
    collection(db, "families"),
    where("ownerUid", "==", ownerUid)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/* -------- 4. Auth provider ---------- */
const googleProvider = new GoogleAuthProvider();

/* -------- 5. Owner login + family ---------- */
ownerLoginBtn.addEventListener("click", async () => {
  if (ownerUser) {
    await signOut(auth);
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    alert("Owner auth error: " + err.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  ownerUser = user;
  if (!user) {
  ownerArea.style.display = "none";
  ownerStatus.textContent = "Not logged in";
  topStatus.textContent =
    "Owner creates family code. Members request to join with that code.";
  if (ownerMembersUnsub) ownerMembersUnsub();
  if (requestsUnsub) requestsUnsub();
  ownerMembersUnsub = null;
  requestsUnsub = null;
  openFamilyDashboardBtn.disabled = true;
  return;
}

  ownerArea.style.display = "block";
  ownerStatus.textContent = "Owner: " + (user.displayName || user.email);
  topStatus.textContent =
    "Owner logged in. Share your family code only with people you know.";

  let fam = await getOwnerFamily(user.uid);
  if (!fam) {
    familyCodeLine.textContent =
      "No family yet. Enter a name and click Create / Update.";
    ownerFamilyId = null;
  } else {
    ownerFamilyId = fam.id;
    familyNameInput.value = fam.name || "";
    familyCodeLine.textContent = "Family code: " + fam.familyCode;
    startOwnerMembersListener();
    startRequestsListener();
openFamilyDashboardBtn.disabled = !ownerFamilyId;
openFamilyDashboardBtn.onclick = () => {
  if (!ownerFamilyId) return;
  window.location.href = `family.html?familyId=${ownerFamilyId}`;
};

  }
});

createFamilyBtn.addEventListener("click", async () => {
  if (!ownerUser) {
    alert("Login as owner first.");
    return;
  }
  const name = familyNameInput.value.trim() || "My Family";
  let fam = await getOwnerFamily(ownerUser.uid);
  const newCode = randomCode(6);

  try {
   if (!fam) {
  const docRef = await addDoc(collection(db, "families"), {
    ownerUid: ownerUser.uid,
    name,
    familyCode: newCode,
    createdAt: serverTimestamp(),
  });
  ownerFamilyId = docRef.id;
} else {
  await setDoc(
    doc(db, "families", fam.id),
    { name, familyCode: newCode },
    { merge: true }
  );
  ownerFamilyId = fam.id;
}

    // ensure owner is also a member of their own family
    try {
      const existingOwnerMemberSnap = await getDocs(
        query(
          collection(db, "familyMembers"),
          where("familyId", "==", ownerFamilyId),
          where("userUid", "==", ownerUser.uid)
        )
      );
      if (existingOwnerMemberSnap.empty) {
        await addDoc(collection(db, "familyMembers"), {
          familyId: ownerFamilyId,
          userUid: ownerUser.uid,
          name: ownerUser.displayName || "Owner",
          role: "owner",
          memberCode: "N/A",
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Error ensuring owner member:", e);
    }

familyCodeLine.textContent =
  "Family code: " +
  newCode +
  "  (members must use this to send join requests)";
startOwnerMembersListener();
startRequestsListener();
 
  } catch (err) {
    alert("Error creating/updating family: " + err.message);
  }
});

/* -------- 6. Owner: live members + requests ---------- */
function startOwnerMembersListener() {
  if (!ownerFamilyId) return;
  if (ownerMembersUnsub) ownerMembersUnsub();

  const qMembers = query(
    collection(db, "familyMembers"),
    where("familyId", "==", ownerFamilyId)
  );
  ownerMembersUnsub = onSnapshot(qMembers, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    renderOwnerMembers(items);
  });
}

function renderOwnerMembers(items) {
  ownerMemberList.innerHTML = "";
  if (!items.length) {
    ownerMemberList.innerHTML =
      "<div class='empty'>No approved members yet.</div>";
    ownerMemberCount.textContent = "0 members";
    return;
  }

  items.forEach((m) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = m.name || "(no name)";
    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Approved member";
    left.appendChild(label);
    left.appendChild(sub);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary";
    delBtn.textContent = "Remove";
    delBtn.onclick = async () => {
      if (!confirm("Remove " + (m.name || "this member") + "?")) return;
      try {
        await deleteDoc(doc(db, "familyMembers", m.id));
      } catch (err) {
        alert("Error removing member: " + err.message);
      }
    };

    row.appendChild(left);
    row.appendChild(delBtn);
    ownerMemberList.appendChild(row);
  });

  ownerMemberCount.textContent =
    items.length + (items.length === 1 ? " member" : " members");
}

function startRequestsListener() {
  if (!ownerFamilyId) return;
  if (requestsUnsub) requestsUnsub();

  const qReq = query(
    collection(db, "joinRequests"),
    where("familyId", "==", ownerFamilyId),
    where("status", "==", "pending")
  );
  requestsUnsub = onSnapshot(qReq, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    renderRequests(items);
  });
}

function renderRequests(items) {
  requestList.innerHTML = "";
  if (!items.length) {
    requestList.innerHTML =
      "<div class='empty'>No pending requests.</div>";
    requestCount.textContent = "0 pending";
    return;
  }

  items.forEach((r) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const left = document.createElement("div");
    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = r.name || "(no name)";
    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Requested to join";
    left.appendChild(label);
    left.appendChild(sub);

    const actions = document.createElement("div");

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "btn btn-primary";
    acceptBtn.textContent = "Accept";
    acceptBtn.onclick = () => approveRequest(r);

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn btn-secondary";
    rejectBtn.style.marginLeft = "6px";
    rejectBtn.textContent = "Reject";
    rejectBtn.onclick = () => rejectRequest(r);

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);

    row.appendChild(left);
    row.appendChild(actions);
    requestList.appendChild(row);
  });

  requestCount.textContent =
    items.length + (items.length === 1 ? " pending" : " pending");
}

async function approveRequest(r) {
  if (!confirm("Approve " + (r.name || "this request") + "?")) return;
  try {
    const memberCode = randomCode(8);
    await addDoc(collection(db, "familyMembers"), {
      familyId: r.familyId,
      userUid: r.userUid,
      name: r.name,
      memberCode,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "joinRequests", r.id), {
      status: "approved",
    });
  } catch (err) {
    alert("Error approving request: " + err.message);
  }
}

async function rejectRequest(r) {
  if (!confirm("Reject " + (r.name || "this request") + "?")) return;
  try {
    await updateDoc(doc(db, "joinRequests", r.id), {
      status: "rejected",
    });
  } catch (err) {
    alert("Error rejecting request: " + err.message);
  }
}

/* -------- 7. Member join via Google (sends request) ---------- */
memberGoogleBtn.addEventListener("click", async () => {
  const name = memberNameInput.value.trim();
  const familyCode = memberFamilyCodeInput.value.trim().toUpperCase();

  if (!name || !familyCode) {
    alert("Enter your name and the family code.");
    return;
  }

  try {
    // 1) Google sign-in
    const res = await signInWithPopup(auth, googleProvider);
    memberUser = res.user;

    // 2) Find family by code
    const famSnap = await getDocs(
      query(collection(db, "families"), where("familyCode", "==", familyCode))
    );
    if (famSnap.empty) {
      alert("No family found with that code.");
      return;
    }
    const famDoc = famSnap.docs[0];
    const familyId = famDoc.id;

    // 3) Check if already approved member
    const existingMember = await getDocs(
      query(
        collection(db, "familyMembers"),
        where("familyId", "==", familyId),
        where("userUid", "==", memberUser.uid)
      )
    );
    if (!existingMember.empty) {
      memberStatus.textContent = "Already a member of this family.";
      memberInfo.textContent =
        "Opening family dashboard...";
      window.location.href = `family.html?familyId=${familyId}`;
      return;
    }

    // 4) Create join request (or reuse pending one)
    const pendingSnap = await getDocs(
      query(
        collection(db, "joinRequests"),
        where("familyId", "==", familyId),
        where("userUid", "==", memberUser.uid),
        where("status", "==", "pending")
      )
    );
    if (pendingSnap.empty) {
      await addDoc(collection(db, "joinRequests"), {
        familyId,
        userUid: memberUser.uid,
        name,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    }

    memberStatus.textContent = "Request sent";
    memberInfo.textContent =
      "Your join request has been sent to the family owner. " +
      "You will be able to enter the family dashboard after they approve.";
  } catch (err) {
    alert("Member Google login error: " + err.message);
  }
});
