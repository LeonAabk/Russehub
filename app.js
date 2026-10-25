/**
 * RussHub - Russegruppe Sentral
 * Modular Firebase v9+ & Authentic Streetwear Russe Portal
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDocFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- Required Firestore Error Handling ---
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const currentAuth = window.RussApp?.auth?.currentUser;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.uid || null,
      email: currentAuth?.email || null,
      emailVerified: currentAuth?.emailVerified || null,
      isAnonymous: currentAuth?.isAnonymous || null,
      tenantId: currentAuth?.tenantId || null,
      providerInfo: currentAuth?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  return errInfo;
}

// --- Initial Groups Seed ---
const defaultGroup = {
  id: 'kronen-2026',
  name: 'Kronen 2026',
  code: 'KRON-2026',
  creatorId: 'user-mathias-admin',
  creatorName: 'Mathias',
  budgetGoal: 250000,
  schoolOrCity: 'Valler VGS / Oslo',
  createdAt: new Date().toISOString(),
  members: [
    {
      userId: 'user-mathias-admin',
      displayName: 'Mathias',
      email: 'mathias@russhub.no',
      role: 'admin',
      roleTitle: 'Bussjef / Administrator',
      joinedAt: '2026-08-15'
    },
    {
      userId: 'user-tobias-eco',
      displayName: 'Tobias',
      email: 'tobias@russhub.no',
      role: 'economy',
      roleTitle: 'Økonomiansvarlig',
      joinedAt: '2026-08-16'
    },
    {
      userId: 'user-sarah-dugnad',
      displayName: 'Sarah',
      email: 'sarah@russhub.no',
      role: 'dugnad',
      roleTitle: 'Dugnadsansvarlig',
      joinedAt: '2026-08-17'
    },
    {
      userId: 'user-henrik-lyd',
      displayName: 'Henrik',
      email: 'henrik@russhub.no',
      role: 'member',
      roleTitle: 'Lydsjef',
      joinedAt: '2026-08-18'
    },
    {
      userId: 'user-emma-konsept',
      displayName: 'Emma',
      email: 'emma@russhub.no',
      role: 'member',
      roleTitle: 'Konsept & PR',
      joinedAt: '2026-08-19'
    }
  ]
};

// --- Application State ---
const state = {
  currentUser: null,
  isFirebaseConnected: false,
  activeView: 'overview',
  groups: [defaultGroup],
  activeGroupId: localStorage.getItem('russe_active_group_id') || defaultGroup.id,
  events: [],
  transactions: [],
  media: [],
  notices: [],
  filters: {
    eventCategory: 'Alle',
    budgetFilter: 'Alle',
    mediaCategory: 'Alle'
  },
  unsubscribers: []
};

window.RussApp = { state };

// --- Pure Helpers ---
function formatCurrencyNOK(amount) {
  const rounded = Math.round(Number(amount) || 0);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} kr`;
}

function calculateBudgetSummary(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryBreakdown = {};

  for (const t of transactions) {
    const val = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += val;
    } else {
      totalExpense += val;
      const cat = t.category || 'Annet';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + val;
    }
  }

  const balance = totalIncome - totalExpense;
  return { totalIncome, totalExpense, balance, categoryBreakdown };
}

function getDaysUntilRT() {
  const now = new Date();
  const currentYear = now.getFullYear();
  let rtDate = new Date(currentYear, 4, 1);
  if (now > rtDate) {
    rtDate = new Date(currentYear + 1, 4, 1);
  }
  const diffTime = rtDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getActiveGroup() {
  return state.groups.find(g => g.id === state.activeGroupId) || state.groups[0] || defaultGroup;
}

function getCurrentUserRole() {
  const group = getActiveGroup();
  if (!state.currentUser) {
    return {
      role: 'admin',
      roleTitle: 'Bussjef / Administrator',
      isAdmin: true,
      name: 'Mathias (Demo)'
    };
  }
  const uid = state.currentUser.uid;
  const member = group.members?.find(m => m.userId === uid || m.email === state.currentUser.email);
  if (member) {
    return {
      role: member.role,
      roleTitle: member.roleTitle,
      isAdmin: member.role === 'admin',
      name: member.displayName || state.currentUser.displayName
    };
  }
  if (group.creatorId === uid) {
    return {
      role: 'admin',
      roleTitle: 'Bussjef / Administrator',
      isAdmin: true,
      name: state.currentUser.displayName || 'Bussjef'
    };
  }
  return {
    role: 'member',
    roleTitle: 'Medlem',
    isAdmin: false,
    name: state.currentUser.displayName || 'Medlem'
  };
}

// High-fidelity SVG Mock Generator
function createSvgDataUrl(title, color1, color2, iconText) {
  const safeTitle = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeIcon = String(iconText).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#g)" rx="8"/>
    <rect x="20" y="20" width="560" height="360" rx="6" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <text x="300" y="160" font-family="ui-monospace, monospace" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle">${safeIcon}</text>
    <text x="300" y="230" font-family="system-ui, sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
    <text x="300" y="270" font-family="ui-monospace, monospace" font-size="13" fill="rgba(255,255,255,0.7)" text-anchor="middle">[DOKUMENT: KRONEN-2026 // SIKRET]</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Seed Mock Data
const defaultEvents = [
  {
    id: 'seed-e1',
    groupId: 'kronen-2026',
    title: 'Dugnad: Doruller & Tørkerull utlevering',
    date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    time: '10:00',
    category: 'Dugnad',
    location: 'Garasjen til Emil',
    notes: 'Møt opp med bil og henger. Dugnadskassen trenger dette salget!',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-e2',
    groupId: 'kronen-2026',
    title: 'Konseptmøte & Logo review',
    date: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
    time: '18:00',
    category: 'Møte',
    location: 'Klubbhuset',
    notes: 'Gjennomgang av skisser og fargepalett sammen med designeren.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-e3',
    groupId: 'kronen-2026',
    title: 'Rullekveld / Lyd & Lys testkjøring',
    date: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    time: '20:30',
    category: 'Rulling',
    location: 'Oppmøte Circle K',
    notes: 'Sjekk at aggregat og subwoofere fungerer knirkefritt.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-e4',
    groupId: 'kronen-2026',
    title: 'Første Slippfest 2026',
    date: new Date(Date.now() + 86400000 * 25).toISOString().split('T')[0],
    time: '21:00',
    category: 'Fest',
    location: 'Sentrum Arena',
    notes: 'Husk russekort, ID og godt humør.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-e5',
    groupId: 'kronen-2026',
    title: 'Frist: Andre innbetaling til russekonto',
    date: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
    time: '23:59',
    category: 'Deadline',
    location: 'Kontooverføring / Vipps',
    notes: 'Alle må overføre 5 000 kr til felleskonto innen midnatt.',
    createdAt: new Date().toISOString()
  }
];

const defaultTransactions = [
  {
    id: 'seed-t1',
    groupId: 'kronen-2026',
    title: 'Dugnad: Salg av kransekaker og kjeks',
    amount: 38500,
    type: 'income',
    category: 'Dugnad',
    date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    payer: 'Dugnadssjef Sarah',
    notes: 'Overskudd fra 350 solgte kakebokser',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-t2',
    groupId: 'kronen-2026',
    title: 'Sponsoravtale: Sparebank & Bilservice',
    amount: 25000,
    type: 'income',
    category: 'Sponsor',
    date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    payer: 'Sponsorgruppe',
    notes: 'Avtale om logo på bakrute og russejakker',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-t3',
    groupId: 'kronen-2026',
    title: 'Depositum: Bussleie & kontrakt',
    amount: 45000,
    type: 'expense',
    category: 'Buss/Van',
    date: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
    payer: 'Økonomisjef Tobias',
    notes: 'Første av tre delbetalinger',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-t4',
    groupId: 'kronen-2026',
    title: 'Depositum Lyd & Lysrigg',
    amount: 18000,
    type: 'expense',
    category: 'Lyd/Lys',
    date: new Date(Date.now() - 86400000 * 8).toISOString().split('T')[0],
    payer: 'Lydsjef Henrik',
    notes: 'Inkludert forsterkere, strober og miksepult',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-t5',
    groupId: 'kronen-2026',
    title: 'Felles Russegensere & Bånd',
    amount: 14200,
    type: 'expense',
    category: 'Merch/Klær',
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    payer: 'Konseptsjef',
    notes: 'Broderte hoodies med logotrykk til 18 medlemmer',
    createdAt: new Date().toISOString()
  }
];

const defaultMedia = [
  {
    id: 'seed-m1',
    groupId: 'kronen-2026',
    title: 'Signert Leiekontrakt Russebuss 2026',
    category: 'Kontrakt',
    url: createSvgDataUrl('Signert Leiekontrakt Russebuss', '#991b1b', '#3b0a0a', '📄 KONTRAKT'),
    fileType: 'image/svg+xml',
    uploadedBy: 'Bussjef',
    uploaderName: 'Mathias (Admin)',
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString()
  },
  {
    id: 'seed-m2',
    groupId: 'kronen-2026',
    title: 'Logo & Konseptskisse Versjon 3',
    category: 'Skisse/Logo',
    url: createSvgDataUrl('Konseptskisse & Logodesign', '#b45309', '#451a03', '🎨 LOGO'),
    fileType: 'image/svg+xml',
    uploadedBy: 'Konseptsjef',
    uploaderName: 'Emma (Konsept)',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString()
  },
  {
    id: 'seed-m3',
    groupId: 'kronen-2026',
    title: 'Kvittering Forskudd Lyd & Lysrigg',
    category: 'Kvittering',
    url: createSvgDataUrl('Kvittering Lyd & Lysrigg', '#1e40af', '#0f172a', '🧾 KVITTERING'),
    fileType: 'image/svg+xml',
    uploadedBy: 'Økonomisjef',
    uploaderName: 'Tobias (Økonomi)',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  }
];

const defaultNotices = [
  {
    id: 'seed-n1',
    groupId: 'kronen-2026',
    title: 'VIKTIG: Frist for dugnadsoppgjør fredag kl 20:00!',
    content: 'Hei alle sammen! Husk at alle må ha levert inn pengene fra kakesalget innen fredag kveld. Pengene overføres direkte til russekontoen eller via Vipps til Tobias. Vi må betale andre avdrag på bussen på mandag, så ingen forsinkelser takk!',
    isPinned: true,
    authorName: 'Tobias (Økonomisjef)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'seed-n2',
    groupId: 'kronen-2026',
    title: 'Møte om rulleliste og sjåførvakter neste uke',
    content: 'Vi samles i klubbhuset onsdag kl 18. Vi skal sette opp den endelige rulleplanen for landstreffet og fordele hvem som sitter på når. Ta med forslag til spillelister og godt humør!',
    isPinned: false,
    authorName: 'Mathias (Bussjef)',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
  }
];

// Embedded fallback configuration for GitHub / offline / standalone hosting
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "zany-arbor-2bcxw",
  appId: "1:115701689159:web:3ce374ed21888b948dba62",
  apiKey: "AIzaSyDMsWhrZ5hnaGQNJ1Um5hUn19kUllD6fec",
  authDomain: "zany-arbor-2bcxw.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-f350e8e1-af13-42cf-bed2-6e624e6a42ba",
  storageBucket: "zany-arbor-2bcxw.firebasestorage.app",
  messagingSenderId: "115701689159",
  measurementId: "",
  oAuthClientId: "115701689159-87gr38vda4u7d765di8kjtr9vj5lhjb5.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// --- Initialize Firebase Services ---
async function setupFirebase() {
  try {
    let config = null;
    try {
      const configRes = await fetch('./firebase-applet-config.json');
      if (configRes.ok) {
        config = await configRes.json();
      } else {
        const rootRes = await fetch('/firebase-applet-config.json');
        if (rootRes.ok) config = await rootRes.json();
      }
    } catch {
      config = DEFAULT_FIREBASE_CONFIG;
    }

    if (!config || !config.projectId) {
      config = DEFAULT_FIREBASE_CONFIG;
    }

    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app, config.firestoreDatabaseId);
    const storage = getStorage(app);

    window.RussApp.app = app;
    window.RussApp.auth = auth;
    window.RussApp.db = db;
    window.RussApp.storage = storage;

    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log('Firebase connection verified');
    } catch {
      // expected if offline
    }

    state.isFirebaseConnected = true;

    onAuthStateChanged(auth, (user) => {
      state.currentUser = user;
      updateAuthUI(user);
      if (user) {
        attachFirestoreListeners();
      } else {
        detachFirestoreListeners();
        loadLocalFallbackData();
      }
    });

  } catch (err) {
    console.warn('Firebase init note (Using local storage preview):', err);
    state.isFirebaseConnected = false;
    loadLocalFallbackData();
  }
}

// --- Attach Firestore Listeners ---
function attachFirestoreListeners() {
  detachFirestoreListeners();
  const db = window.RussApp.db;
  if (!db) return;

  // Groups listener
  try {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      if (snapshot.empty) {
        seedFirestoreGroups(db);
        return;
      }
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      state.groups = items;
      if (!state.groups.some(g => g.id === state.activeGroupId)) {
        state.activeGroupId = state.groups[0].id;
      }
      updateGroupBarUI();
      renderAllViews();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));
    state.unsubscribers.push(unsubGroups);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'groups');
  }

  // Events listener
  try {
    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      state.events = items;
      renderEvents();
      renderOverview();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));
    state.unsubscribers.push(unsubEvents);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'events');
  }

  // Transactions listener
  try {
    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      state.transactions = items;
      renderBudget();
      renderOverview();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));
    state.unsubscribers.push(unsubTransactions);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'transactions');
  }

  // Media listener
  try {
    const unsubMedia = onSnapshot(collection(db, 'media'), (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      state.media = items;
      renderMedia();
      renderOverview();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'media'));
    state.unsubscribers.push(unsubMedia);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'media');
  }

  // Notices listener
  try {
    const unsubNotices = onSnapshot(collection(db, 'notices'), (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      state.notices = items;
      renderNotices();
      renderOverview();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notices'));
    state.unsubscribers.push(unsubNotices);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'notices');
  }
}

function detachFirestoreListeners() {
  state.unsubscribers.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });
  state.unsubscribers = [];
}

async function seedFirestoreGroups(db) {
  try {
    await addDoc(collection(db, 'groups'), { ...defaultGroup });
    for (const e of defaultEvents) await addDoc(collection(db, 'events'), { ...e });
    for (const t of defaultTransactions) await addDoc(collection(db, 'transactions'), { ...t });
    for (const m of defaultMedia) await addDoc(collection(db, 'media'), { ...m });
    for (const n of defaultNotices) await addDoc(collection(db, 'notices'), { ...n });
  } catch (e) {
    console.warn('Seeding note:', e);
  }
}

// --- Local Storage Fallback Data ---
function loadLocalFallbackData() {
  const localGroups = localStorage.getItem('russe_groups');
  const localEvents = localStorage.getItem('russe_events');
  const localTrans = localStorage.getItem('russe_transactions');
  const localMedia = localStorage.getItem('russe_media');
  const localNotices = localStorage.getItem('russe_notices');

  state.groups = localGroups ? JSON.parse(localGroups) : [defaultGroup];
  state.events = localEvents ? JSON.parse(localEvents) : defaultEvents;
  state.transactions = localTrans ? JSON.parse(localTrans) : defaultTransactions;
  state.media = localMedia ? JSON.parse(localMedia) : defaultMedia;
  state.notices = localNotices ? JSON.parse(localNotices) : defaultNotices;

  updateGroupBarUI();
  renderAllViews();
}

function saveLocalState() {
  localStorage.setItem('russe_groups', JSON.stringify(state.groups));
  localStorage.setItem('russe_events', JSON.stringify(state.events));
  localStorage.setItem('russe_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('russe_media', JSON.stringify(state.media));
  localStorage.setItem('russe_notices', JSON.stringify(state.notices));
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// --- Update Active Group Header & Bar ---
function updateGroupBarUI() {
  const group = getActiveGroup();
  const userRoleInfo = getCurrentUserRole();

  document.getElementById('brand-active-group-tag').textContent = `GRUPPE: ${group.name.toUpperCase()}`;
  document.getElementById('current-user-role-tag').textContent = userRoleInfo.isAdmin ? '👑 ADMIN // BUSSJEF' : userRoleInfo.roleTitle.toUpperCase();
  document.getElementById('current-user-role-tag').className = `badge-tag ${userRoleInfo.isAdmin ? 'badge-admin' : 'badge-tag'}`;

  document.getElementById('active-group-name').textContent = group.name;
  document.getElementById('group-school-display').textContent = group.schoolOrCity || 'Norge';
  document.getElementById('group-member-count').textContent = `${group.members?.length || 1} medlemmer`;
  document.getElementById('display-invite-code').textContent = group.code || 'RUSS-2026';
}

function updateAuthUI(user) {
  const avatarEl = document.getElementById('header-avatar');
  const usernameEl = document.getElementById('header-username');
  const signedInSec = document.getElementById('auth-signed-in');
  const signedOutSec = document.getElementById('auth-signed-out');
  const profileAvatarBox = document.getElementById('profile-modal-avatar-box');
  const profileName = document.getElementById('profile-modal-name');
  const profileEmail = document.getElementById('profile-modal-email');
  const roleBadge = document.getElementById('profile-modal-role-badge');

  const roleInfo = getCurrentUserRole();

  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    avatarEl.textContent = name.charAt(0).toUpperCase();
    profileAvatarBox.textContent = name.charAt(0).toUpperCase();
    usernameEl.textContent = `${name} (${roleInfo.roleTitle})`;
    profileName.textContent = name;
    profileEmail.textContent = user.email || '';
    roleBadge.textContent = roleInfo.roleTitle.toUpperCase();

    signedInSec.style.display = 'block';
    signedOutSec.style.display = 'none';
  } else {
    avatarEl.textContent = 'A';
    usernameEl.textContent = 'Mathias (Admin Demo)';
    signedInSec.style.display = 'none';
    signedOutSec.style.display = 'block';
  }

  updateGroupBarUI();
}

// --- Render Views ---
function renderAllViews() {
  updateGroupBarUI();
  renderOverview();
  renderEvents();
  renderBudget();
  renderMedia();
  renderNotices();
  updateRTCountdown();
}

function updateRTCountdown() {
  const days = getDaysUntilRT();
  document.getElementById('rt-days-count').textContent = `RT: ${days} DAGER`;
}

// Filter items for current active group
function getGroupItems(items) {
  const group = getActiveGroup();
  return items.filter(item => !item.groupId || item.groupId === group.id);
}

// 1. OVERVIEW
function renderOverview() {
  const group = getActiveGroup();
  const trans = getGroupItems(state.transactions);
  const { totalIncome, totalExpense, balance } = calculateBudgetSummary(trans);

  document.getElementById('stat-balance').textContent = formatCurrencyNOK(balance);
  document.getElementById('stat-income').textContent = formatCurrencyNOK(totalIncome);
  document.getElementById('stat-expense').textContent = formatCurrencyNOK(totalExpense);

  const goal = group.budgetGoal || 250000;
  document.getElementById('stat-goal-tag').textContent = `[DUGNADSMÅL: ${formatCurrencyNOK(goal).toUpperCase()}]`;
  const pct = Math.min(100, Math.max(0, Math.round((balance / goal) * 100)));
  document.getElementById('stat-goal-pct').textContent = `${pct}%`;
  document.getElementById('goal-progress-bar').style.width = `${pct}%`;
  const remaining = Math.max(0, goal - balance);
  document.getElementById('stat-goal-remaining').textContent = `Gjenstår: ${formatCurrencyNOK(remaining)}`;

  // Upcoming 3 Events
  const eventsListEl = document.getElementById('overview-events-list');
  const groupEvents = getGroupItems(state.events).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);

  if (groupEvents.length === 0) {
    eventsListEl.innerHTML = `<div class="empty-state" style="padding:1rem;">Ingen kommende hendelser enda.</div>`;
  } else {
    eventsListEl.innerHTML = groupEvents.map(e => `
      <div class="surface-card feed-item">
        <div class="feed-item-main">
          <div class="feed-item-title">
            <span>${escapeHtml(e.title)}</span>
            <span class="badge-tag badge-${escapeHtml(e.category.toLowerCase())}">[${escapeHtml(e.category)}]</span>
          </div>
          <div class="feed-item-meta">
            <span>📅 ${e.date}${e.time ? ' kl. ' + e.time : ''}</span>
            ${e.location ? `<span>📍 ${escapeHtml(e.location)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  // Pinned Notice
  const noticeContainer = document.getElementById('overview-notices-container');
  const groupNotices = getGroupItems(state.notices);
  const pinnedNotice = groupNotices.find(n => n.isPinned) || groupNotices[0];
  if (!pinnedNotice) {
    noticeContainer.innerHTML = `<div class="empty-state" style="padding:1rem;">Ingen beskjeder på tavla.</div>`;
  } else {
    noticeContainer.innerHTML = `
      <div class="notice-box pinned">
        <div class="notice-header">
          <h4 style="font-size: 0.95rem; font-weight: 800;">${escapeHtml(pinnedNotice.title)}</h4>
          <span class="badge-tag badge-admin">[FESTET // VIKTIG]</span>
        </div>
        <p class="notice-body-text" style="font-size:0.85rem; margin-bottom:0.5rem;">${escapeHtml(pinnedNotice.content)}</p>
        <div class="notice-foot">
          <span>Forfatter: <strong>${escapeHtml(pinnedNotice.authorName || 'Medlem')}</strong></span>
          <span>${formatDate(pinnedNotice.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // Recent 3 Media
  const mediaGridEl = document.getElementById('overview-media-grid');
  const recentMedia = getGroupItems(state.media).slice(0, 3);
  if (recentMedia.length === 0) {
    mediaGridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding:1rem;">Ingen filer lastet opp enda.</div>`;
  } else {
    mediaGridEl.innerHTML = recentMedia.map(m => `
      <div class="media-box" onclick="window.RussApp.openLightbox('${m.id}')">
        <div class="media-box-img-wrap" style="height:100px;">
          <img class="media-box-img" src="${m.url}" alt="${escapeHtml(m.title)}" loading="lazy" />
          <span class="media-box-tag" style="font-size:0.6rem;">[${escapeHtml(m.category)}]</span>
        </div>
        <div class="media-box-meta" style="padding:0.45rem;">
          <div class="media-box-title" style="font-size:0.75rem;">${escapeHtml(m.title)}</div>
        </div>
      </div>
    `).join('');
  }
}

// 2. PLANNER (Events)
function renderEvents() {
  const container = document.getElementById('planner-events-list');
  let events = getGroupItems(state.events);

  if (state.filters.eventCategory !== 'Alle') {
    events = events.filter(e => e.category === state.filters.eventCategory);
  }

  events.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());

  if (events.length === 0) {
    container.innerHTML = `
      <div class="surface-card empty-state">
        <p>Ingen hendelser i denne kategorien.</p>
      </div>
    `;
    return;
  }

  const roleInfo = getCurrentUserRole();

  container.innerHTML = events.map(e => `
    <div class="surface-card feed-item">
      <div class="feed-item-main">
        <div class="feed-item-title">
          <span>${escapeHtml(e.title)}</span>
          <span class="badge-tag badge-${escapeHtml(e.category.toLowerCase())}">[${escapeHtml(e.category)}]</span>
        </div>
        <div class="feed-item-meta">
          <span>📅 ${e.date}${e.time ? ' kl. ' + e.time : ''}</span>
          ${e.location ? `<span>📍 ${escapeHtml(e.location)}</span>` : ''}
        </div>
        ${e.notes ? `<p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.4rem;">${escapeHtml(e.notes)}</p>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap: 0.35rem;">
        <button class="icon-btn edit-event-btn" data-id="${e.id}" title="Rediger hendelse" aria-label="Rediger hendelse ${escapeHtml(e.title)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        ${roleInfo.isAdmin ? `
          <button class="icon-btn delete-event-btn" data-id="${e.id}" title="Slett hendelse" aria-label="Slett hendelse ${escapeHtml(e.title)}" style="color: var(--russe-red);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.edit-event-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditEventModal(btn.dataset.id));
  });
  container.querySelectorAll('.delete-event-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteEvent(btn.dataset.id));
  });
}

// 3. BUDGET (Transactions)
function renderBudget() {
  const trans = getGroupItems(state.transactions);
  const { totalIncome, totalExpense, balance } = calculateBudgetSummary(trans);
  document.getElementById('budget-balance-val').textContent = formatCurrencyNOK(balance);
  document.getElementById('budget-income-val').textContent = formatCurrencyNOK(totalIncome);
  document.getElementById('budget-expense-val').textContent = formatCurrencyNOK(totalExpense);

  const container = document.getElementById('budget-transactions-list');
  let list = [...trans];

  const filter = state.filters.budgetFilter;
  if (filter === 'income' || filter === 'expense') {
    list = list.filter(t => t.type === filter);
  } else if (filter !== 'Alle') {
    list = list.filter(t => t.category === filter);
  }

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (list.length === 0) {
    container.innerHTML = `
      <div class="surface-card empty-state">
        <p>Ingen transaksjoner registrert for bussen enda.</p>
      </div>
    `;
    return;
  }

  const roleInfo = getCurrentUserRole();

  container.innerHTML = list.map(t => {
    const isInc = t.type === 'income';
    const sign = isInc ? '+' : '-';
    const color = isInc ? 'var(--accent-green)' : 'var(--text-primary)';
    return `
      <div class="surface-card feed-item">
        <div class="feed-item-main">
          <div class="feed-item-title">
            <span>${escapeHtml(t.title)}</span>
            <span class="badge-tag" style="background:var(--bg-surface-elevated); border:1px solid var(--border-strong);">[${escapeHtml(t.category)}]</span>
          </div>
          <div class="feed-item-meta">
            <span>📅 ${t.date}</span>
            ${t.payer ? `<span>👤 ${escapeHtml(t.payer)}</span>` : ''}
            ${t.notes ? `<span>📝 ${escapeHtml(t.notes)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap: 0.85rem;">
          <div style="text-align: right;">
            <div style="font-size: 1.15rem; font-weight: 900; color: ${color};">
              ${sign} ${formatCurrencyNOK(t.amount)}
            </div>
          </div>
          ${roleInfo.isAdmin || roleInfo.role === 'economy' ? `
            <button class="icon-btn delete-trans-btn" data-id="${t.id}" title="Slett postering" aria-label="Slett postering ${escapeHtml(t.title)}" style="color: var(--russe-red);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.delete-trans-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

// 4. MEDIA (Screenshots, contracts, files)
function renderMedia() {
  const container = document.getElementById('media-gallery-grid');
  let mediaList = getGroupItems(state.media);

  if (state.filters.mediaCategory !== 'Alle') {
    mediaList = mediaList.filter(m => m.category === state.filters.mediaCategory);
  }

  mediaList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  if (mediaList.length === 0) {
    container.innerHTML = `
      <div class="surface-card empty-state" style="grid-column: 1 / -1;">
        <p>Ingen filer funnet i dette filteret.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mediaList.map(m => `
    <div class="media-box" onclick="window.RussApp.openLightbox('${m.id}')">
      <div class="media-box-img-wrap">
        <img class="media-box-img" src="${m.url}" alt="${escapeHtml(m.title)}" loading="lazy" />
        <span class="media-box-tag">[${escapeHtml(m.category)}]</span>
      </div>
      <div class="media-box-meta">
        <div class="media-box-title" title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">
          ${formatDate(m.createdAt)} • ${escapeHtml(m.uploaderName || 'Medlem')}
        </div>
      </div>
    </div>
  `).join('');
}

// 5. NOTICES (Information board)
function renderNotices() {
  const container = document.getElementById('notices-container');
  const notices = getGroupItems(state.notices).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  if (notices.length === 0) {
    container.innerHTML = `
      <div class="surface-card empty-state">
        <p>Ingen kunngjøringer publisert enda.</p>
      </div>
    `;
    return;
  }

  const roleInfo = getCurrentUserRole();

  container.innerHTML = notices.map(n => `
    <div class="surface-card notice-box ${n.isPinned ? 'pinned' : ''}">
      <div class="notice-header">
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 900;">${escapeHtml(n.title)}</h3>
          ${n.isPinned ? `<span class="badge-tag badge-admin" style="font-size:0.65rem;">[FESTET // VIKTIG]</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap: 0.35rem;">
          ${roleInfo.isAdmin ? `
            <button class="icon-btn toggle-pin-btn" data-id="${n.id}" title="${n.isPinned ? 'Fjern feste' : 'Fest øverst'}" aria-label="Endre feste for ${escapeHtml(n.title)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${n.isPinned ? 'var(--admin-gold)' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-2l-3-3V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7l-3 3v2z"></path></svg>
            </button>
            <button class="icon-btn delete-notice-btn" data-id="${n.id}" title="Slett kunngjøring" aria-label="Slett kunngjøring ${escapeHtml(n.title)}" style="color: var(--russe-red);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
        </div>
      </div>
      <p class="notice-body-text">${escapeHtml(n.content)}</p>
      <div class="notice-foot">
        <span>Publisert av: <strong>${escapeHtml(n.authorName || 'Medlem')}</strong></span>
        <span>${formatDate(n.createdAt)}</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.toggle-pin-btn').forEach(btn => {
    btn.addEventListener('click', () => togglePinNotice(btn.dataset.id));
  });
  container.querySelectorAll('.delete-notice-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteNotice(btn.dataset.id));
  });
}

// 6. MEMBERS & ROLES MODAL RENDER
function renderMembersModal() {
  const group = getActiveGroup();
  const tbody = document.getElementById('members-table-body');
  const roleInfo = getCurrentUserRole();

  document.getElementById('members-modal-subtitle').textContent = `${group.name} • ${group.members?.length || 0} medlemmer registrert`;
  document.getElementById('setting-group-name').value = group.name;
  document.getElementById('setting-budget-goal').value = group.budgetGoal || 250000;

  const members = group.members || [];
  tbody.innerHTML = members.map(m => {
    const isMemberAdmin = m.role === 'admin';
    const badgeClass = isMemberAdmin ? 'badge-admin' : 'badge-tag';
    return `
      <tr>
        <td>
          <div style="font-weight: 800;">${escapeHtml(m.displayName)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(m.email || 'Ingen e-post')}</div>
        </td>
        <td>
          <span class="badge-tag ${badgeClass}">[${escapeHtml(m.roleTitle || m.role)}]</span>
        </td>
        <td>
          ${roleInfo.isAdmin ? `
            <div style="display:flex; align-items:center; gap: 0.5rem;">
              <select class="form-control change-role-select" data-userid="${m.userId}" style="padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Administrator / Bussjef</option>
                <option value="economy" ${m.role === 'economy' ? 'selected' : ''}>Økonomiansvarlig</option>
                <option value="dugnad" ${m.role === 'dugnad' ? 'selected' : ''}>Dugnadsansvarlig</option>
                <option value="member" ${m.role === 'member' ? 'selected' : ''}>Medlem</option>
              </select>
              ${m.userId !== group.creatorId ? `
                <button class="btn btn-danger btn-sm remove-member-btn" data-userid="${m.userId}" title="Fjern fra gruppen">✕</button>
              ` : ''}
            </div>
          ` : `
            <span style="font-size: 0.75rem; color: var(--text-muted);">Kun Admin kan endre</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Handle role changes
  tbody.querySelectorAll('.change-role-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      updateMemberRole(sel.dataset.userid, e.target.value);
    });
  });

  tbody.querySelectorAll('.remove-member-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeMemberFromGroup(btn.dataset.userid);
    });
  });
}

// --- Group CRUD Actions ---
async function createNewGroup(name, school, goal, code) {
  const cleanCode = (code || `RUSS-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
  const creatorUid = state.currentUser ? state.currentUser.uid : 'admin-local-' + Date.now();
  const creatorName = state.currentUser ? (state.currentUser.displayName || 'Bussjef') : 'Bussjef (Meg)';

  const newGroup = {
    name,
    code: cleanCode,
    creatorId: creatorUid,
    creatorName,
    schoolOrCity: school || 'Norge',
    budgetGoal: Number(goal) || 250000,
    createdAt: new Date().toISOString(),
    members: [
      {
        userId: creatorUid,
        displayName: creatorName,
        email: state.currentUser ? state.currentUser.email : '',
        role: 'admin',
        roleTitle: 'Bussjef / Administrator',
        joinedAt: new Date().toISOString().split('T')[0]
      }
    ]
  };

  const db = window.RussApp.db;
  if (state.currentUser && db) {
    try {
      const docRef = await addDoc(collection(db, 'groups'), newGroup);
      state.activeGroupId = docRef.id;
      localStorage.setItem('russe_active_group_id', docRef.id);
      showToast(`Gruppen "${name}" opprettet! Invitasjonskode: ${cleanCode}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'groups');
      showToast('Feil ved opprettelse i skyen', 'error');
    }
  } else {
    newGroup.id = 'grp-' + Date.now();
    state.groups.push(newGroup);
    state.activeGroupId = newGroup.id;
    localStorage.setItem('russe_active_group_id', newGroup.id);
    saveLocalState();
    showToast(`Gruppen "${name}" opprettet! Invitasjonskode: ${cleanCode}`);
  }

  updateGroupBarUI();
  renderAllViews();
  closeModal('modal-create-group');
}

async function joinGroupWithInviteCode(code, memberName) {
  const cleanCode = code.trim().toUpperCase();
  const db = window.RussApp.db;
  const targetGroup = state.groups.find(g => g.code === cleanCode);

  if (!targetGroup) {
    showToast(`Ugyldig invitasjonskode "${cleanCode}". Sjekk stavemåte.`, 'error');
    return;
  }

  const userId = state.currentUser ? state.currentUser.uid : 'guest-' + Date.now();
  const email = state.currentUser ? state.currentUser.email : '';

  // Check if already in group
  if (targetGroup.members?.some(m => m.userId === userId || (email && m.email === email))) {
    state.activeGroupId = targetGroup.id;
    localStorage.setItem('russe_active_group_id', targetGroup.id);
    showToast(`Du er allerede medlem av "${targetGroup.name}"!`);
    updateGroupBarUI();
    renderAllViews();
    closeModal('modal-join-group');
    return;
  }

  const newMember = {
    userId,
    displayName: memberName || (state.currentUser ? state.currentUser.displayName : 'Medlem'),
    email,
    role: 'member',
    roleTitle: 'Medlem',
    joinedAt: new Date().toISOString().split('T')[0]
  };

  targetGroup.members = targetGroup.members || [];
  targetGroup.members.push(newMember);

  if (state.currentUser && db && !targetGroup.id.startsWith('kronen-') && !targetGroup.id.startsWith('grp-')) {
    try {
      await updateDoc(doc(db, 'groups', targetGroup.id), {
        members: targetGroup.members
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${targetGroup.id}`);
    }
  } else {
    saveLocalState();
  }

  state.activeGroupId = targetGroup.id;
  localStorage.setItem('russe_active_group_id', targetGroup.id);
  showToast(`Velkommen til ${targetGroup.name}!`);
  updateGroupBarUI();
  renderAllViews();
  closeModal('modal-join-group');
}

async function updateMemberRole(userId, newRole) {
  const group = getActiveGroup();
  const member = group.members.find(m => m.userId === userId);
  if (!member) return;

  const roleTitles = {
    admin: 'Bussjef / Administrator',
    economy: 'Økonomiansvarlig',
    dugnad: 'Dugnadsansvarlig',
    member: 'Medlem'
  };

  member.role = newRole;
  member.roleTitle = roleTitles[newRole] || 'Medlem';

  const db = window.RussApp.db;
  if (state.currentUser && db && !group.id.startsWith('kronen-') && !group.id.startsWith('grp-')) {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: group.members
      });
      showToast(`Rolle oppdatert for ${member.displayName}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
    }
  } else {
    saveLocalState();
    showToast(`Rolle oppdatert for ${member.displayName}!`);
  }
  updateGroupBarUI();
  renderMembersModal();
}

async function removeMemberFromGroup(userId) {
  if (!confirm('Er du sikker på at du vil fjerne dette medlemmet fra gruppen?')) return;
  const group = getActiveGroup();
  group.members = group.members.filter(m => m.userId !== userId);

  const db = window.RussApp.db;
  if (state.currentUser && db && !group.id.startsWith('kronen-') && !group.id.startsWith('grp-')) {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: group.members
      });
      showToast('Medlem fjernet.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
    }
  } else {
    saveLocalState();
    showToast('Medlem fjernet.');
  }
  updateGroupBarUI();
  renderMembersModal();
}

async function updateGroupSettings(name, goal) {
  const group = getActiveGroup();
  group.name = name;
  group.budgetGoal = Number(goal) || 250000;

  const db = window.RussApp.db;
  if (state.currentUser && db && !group.id.startsWith('kronen-') && !group.id.startsWith('grp-')) {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        name,
        budgetGoal: group.budgetGoal
      });
      showToast('Gruppeinnstillinger lagret!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
    }
  } else {
    saveLocalState();
    showToast('Gruppeinnstillinger lagret!');
  }
  updateGroupBarUI();
  renderAllViews();
  closeModal('modal-members');
}

// --- CRUD Actions (Events) ---
async function saveEvent(eventData, editId) {
  const group = getActiveGroup();
  const db = window.RussApp.db;
  const payload = {
    ...eventData,
    groupId: group.id
  };

  if (state.currentUser && db) {
    try {
      if (editId) {
        await updateDoc(doc(db, 'events', editId), { ...payload, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, 'events'), {
          ...payload,
          createdBy: state.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      showToast(editId ? 'Hendelse oppdatert!' : 'Hendelse lagt til i planen!');
    } catch (err) {
      handleFirestoreError(err, editId ? OperationType.UPDATE : OperationType.CREATE, 'events');
      showToast('Feil ved lagring i skyen', 'error');
    }
  } else {
    if (editId) {
      const idx = state.events.findIndex(e => e.id === editId);
      if (idx !== -1) state.events[idx] = { ...state.events[idx], ...payload };
    } else {
      state.events.push({
        id: 'local-e-' + Date.now(),
        ...payload,
        createdAt: new Date().toISOString()
      });
    }
    saveLocalState();
    renderEvents();
    renderOverview();
    showToast(editId ? 'Hendelse oppdatert!' : 'Hendelse lagt til!');
  }
}

async function deleteEvent(id) {
  if (!confirm('Er du sikker på at du vil slette denne hendelsen?')) return;
  const db = window.RussApp.db;
  if (state.currentUser && db && !id.startsWith('seed-') && !id.startsWith('local-')) {
    try {
      await deleteDoc(doc(db, 'events', id));
      showToast('Hendelse slettet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
    }
  } else {
    state.events = state.events.filter(e => e.id !== id);
    saveLocalState();
    renderEvents();
    renderOverview();
    showToast('Hendelse slettet!');
  }
}

function openEditEventModal(id) {
  const event = state.events.find(e => e.id === id);
  if (!event) return;
  document.getElementById('event-modal-title').textContent = 'Rediger hendelse';
  document.getElementById('event-edit-id').value = event.id;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-date').value = event.date;
  document.getElementById('event-time').value = event.time || '';
  document.getElementById('event-category').value = event.category;
  document.getElementById('event-location').value = event.location || '';
  document.getElementById('event-notes').value = event.notes || '';
  openModal('modal-event');
}

// --- CRUD Actions (Budget) ---
async function saveTransaction(transData) {
  const group = getActiveGroup();
  const db = window.RussApp.db;
  const payload = {
    ...transData,
    groupId: group.id
  };

  if (state.currentUser && db) {
    try {
      await addDoc(collection(db, 'transactions'), {
        ...payload,
        createdBy: state.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      showToast('Postering lagret i budsjettet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
      showToast('Feil ved lagring av postering', 'error');
    }
  } else {
    state.transactions.push({
      id: 'local-t-' + Date.now(),
      ...payload,
      createdAt: new Date().toISOString()
    });
    saveLocalState();
    renderBudget();
    renderOverview();
    showToast('Postering ført i budsjett!');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Er du sikker på at du vil slette denne posteringen?')) return;
  const db = window.RussApp.db;
  if (state.currentUser && db && !id.startsWith('seed-') && !id.startsWith('local-')) {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      showToast('Postering slettet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  } else {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveLocalState();
    renderBudget();
    renderOverview();
    showToast('Postering slettet!');
  }
}

// --- CRUD Actions (Media) ---
async function uploadMediaFile(file, title, category) {
  const submitBtn = document.getElementById('media-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Laster opp...';

  const group = getActiveGroup();
  const db = window.RussApp.db;
  const storage = window.RussApp.storage;

  try {
    let downloadUrl = '';
    let storagePath = '';

    if (state.currentUser && storage && db) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `media/${group.id}_${Date.now()}_${safeName}`;
        const fileRef = storageRef(storage, storagePath);
        const snapshot = await uploadBytes(fileRef, file);
        downloadUrl = await getDownloadURL(snapshot.ref);
      } catch (storageErr) {
        console.warn('Storage fallback:', storageErr);
        downloadUrl = await readFileAsDataUrl(file);
      }

      await addDoc(collection(db, 'media'), {
        groupId: group.id,
        title,
        category,
        url: downloadUrl,
        storagePath,
        fileType: file.type,
        uploadedBy: state.currentUser.uid,
        uploaderName: state.currentUser.displayName || 'Medlem',
        createdAt: new Date().toISOString()
      });
      showToast('Fil lastet opp til arkivet!');
    } else {
      downloadUrl = await readFileAsDataUrl(file);
      const newMedia = {
        id: 'local-m-' + Date.now(),
        groupId: group.id,
        title,
        category,
        url: downloadUrl,
        fileType: file.type,
        uploadedBy: 'guest',
        uploaderName: 'Mathias (Admin)',
        createdAt: new Date().toISOString()
      };
      state.media.unshift(newMedia);
      saveLocalState();
      renderMedia();
      renderOverview();
      showToast('Fil lagret i mediearkivet!');
    }
    closeModal('modal-media');
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Kunne ikke laste opp filen', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Last opp fil';
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

async function deleteMedia(id) {
  if (!confirm('Er du sikker på at du vil slette denne filen?')) return;
  const db = window.RussApp.db;
  const storage = window.RussApp.storage;
  const mediaItem = state.media.find(m => m.id === id);

  if (state.currentUser && db && !id.startsWith('seed-') && !id.startsWith('local-')) {
    try {
      if (mediaItem?.storagePath && storage) {
        try {
          await deleteObject(storageRef(storage, mediaItem.storagePath));
        } catch {}
      }
      await deleteDoc(doc(db, 'media', id));
      showToast('Fil slettet fra arkivet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `media/${id}`);
    }
  } else {
    state.media = state.media.filter(m => m.id !== id);
    saveLocalState();
    renderMedia();
    renderOverview();
    showToast('Fil slettet!');
  }
  closeModal('modal-lightbox');
}

window.RussApp.openLightbox = function(id) {
  const item = state.media.find(m => m.id === id);
  if (!item) return;
  document.getElementById('lightbox-image').src = item.url;
  document.getElementById('lightbox-title').textContent = item.title;
  document.getElementById('lightbox-meta').textContent = `${item.category} • Lastet opp av ${item.uploaderName || 'Medlem'} • ${formatDate(item.createdAt)}`;

  const dlLink = document.getElementById('lightbox-download-link');
  dlLink.href = item.url;
  dlLink.setAttribute('download', `${item.title.replace(/\s+/g, '_')}`);

  const delBtn = document.getElementById('lightbox-delete-btn');
  delBtn.onclick = () => deleteMedia(item.id);

  openModal('modal-lightbox');
};

// --- CRUD Actions (Notices) ---
async function saveNotice(noticeData) {
  const group = getActiveGroup();
  const db = window.RussApp.db;
  const payload = {
    ...noticeData,
    groupId: group.id
  };

  if (state.currentUser && db) {
    try {
      await addDoc(collection(db, 'notices'), {
        ...payload,
        authorId: state.currentUser.uid,
        authorName: state.currentUser.displayName || 'Bussjef',
        createdAt: new Date().toISOString()
      });
      showToast('Kunngjøring publisert på tavla!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notices');
      showToast('Feil ved publisering i skyen', 'error');
    }
  } else {
    state.notices.unshift({
      id: 'local-n-' + Date.now(),
      ...payload,
      authorName: 'Mathias (Admin)',
      createdAt: new Date().toISOString()
    });
    saveLocalState();
    renderNotices();
    renderOverview();
    showToast('Kunngjøring publisert!');
  }
}

async function togglePinNotice(id) {
  const notice = state.notices.find(n => n.id === id);
  if (!notice) return;
  const newPinned = !notice.isPinned;

  const db = window.RussApp.db;
  if (state.currentUser && db && !id.startsWith('seed-') && !id.startsWith('local-')) {
    try {
      await updateDoc(doc(db, 'notices', id), { isPinned: newPinned });
      showToast(newPinned ? 'Kunngjøring festet øverst!' : 'Feste fjernet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notices/${id}`);
    }
  } else {
    notice.isPinned = newPinned;
    saveLocalState();
    renderNotices();
    renderOverview();
    showToast(newPinned ? 'Kunngjøring festet øverst!' : 'Feste fjernet!');
  }
}

async function deleteNotice(id) {
  if (!confirm('Er du sikker på at du vil slette denne kunngjøringen?')) return;
  const db = window.RussApp.db;
  if (state.currentUser && db && !id.startsWith('seed-') && !id.startsWith('local-')) {
    try {
      await deleteDoc(doc(db, 'notices', id));
      showToast('Kunngjøring slettet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notices/${id}`);
    }
  } else {
    state.notices = state.notices.filter(n => n.id !== id);
    saveLocalState();
    renderNotices();
    renderOverview();
    showToast('Kunngjøring slettet!');
  }
}

// --- Navigation & Views ---
function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.desktop-nav .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.mobile-nav .mobile-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('brand-home-btn').addEventListener('click', () => switchView('overview'));

  // Theme Toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const moonIcon = document.getElementById('theme-moon-icon');
  const sunIcon = document.getElementById('theme-sun-icon');

  const currentTheme = localStorage.getItem('russe_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcons(currentTheme);

  themeBtn.addEventListener('click', () => {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('russe_theme', nextTheme);
    updateThemeIcons(nextTheme);
  });

  function updateThemeIcons(theme) {
    if (theme === 'light') {
      moonIcon.style.display = 'none';
      sunIcon.style.display = 'block';
    } else {
      moonIcon.style.display = 'block';
      sunIcon.style.display = 'none';
    }
  }

  // Modals close buttons & click outside
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Copy Invite Code Button
  document.getElementById('copy-invite-code-btn').addEventListener('click', () => {
    const group = getActiveGroup();
    const code = group.code || 'KRON-2026';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Invitasjonskode ${code} kopiert til utklippstavlen!`);
      }).catch(() => {
        showToast(`Kode: ${code}`);
      });
    } else {
      showToast(`Kode: ${code}`);
    }
  });

  // Open Members & Roles Modal
  document.getElementById('open-members-modal-btn').addEventListener('click', () => {
    renderMembersModal();
    openModal('modal-members');
  });

  // Group settings form
  document.getElementById('form-group-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('setting-group-name').value.trim();
    const goal = document.getElementById('setting-budget-goal').value;
    updateGroupSettings(name, goal);
  });

  // Open Create Group Modal
  document.getElementById('open-create-group-modal-btn').addEventListener('click', () => {
    document.getElementById('form-create-group').reset();
    document.getElementById('new-group-code').value = `KRON-${Math.floor(1000 + Math.random() * 9000)}`;
    openModal('modal-create-group');
  });

  // Generate code button
  document.getElementById('btn-generate-code').addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value.trim() || 'RUSS';
    const prefix = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'RUSS';
    document.getElementById('new-group-code').value = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  // Create group form submit
  document.getElementById('form-create-group').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-group-name').value.trim();
    const school = document.getElementById('new-group-school').value.trim();
    const goal = document.getElementById('new-group-goal').value;
    const code = document.getElementById('new-group-code').value.trim();
    createNewGroup(name, school, goal, code);
  });

  // Open Join Group Modal
  document.getElementById('open-join-group-modal-btn').addEventListener('click', () => {
    document.getElementById('form-join-group').reset();
    openModal('modal-join-group');
  });

  // Join group form submit
  document.getElementById('form-join-group').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('join-group-code').value;
    const name = document.getElementById('join-member-name').value.trim();
    joinGroupWithInviteCode(code, name);
  });

  // Open Event Modal
  document.getElementById('quick-add-event-btn').addEventListener('click', () => {
    document.getElementById('form-event').reset();
    document.getElementById('event-modal-title').textContent = 'Legg til hendelse';
    document.getElementById('event-edit-id').value = '';
    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-event');
  });

  document.getElementById('open-add-event-modal-btn').addEventListener('click', () => {
    document.getElementById('form-event').reset();
    document.getElementById('event-modal-title').textContent = 'Legg til hendelse';
    document.getElementById('event-edit-id').value = '';
    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-event');
  });

  // Open Transaction Modal
  document.getElementById('quick-add-transaction-btn').addEventListener('click', () => {
    document.getElementById('form-transaction').reset();
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-transaction');
  });

  document.getElementById('open-add-transaction-modal-btn').addEventListener('click', () => {
    document.getElementById('form-transaction').reset();
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-transaction');
  });

  // Open Media Modal
  document.getElementById('open-upload-media-modal-btn').addEventListener('click', () => {
    document.getElementById('form-media').reset();
    document.getElementById('media-upload-preview').style.display = 'none';
    openModal('modal-media');
  });

  // Open Notice Modal
  document.getElementById('open-add-notice-modal-btn').addEventListener('click', () => {
    document.getElementById('form-notice').reset();
    openModal('modal-notice');
  });

  // Auth Button
  document.getElementById('auth-btn').addEventListener('click', () => openModal('modal-auth'));

  // Google Sign In
  document.getElementById('google-sign-in-btn').addEventListener('click', async () => {
    const auth = window.RussApp.auth;
    if (!auth) {
      showToast('Firebase Auth er ikke initialisert.', 'error');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      closeModal('modal-auth');
      showToast('Innlogget med Google!');
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      showToast('Innlogging avbrutt: ' + err.message, 'error');
    }
  });

  // Sign Out
  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    const auth = window.RussApp.auth;
    if (auth) {
      await signOut(auth);
      closeModal('modal-auth');
      showToast('Logget ut.');
    }
  });

  // Demo mode
  document.getElementById('demo-mode-btn').addEventListener('click', () => {
    closeModal('modal-auth');
    showToast('Bruker lokal testmodus som Mathias (Admin).');
  });

  // Filters
  document.querySelectorAll('#event-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#event-filters .filter-tab').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      state.filters.eventCategory = tab.dataset.category;
      renderEvents();
    });
  });

  document.querySelectorAll('#budget-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#budget-filters .filter-tab').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      state.filters.budgetFilter = tab.dataset.type;
      renderBudget();
    });
  });

  document.querySelectorAll('#media-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#media-filters .filter-tab').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      state.filters.mediaCategory = tab.dataset.cat;
      renderMedia();
    });
  });

  // Form Submits
  document.getElementById('form-event').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('event-edit-id').value;
    const data = {
      title: document.getElementById('event-title').value.trim(),
      date: document.getElementById('event-date').value,
      time: document.getElementById('event-time').value,
      category: document.getElementById('event-category').value,
      location: document.getElementById('event-location').value.trim(),
      notes: document.getElementById('event-notes').value.trim()
    };
    saveEvent(data, editId);
    closeModal('modal-event');
  });

  document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('trans-title').value.trim(),
      amount: parseFloat(document.getElementById('trans-amount').value),
      type: document.getElementById('trans-type').value,
      category: document.getElementById('trans-category').value,
      date: document.getElementById('trans-date').value,
      payer: document.getElementById('trans-payer').value.trim(),
      notes: document.getElementById('trans-notes').value.trim()
    };
    saveTransaction(data);
    closeModal('modal-transaction');
  });

  const fileInput = document.getElementById('media-file-input');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('media-preview-img').src = e.target.result;
        document.getElementById('media-upload-preview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('form-media').addEventListener('submit', (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      alert('Vennligst velg en fil først.');
      return;
    }
    const title = document.getElementById('media-title').value.trim();
    const category = document.getElementById('media-category').value;
    uploadMediaFile(file, title, category);
  });

  document.getElementById('form-notice').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('notice-title').value.trim(),
      content: document.getElementById('notice-content').value.trim(),
      isPinned: document.getElementById('notice-pinned').checked
    };
    saveNotice(data);
    closeModal('modal-notice');
  });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupFirebase();
  renderAllViews();
});
