/* ================= FRIENDS APP ENGINE ================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signOut,
onAuthStateChanged,
sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
getFirestore,
doc,
setDoc,
getDoc,
collection,
addDoc,
query,
orderBy,
onSnapshot,
updateDoc,
arrayUnion,
arrayRemove,
increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ================= CONFIG ================= */

const firebaseConfig = {
apiKey: "YOUR_API_KEY",
authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
projectId: "YOUR_PROJECT_ID",
storageBucket: "YOUR_PROJECT_ID.appspot.com",
messagingSenderId: "YOUR_SENDER_ID",
appId: "YOUR_APP_ID"
};

let auth, db, isFirebaseReady = false;

try {
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
const app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
isFirebaseReady = true;
}
} catch (e) {
console.log("Local Mode");
}

/* ================= STATE ================= */

let appUser = null;
const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/?d=mp";

if (!localStorage.getItem("local_posts")) localStorage.setItem("local_posts", "[]");
if (!localStorage.getItem("local_users")) localStorage.setItem("local_users", "[]");

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", init);

function init() {
setupAuth();
setupUI();
}

/* ================= AUTH ================= */

function setupAuth() {
if (isFirebaseReady) {
onAuthStateChanged(auth, async (user) => {
if (!user) return showAuth();

const ref = doc(db, "users", user.uid);
const snap = await getDoc(ref);

appUser = snap.exists() ? snap.data() : {
uid: user.uid,
name: user.email,
avatar: DEFAULT_AVATAR,
bio: ""
};

await setDoc(ref, appUser);
hideAuth();
startFeed();
});
} else {
const session = sessionStorage.getItem("local_session");

if (session) {
appUser = JSON.parse(session);
hideAuth();
startFeed();
} else showAuth();
}
}

window.handleEmailAuth = async function(e, mode) {
e.preventDefault();

const email = document.getElementById("login-email").value;
const pass = document.getElementById("login-password").value;

if (mode === "login") {
if (isFirebaseReady) {
await signInWithEmailAndPassword(auth, email, pass);
} else {
const users = JSON.parse(localStorage.getItem("local_users"));
const user = users.find(u => u.email === email && u.pass === pass);
if (!user) return alert("wrong");

appUser = user;
sessionStorage.setItem("local_session", JSON.stringify(user));
hideAuth();
startFeed();
}
}

if (mode === "register") {
const name = document.getElementById("reg-name").value;

if (isFirebaseReady) {
const cred = await createUserWithEmailAndPassword(auth, email, pass);
appUser = { uid: cred.user.uid, name, email, avatar: DEFAULT_AVATAR, bio: "" };
await setDoc(doc(db, "users", cred.user.uid), appUser);
} else {
const users = JSON.parse(localStorage.getItem("local_users"));

const newUser = {
uid: "u_" + Date.now(),
name,
email,
pass,
avatar: DEFAULT_AVATAR,
bio: "",
followers: [],
following: []
};

users.push(newUser);
localStorage.setItem("local_users", JSON.stringify(users));
appUser = newUser;
sessionStorage.setItem("local_session", JSON.stringify(newUser));
}

hideAuth();
startFeed();
}
};

/* ================= POSTS ================= */

window.publishPost = async function () {
const text = document.getElementById("post-textarea").value;
if (!text) return;

const post = {
text,
authorId: appUser.uid,
authorName: appUser.name,
authorAvatar: appUser.avatar,
likesCount: 0,
likedBy: [],
createdAt: Date.now()
};

if (isFirebaseReady) {
await addDoc(collection(db, "posts"), post);
} else {
const posts = JSON.parse(localStorage.getItem("local_posts"));
post.id = "p_" + Date.now();
posts.push(post);
localStorage.setItem("local_posts", JSON.stringify(posts));
renderLocal();
}
};

/* ================= LIKE FIX ================= */

window.likePostEngine = async function(postId) {
if (!appUser) return;

if (isFirebaseReady) {
const ref = doc(db, "posts", postId);
const snap = await getDoc(ref);

const data = snap.data();
const liked = (data.likedBy || []).includes(appUser.uid);

await updateDoc(ref, {
likedBy: liked ? arrayRemove(appUser.uid) : arrayUnion(appUser.uid),
likesCount: increment(liked ? -1 : 1)
});
} else {
const posts = JSON.parse(localStorage.getItem("local_posts"));
const post = posts.find(p => p.id === postId);

if (!post.likedBy) post.likedBy = [];

const i = post.likedBy.indexOf(appUser.uid);

if (i > -1) {
post.likedBy.splice(i, 1);
post.likesCount--;
} else {
post.likedBy.push(appUser.uid);
post.likesCount++;
}

localStorage.setItem("local_posts", JSON.stringify(posts));
renderLocal();
}
};

/* ================= FEED ================= */

function startFeed() {
if (isFirebaseReady) {
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snap) => {
render(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
} else renderLocal();
}

function render(posts) {
const feed = document.getElementById("app-timeline-feed");
feed.innerHTML = posts.map(p => `
<div class="feed-card">
<h4>${p.authorName}</h4>
<p>${p.text}</p>

<button onclick="likePostEngine('${p.id}')">
❤️ ${p.likesCount || 0}
</button>
</div>
`).join("");
}

function renderLocal() {
const posts = JSON.parse(localStorage.getItem("local_posts")) || [];
render(posts.sort((a,b)=>b.createdAt-a.createdAt));
}

/* ================= PROFILE ================= */

window.updateProfileCloudData = async function(name, bio) {
appUser.name = name;
appUser.bio = bio;

if (isFirebaseReady) {
await setDoc(doc(db, "users", appUser.uid), appUser);
} else {
sessionStorage.setItem("local_session", JSON.stringify(appUser));
}
};

/* ================= UI ================= */

function setupUI() {}

function showAuth() {
document.getElementById("auth-screen-overlay")?.style.setProperty("display","flex");
}

function hideAuth() {
document.getElementById("auth-screen-overlay")?.style.setProperty("display","none");
}
