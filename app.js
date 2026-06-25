import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
getAuth,
onAuthStateChanged,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
getFirestore,
doc,
setDoc,
getDoc,
getDocs,
collection,
addDoc,
query,
orderBy,
onSnapshot,
updateDoc,
arrayUnion,
arrayRemove,
increment,
where,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
apiKey: "YOUR_API_KEY",
authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
projectId: "YOUR_PROJECT_ID",
appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
if (!user) return showAuthOverlay();

const userRef = doc(db, "users", user.uid);
const snap = await getDoc(userRef);

if (!snap.exists()) {
await setDoc(userRef, {
uid: user.uid,
name: user.displayName || "User",
avatar: "",
bio: "",
followers: [],
following: []
});
}

currentUser = (await getDoc(userRef)).data();

hideAuthOverlay();
loadFeed();
loadUsers();
});

/* ================= POSTS ================= */

function loadFeed() {
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snap) => {
const feed = document.getElementById("app-timeline-feed");
feed.innerHTML = "";

snap.forEach(docSnap => {
const p = docSnap.data();

feed.innerHTML += `
<div class="feed-card">
<h4>${p.authorName}</h4>
<p>${p.text}</p>

<button onclick="likePost('${docSnap.id}')">❤️ ${p.likesCount || 0}</button>
<button onclick="openChat('${p.authorId}')">💬</button>
</div>
`;
});
});
}

window.publishPost = async function() {
const text = document.getElementById("post-textarea").value;

await addDoc(collection(db, "posts"), {
text,
authorId: currentUser.uid,
authorName: currentUser.name,
likesCount: 0,
createdAt: serverTimestamp()
});
};

/* ================= LIKE ================= */

window.likePost = async function(postId) {
const ref = doc(db, "posts", postId);
const snap = await getDoc(ref);

const data = snap.data();
const liked = data.likedBy?.includes(currentUser.uid);

await updateDoc(ref, {
likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
likesCount: increment(liked ? -1 : 1)
});
};

/* ================= FOLLOW SYSTEM ================= */

window.followUser = async function(uid) {
const ref = doc(db, "users", uid);

await updateDoc(ref, {
followers: arrayUnion(currentUser.uid)
});

const meRef = doc(db, "users", currentUser.uid);

await updateDoc(meRef, {
following: arrayUnion(uid)
});

/* notification */
await addDoc(collection(db, "notifications"), {
to: uid,
type: "follow",
from: currentUser.uid,
text: `${currentUser.name} followed you`,
createdAt: serverTimestamp()
});
};

/* ================= CHAT ================= */

function convoId(a,b){
return [a,b].sort().join("_");
}

window.openChat = function(uid){
window.activeChat = uid;
listenMessages(uid);
};

window.sendDirectMessage = async function(text){
const cid = convoId(currentUser.uid, window.activeChat);

await addDoc(collection(db,"conversations",cid,"messages"),{
senderId: currentUser.uid,
text,
createdAt: Date.now()
});

await addDoc(collection(db,"notifications"),{
to: window.activeChat,
type:"message",
from: currentUser.uid,
text:"رسالة جديدة",
createdAt: serverTimestamp()
});
};

function listenMessages(uid){
const cid = convoId(currentUser.uid, uid);

const q = query(collection(db,"conversations",cid,"messages"),orderBy("createdAt"));

onSnapshot(q,(snap)=>{
const box = document.getElementById("chat-messages-box");
box.innerHTML="";

snap.forEach(m=>{
const d = m.data();
box.innerHTML += `
<div class="${d.senderId===currentUser.uid?'outgoing':'incoming'} msg-bubble">
${d.text}
</div>
`;
});
});
}

/* ================= USERS ================= */

function loadUsers(){
const q = query(collection(db,"users"));

getDocs(q).then(snap=>{
const box = document.getElementById("active-friends-list");
box.innerHTML="";

snap.forEach(u=>{
const user = u.data();
if(user.uid===currentUser.uid) return;

box.innerHTML += `
<div class="chat-user-item" onclick="openChat('${user.uid}')">
<img src="${user.avatar}" class="user-avatar">
<div>
<h4>${user.name}</h4>
<button onclick="followUser('${user.uid}')">Follow</button>
</div>
</div>
`;
});
});
}

/* ================= UI ================= */

function showAuthOverlay(){
document.getElementById("auth-screen-overlay").style.display="flex";
}

function hideAuthOverlay(){
document.getElementById("auth-screen-overlay").style.display="none";
}
<script type="module">
import "./app.js";

document.getElementById("send-msg-btn").onclick = () => {
const input = document.getElementById("chat-message-input");
window.sendDirectMessage(input.value);
input.value="";
};
</script>
