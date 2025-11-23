/* Simple client-side auth + notes with localStorage.
   Not for production. Uses simple SHA-256 hashing via SubtleCrypto.
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// UI elements
const auth = $('#auth');
const authForm = $('#authForm');
const authTitle = $('#authTitle');
const authBtn = $('#authBtn');
const toggleAuthBtn = $('#toggleAuth');
const authMsg = $('#authMsg');
const userArea = $('#userArea');

const notesApp = $('#notesApp');
const newNoteBtn = $('#newNoteBtn');
const notesList = $('#notesList');
const searchInput = $('#search');
const noteTitle = $('#noteTitle');
const noteBody = $('#noteBody');
const saveBtn = $('#saveBtn');
const deleteBtn = $('#deleteBtn');
const saveStatus = $('#saveStatus');

let isSignup = false;
let currentUser = null;
let notes = [];
let activeNoteId = null;
let autosaveTimer = null;

// localStorage keys helpers
const usersKey = 'simple_notes_users'; // stores map of email -> {salt,hash}
const sessionKey = 'simple_notes_session'; // currently logged email
const notesKeyFor = (email) => `simple_notes_data_${email}`;

// --- utility: crypto hash with salt ---
async function sha256(s) {
  const enc = new TextEncoder();
  const data = enc.encode(s);
  const hash = await crypto.subtle.digest('SHA-256', data);
  // convert to hex
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}
function randSalt() {
  // simple random 16-char salt
  return crypto.getRandomValues(new Uint8Array(8)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
}

// --- storage helpers ---
function readJSON(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch(e){ return fallback; }
}
function writeJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

// --- auth functions ---
async function signup(email, password) {
  let users = readJSON(usersKey, {});
  if (users[email]) throw new Error('Account exists. Sign in instead.');
  const salt = randSalt();
  const hash = await sha256(password + salt);
  users[email] = { salt, hash };
  writeJSON(usersKey, users);
}

async function signin(email, password) {
  let users = readJSON(usersKey, {});
  const u = users[email];
  if (!u) throw new Error('No account found. Create one.');
  const hash = await sha256(password + u.salt);
  if (hash !== u.hash) throw new Error('Wrong password.');
  // set session
  localStorage.setItem(sessionKey, email);
  return email;
}
function signout() {
  localStorage.removeItem(sessionKey);
}

// --- notes CRUD ---
function loadNotes() {
  if (!currentUser) { notes = []; return; }
  notes = readJSON(notesKeyFor(currentUser), []);
}
function saveAllNotes() {
  if (!currentUser) return;
  writeJSON(notesKeyFor(currentUser), notes);
}
function createNote() {
  const id = Date.now().toString();
  const n = { id, title: 'Untitled', body: '', updatedAt: Date.now() };
  notes.unshift(n);
  saveAllNotes();
  renderNotes();
  openNote(id);
}
function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveAllNotes();
  renderNotes();
  if (activeNoteId === id) {
    closeEditor();
  }
}
function updateNote(id, patch) {
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  notes[idx] = {...notes[idx], ...patch, updatedAt: Date.now()};
  saveAllNotes();
  renderNotes();
}

// --- UI render ---
function renderAuthArea() {
  const email = localStorage.getItem(sessionKey);
  if (email) {
    userArea.innerHTML = `<span>${email}</span> <button id="logoutBtn" class="ghost">Logout</button>`;
    $('#logoutBtn').onclick = () => {
      signout();
      initApp();
    };
  } else {
    userArea.innerHTML = '';
  }
}

function renderNotes() {
  const q = searchInput.value.trim().toLowerCase();
  notesList.innerHTML = '';
  const list = notes.filter(n => {
    if (!q) return true;
    return (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q);
  });
  for (const n of list) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="title">${escapeHtml(n.title)}</div><div class="meta">${new Date(n.updatedAt).toLocaleString()}</div>`;
    li.onclick = () => openNote(n.id);
    if (n.id === activeNoteId) li.style.background = '#eaf2ff';
    notesList.appendChild(li);
  }
  if (list.length === 0) notesList.innerHTML = '<li class="meta">No notes</li>';
}

function openNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return;
  activeNoteId = id;
  noteTitle.value = n.title;
  noteBody.value = n.body;
  saveStatus.textContent = 'Saved';
  renderNotes();
}

function closeEditor() {
  activeNoteId = null;
  noteTitle.value = '';
  noteBody.value = '';
  saveStatus.textContent = 'Saved';
  renderNotes();
}

// escape helper
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// autosave (debounce)
function scheduleAutosave() {
  saveStatus.textContent = 'Saving...';
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (!activeNoteId) return;
    updateNote(activeNoteId, { title: noteTitle.value, body: noteBody.value });
    saveStatus.textContent = 'Saved';
  }, 700);
}

// --- handlers ---
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authMsg.textContent = '';
  const email = $('#email').value.trim().toLowerCase();
  const password = $('#password').value;
  try {
    if (isSignup) {
      await signup(email, password);
      // directly sign in after signup
      await signin(email, password);
    } else {
      await signin(email, password);
    }
    initApp();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

toggleAuthBtn.addEventListener('click', () => {
  isSignup = !isSignup;
  authTitle.textContent = isSignup ? 'Create account' : 'Sign In';
  authBtn.textContent = isSignup ? 'Sign Up' : 'Sign In';
  toggleAuthBtn.textContent = isSignup ? 'Have an account? Sign in' : 'Create account';
  authMsg.textContent = '';
});

newNoteBtn.addEventListener('click', () => {
  createNote();
});

searchInput.addEventListener('input', () => renderNotes());

noteTitle.addEventListener('input', scheduleAutosave);
noteBody.addEventListener('input', scheduleAutosave);

saveBtn.addEventListener('click', () => {
  if (!activeNoteId) return;
  updateNote(activeNoteId, { title: noteTitle.value, body: noteBody.value });
  saveStatus.textContent = 'Saved';
});

deleteBtn.addEventListener('click', () => {
  if (!activeNoteId) return;
  if (confirm('Delete this note?')) {
    deleteNote(activeNoteId);
  }
});

// --- init / session check ---
function initApp() {
  renderAuthArea();
  const email = localStorage.getItem(sessionKey);
  if (email) {
    currentUser = email;
    loadNotes();
    auth.classList.add('hidden');
    notesApp.classList.remove('hidden');
    renderNotes();
  } else {
    currentUser = null;
    notesApp.classList.add('hidden');
    auth.classList.remove('hidden');
  }
  closeEditor();
}

initApp();