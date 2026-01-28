import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// !!! BURAYA KENDİ CONFIG BİLGİLERİNİ YAZ !!!
const firebaseConfig = {
    apiKey: "AIzaSyAJCaVbW6deIs0WYYKd73vZ-O6FqTY6H3w",
    authDomain: "forum-3f66d.firebaseapp.com",
    databaseURL: "https://forum-3f66d-default-rtdb.firebaseio.com",
    projectId: "forum-3f66d",
    storageBucket: "forum-3f66d.firebasestorage.app",
    messagingSenderId: "528376949617",
    appId: "1:528376949617:web:3e3e4cbd85b49f6f4964d0",
    measurementId: "G-VVRF3YSGW3"
};

// !!! BURAYA KENDİ ADMIN UID'Nİ YAZ !!!
const ADMIN_UID = "BURAYA_SENIN_UID_GELECEK"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let activeTopicId = null;

// GLOBAL FONKSİYONLAR (HTML'den erişilebilsin diye window'a atıyoruz)
window.signIn = () => signInWithPopup(auth, provider);
window.signOutUser = () => { if(confirm("Çıkış yapılsın mı?")) signOut(auth); };
window.openCreateModal = () => {
    if(!currentUser) return alert("Parşömen yazmak için giriş yapmalısın!");
    document.getElementById('createModal').style.display = 'flex';
};
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

// AUTH STATE LISTENER
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userMenu').style.display = 'flex';
        document.getElementById('navUserImg').src = user.photoURL;
        document.getElementById('navUserName').innerText = user.displayName.split(' ')[0];
    } else {
        document.getElementById('loginBtn').style.display = 'flex';
        document.getElementById('userMenu').style.display = 'none';
    }
});

// KONULARI ÇEKME
const topicsRef = ref(db, 'topics');
onValue(topicsRef, (snapshot) => {
    const container = document.getElementById('topicsContainer');
    container.innerHTML = '';
    const data = snapshot.val();

    if (!data) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted)">Henüz hiç konu yok.</div>';
        return;
    }

    const topics = Object.entries(data).map(([id, t]) => ({ id, ...t })).reverse();

    topics.forEach(topic => {
        const timeAgo = getTimeAgo(topic.createdAt);
        // HTML Template
        const html = `
        <div class="topic-card">
            <div class="card-header">
                <img src="${topic.authorPhoto}" class="author-avatar" onclick="openProfile('${topic.uid}', '${escapeHtml(topic.author)}', '${topic.authorPhoto}')">
                <div class="card-content">
                    <div onclick="openDetail('${topic.id}')">
                        <h3 class="card-title">${escapeHtml(topic.title)}</h3>
                        <div class="card-meta">
                            <span style="color:var(--primary); font-weight:600;">${escapeHtml(topic.author)}</span> &bull; ${timeAgo}
                        </div>
                        <div class="card-text">${escapeHtml(topic.content)}</div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="stat-btn" onclick="openDetail('${topic.id}')"><i class="far fa-comment-dots"></i> Yanıtla</button>
                <button class="stat-btn"><i class="far fa-eye"></i> İncele</button>
            </div>
        </div>`;
        container.innerHTML += html;
    });
});

// DETAY GÖRÜNÜMÜ
window.openDetail = function(id) {
    activeTopicId = id;
    const contentDiv = document.getElementById('detailContent');
    
    onValue(ref(db, 'topics/' + id), (snapshot) => {
        const topic = snapshot.val();
        if(!topic) return;

        let codeBlockHTML = '';
        if(topic.code) {
            codeBlockHTML = `<div style="background:#0f1115; border:1px solid var(--border); border-radius:6px; margin-top:15px;"><pre><code class="language-lua">${escapeHtml(topic.code)}</code></pre></div>`;
        }

        contentDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
                <img src="${topic.authorPhoto}" style="width:45px; height:45px; border-radius:50%; border:2px solid var(--primary);">
                <div>
                    <div style="font-weight:700; font-family:'Rajdhani'; font-size:1.1rem; color:white;">${escapeHtml(topic.author)}</div>
                    <div style="font-size:0.8rem; color:var(--primary);">${getTimeAgo(topic.createdAt)}</div>
                </div>
            </div>
            <h1 style="font-family:'Rajdhani'; margin-bottom:20px; font-size:2rem; line-height:1.2; color:var(--text-main);">${escapeHtml(topic.title)}</h1>
            <div style="line-height:1.7; color:#d1d5db; white-space:pre-wrap; font-size:1rem;">${escapeHtml(topic.content)}</div>
            ${codeBlockHTML}
        `;

        loadComments(id);
        document.getElementById('detailModal').style.display = 'flex';
        setTimeout(() => Prism.highlightAll(), 50);
    }, { onlyOnce: true });
};

// YORUMLARI YÜKLE
function loadComments(topicId) {
    const list = document.getElementById('commentsList');
    onValue(ref(db, 'comments/' + topicId), (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if(!data) {
            list.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">Henüz yorum yok.</div>';
            return;
        }
        Object.values(data).forEach(c => {
            list.innerHTML += `
            <div style="display:flex; gap:12px; margin-bottom:15px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">
                <img src="${c.userPhoto}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                <div>
                    <div style="font-weight:700; font-size:0.9rem; color:var(--primary); font-family:'Rajdhani';">${escapeHtml(c.userName)}</div>
                    <div style="color:#e5e5e5; font-size:0.95rem; margin-top:3px;">${escapeHtml(c.text)}</div>
                </div>
            </div>`;
        });
    });
}

// PROFİL SİSTEMİ
window.openProfile = function(uid, name, photo) {
    document.getElementById('profileName').innerText = name;
    document.getElementById('profileImg').src = photo;
    
    onValue(ref(db, 'topics'), (snapshot) => {
        let count = 0;
        const data = snapshot.val();
        if(data) {
            Object.values(data).forEach(t => { if(t.uid === uid) count++; });
        }
        
        document.getElementById('statTopicCount').innerText = count;
        const level = Math.floor(count / 3) + 1;
        document.getElementById('statLevel').innerText = level;

        const badgesDiv = document.getElementById('profileBadges');
        badgesDiv.innerHTML = `<span class="badge level-badge">LVL ${level}</span>`;
        
        if(uid === ADMIN_UID) {
            badgesDiv.innerHTML += `<span class="badge badge-admin">YÖNETİCİ</span>`;
        } else {
            badgesDiv.innerHTML += `<span class="badge badge-member">ÜYE</span>`;
        }

        document.getElementById('profileModal').style.display = 'flex';
    }, { onlyOnce: true });
};

window.openMyProfile = () => {
    if(currentUser) openProfile(currentUser.uid, currentUser.displayName, currentUser.photoURL);
};

// FORM EVENTLERİ
document.getElementById('createForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentUser) return alert("Giriş yapmalısın!");
    
    push(ref(db, 'topics'), {
        title: document.getElementById('topicTitle').value,
        content: document.getElementById('topicContent').value,
        code: document.getElementById('topicCode').value,
        author: currentUser.displayName,
        uid: currentUser.uid,
        authorPhoto: currentUser.photoURL,
        createdAt: Date.now()
    }).then(() => {
        document.getElementById('createModal').style.display = 'none';
        e.target.reset();
    });
});

document.getElementById('commentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentUser) return alert("Giriş yapmalısın!");
    
    const input = document.getElementById('commentInput');
    push(ref(db, 'comments/' + activeTopicId), {
        userName: currentUser.displayName,
        userPhoto: currentUser.photoURL,
        text: input.value,
        createdAt: Date.now()
    });
    input.value = '';
});

// YARDIMCI FONKSİYONLAR
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Az önce";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " dk önce";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " saat önce";
    return Math.floor(hours / 24) + " gün önce";
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) event.target.style.display = "none";
};