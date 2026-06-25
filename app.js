/* ======================================================================
   Friends App Engine FIXED - Stable Social Core (2026)
   ====================================================================== */

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

/* ================= Firebase Config ================= */
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let auth = null;
let db = null;
let isFirebaseReady = false;

/* ================= Init Firebase ================= */
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseReady = true;
    }
} catch (e) {
    console.warn("Firebase OFF - Local Mode");
}

/* ================= Global State ================= */
let appUser = null;
const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/?d=mp";

/* ================= Local Storage Init ================= */
if (!localStorage.getItem("local_posts")) localStorage.setItem("local_posts", "[]");
if (!localStorage.getItem("local_users")) localStorage.setItem("local_users", "[]");

/* ================= Boot ================= */
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    if (isFirebaseReady) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);

                if (!snap.exists()) {
                    appUser = {
                        uid: user.uid,
                        name: user.displayName || "User",
                        email: user.email,
                        avatar: DEFAULT_AVATAR,
                        bio: ""
                    };
                    await setDoc(ref, appUser);
                } else {
                    appUser = snap.data();
                }

                hideAuth();
                startFeed();
            } else {
                showAuth();
            }
        });
    } else {
        const session = sessionStorage.getItem("local_session");

        if (session) {
            appUser = JSON.parse(session); // 🔴 FIX مهم جداً
            hideAuth();
            startFeed();
        } else {
            showAuth();
        }
    }

    setupUI();
}

/* ================= AUTH ================= */
window.handleEmailAuth = async function (e, mode) {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value;
    const pass = document.getElementById("login-password")?.value;

    if (mode === "login") {
        if (isFirebaseReady) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const users = JSON.parse(localStorage.getItem("local_users"));
            const found = users.find(u => u.email === email && u.pass === pass);

            if (!found) return alert("invalid");

            appUser = found;
            sessionStorage.setItem("local_session", JSON.stringify(appUser));
            hideAuth();
            startFeed();
        }
    }

    if (mode === "register") {
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const pass = document.getElementById("reg-password").value;

        if (isFirebaseReady) {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);

            appUser = {
                uid: cred.user.uid,
                name,
                email,
                avatar: DEFAULT_AVATAR,
                bio: ""
            };

            await setDoc(doc(db, "users", cred.user.uid), appUser);
        } else {
            const users = JSON.parse(localStorage.getItem("local_users"));

            const newUser = {
                uid: "local_" + Date.now(),
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
            sessionStorage.setItem("local_session", JSON.stringify(appUser));
        }

        hideAuth();
        startFeed();
    }
};

/* ================= POSTS ================= */
window.publishPost = async function () {
    const text = document.getElementById("post-textarea").value.trim();
    if (!text) return;

    const post = {
        text,
        authorId: appUser.uid,
        authorName: appUser.name,
        authorAvatar: appUser.avatar,
        likesCount: 0,
        likedBy: [],
        comments: [],
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

/* ================= LIKE ENGINE FIX ================= */
window.likePostEngine = async function (postId) {
    if (!appUser?.uid) return;

    if (isFirebaseReady) {
        const ref = doc(db, "posts", postId);
        const snap = await getDoc(ref);

        if (!snap.exists()) return;

        const data = snap.data();
        const liked = (data.likedBy || []).includes(appUser.uid);

        await updateDoc(ref, {
            likedBy: liked ? arrayRemove(appUser.uid) : arrayUnion(appUser.uid),
            likesCount: increment(liked ? -1 : 1)
        });

    } else {
        const posts = JSON.parse(localStorage.getItem("local_posts"));
        const post = posts.find(p => p.id === postId);

        if (!post) return;

        if (!post.likedBy) post.likedBy = [];

        const index = post.likedBy.indexOf(appUser.uid);

        if (index > -1) {
            post.likedBy.splice(index, 1);
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
    const feed = document.getElementById("app-timeline-feed");
    if (!feed) return;

    if (isFirebaseReady) {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

        onSnapshot(q, (snap) => {
            const posts = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            render(posts);
        });
    } else {
        renderLocal();
    }
}

/* ================= RENDER ================= */
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
    render(posts.sort((a,b) => b.createdAt - a.createdAt));
}

/* ================= UI ================= */
function setupUI() {}

function showAuth() {
    document.getElementById("auth-screen-overlay")?.style.setProperty("display", "flex");
}

function hideAuth() {
    document.getElementById("auth-screen-overlay")?.style.setProperty("display", "none");
}
