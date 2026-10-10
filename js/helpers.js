const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const versISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const auj = () => versISO(new Date());
const ajouterJours = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate()+n); return versISO(d); };
const echapper = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateValide = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function libelleDate(iso){
  const t = auj();
  if(iso === t) return "Aujourd'hui";
  if(iso === ajouterJours(t,1)) return 'Demain';
  if(iso === ajouterJours(t,-1)) return 'Hier';
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

let toastTimer = null;
// action (facultatif) : { label, fn } -> bouton dans le message (ex. « Annuler »)
function toast(message, type, action){
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast actif' + (type ? ' ' + type : '');
  if(action){
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', ()=>{ el.classList.remove('actif'); clearTimeout(toastTimer); action.fn(); });
    el.appendChild(b);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('actif'), action ? 6000 : 3500);
}

// --- Répétition des tâches ---
const REPETITIONS = ['', 'jour', 'semaine', 'mois'];
const LIBELLES_REPET = { jour:'Chaque jour', semaine:'Chaque semaine', mois:'Chaque mois' };

function ajouterMois(iso, n){
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1, 12);
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(j, dernier)); // 31 janv. -> 28/29 févr.
  return versISO(d);
}

// Prochaine échéance strictement après aujourd'hui (même si la tâche était en retard)
function prochaineDate(iso, repeter){
  const avancer = d => repeter === 'jour' ? ajouterJours(d,1) : repeter === 'semaine' ? ajouterJours(d,7) : ajouterMois(d,1);
  const t = auj();
  let n = avancer(iso || t);
  while(n <= t) n = avancer(n);
  return n;
}

// --- Catégories (simples étiquettes de texte, créées à la volée) ---
const COULEURS_CAT = ['#0A84FF','#30D158','#FF9F0A','#BF5AF2','#FF453A','#64D2FF','#FFD60A','#FF6482'];
const cleCat = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const memeCat = (t, nom) => !!t.cat && cleCat(t.cat) === cleCat(nom);

function couleurCat(nom){
  let h = 0;
  for(const c of cleCat(nom)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS_CAT[h % COULEURS_CAT.length];
}
// Noms de catégories uniques (sans tenir compte des accents/majuscules), triés
function toutesCategories(liste){
  const m = new Map();
  (liste || taches).forEach(t=>{ if(t.cat && !m.has(cleCat(t.cat))) m.set(cleCat(t.cat), t.cat); });
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}
// Réutilise l'écriture d'une catégorie existante ; sinon met la première lettre en majuscule
function canoniqueCat(nom){
  nom = String(nom || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
  if(!nom) return '';
  const existante = toutesCategories().find(c => cleCat(c) === cleCat(nom));
  return existante || nom.charAt(0).toUpperCase() + nom.slice(1);
}

// Texte de note -> HTML sûr, avec les adresses http(s) transformées en liens
function noteVersHtml(texte){
  const safe = echapper(texte);
  return safe.replace(/https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)\S)+/g, url => {
    const fin = (url.match(/[.,;:!?)\]]+$/) || [''])[0];
    const lien = url.slice(0, url.length - fin.length);
    return `<a href="${lien}" target="_blank" rel="noopener noreferrer" data-act="lien">${lien}</a>${fin}`;
  });
}
