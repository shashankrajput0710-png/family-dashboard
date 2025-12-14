import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ---------------- Firebase config (fill with real values) ---------------- */

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
const provider = new GoogleAuthProvider();

/* ---------------- DOM elements (update IDs to match HTML) ---------------- */

// Owner side
const ownerLoginBtn = document.getElementById("owner-login-btn");
const ownerLogoutBtn = document.getElementById("owner-logout-btn");
const ownerStatus = document.getElementById("owner-status");
const familyNameInput = document.getElementById("family-name-input");
const createFamilyBtn = document.getElementById("create-family-btn");
const openDashboardBtn = document.getElementById("open-dashboard-btn");

// Member side
const memberNameInput = document.getElementById("member-name-input");
const memberCodeInput = document.getElementById("member-code-input");
const memberLoginBtn = document.getElementById("member-login-btn");

/* ---------------- Owner login/logout ---------------- */

if (ownerLoginBtn) {
  ownerLoginBtn.onclick = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (ownerStatus) {
        ownerStatus.textContent = `Owner: ${user.displayName || user.email}`;
      }
    } catch (e) {
      alert("Owner Google login error: " + e.message);
    }
  };
}

if (ownerLogoutBtn) {
  ownerLogoutBtn.onclick = async () => {
    await signOut(auth);
    if (ownerStatus) ownerStatus.textContent = "Owner: not logged in";
  };
}

/* ---------------- Create / update family ---------------- */

if (createFamilyBtn) {
  createFamilyBtn.onclick = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in with Google as owner first.");
      return;
    }
    const name = (familyNameInput?.value || "").trim();
    if (!name) {
      alert("Enter a family name first.");
      return;
    }

    try {
      // Use owner uid as family id for simplicity
      const familyId = user.uid;
      const famRef = doc(db, "families", familyId);
      await setDoc(
        famRef,
        {
          name,
          ownerUid: user.uid,
          ownerName: user.displayName || user.email || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert("Family saved. Share this family code with members:\n\n" + familyId);
    } catch (e) {
      alert("Error creating/updating family: " + e.message);
    }
  };
}

/* ---------------- Open family dashboard ---------------- */

if (openDashboardBtn) {
  openDashboardBtn.onclick = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Log in as owner first.");
      return;
    }
    const familyId = user.uid; // must match how you created it above
    window.location.href = `family.html?familyId=${encodeURIComponent(
      familyId
    )}`;
  };
}

/* ---------------- Member: send join request ---------------- */

async function sendJoinRequest() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in with Google first.");
    return;
  }

  const memberName = (memberNameInput?.value || "").trim();
  const familyCode = (memberCodeInput?.value || "").trim();

  if (!familyCode) {
    alert("Enter the family code shared by the owner.");
    return;
  }

  try {
    // optional: verify family exists
    const famSnap = await getDoc(doc(db, "families", familyCode));
    if (!famSnap.exists()) {
      alert("Family not found. Check the code.");
      return;
    }

    await addDoc(collection(db, "joinRequests"), {
      familyId: String(familyCode),
      userUid: String(user.uid),
      name: memberName || (user.displayName || ""),
      email: user.email || "",
      createdAt: serverTimestamp(),
    });

    alert("Join request sent to family owner.");
  } catch (e) {
    alert("Member Google login error: " + e.message);
  }
}

/* ---------------- Member Google login + join ---------------- */

if (memberLoginBtn) {
  memberLoginBtn.onclick = async () => {
    try {
      if (!auth.currentUser) {
        await signInWithPopup(auth, provider);
      }
      await sendJoinRequest();
    } catch (e) {
      alert("Member Google login error: " + e.message);
    }
  };
}

/* ---------------- Auth state display (optional) ---------------- */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (ownerStatus) ownerStatus.textContent = "Owner: not logged in";
    return;
  }
  if (ownerStatus) {
    ownerStatus.textContent = `Owner: ${user.displayName || user.email}`;
  }
});
