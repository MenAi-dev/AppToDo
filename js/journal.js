// Journal : trace des actions (ajout, terminée, rouverte, supprimée, reportée, archivée), gardée 90 jours.
// Sert de « filet de sécurité » : on voit ce qui s'est passé, même après une suppression.
const CLE_JOURNAL = 'todoJournal';
const MAX_JOURNAL = 400;
const DUREE_JOURNAL_MS = 90 * 86400000;
const TYPES_JOURNAL = {
  ajout:   { ico:'+', txt:'Ajoutée',   couleur:'var(--bleu)' },
  fait:    { ico:'✓', txt:'Terminée',  couleur:'var(--vert)' },
  rouvert: { ico:'↺', txt:'Rouverte',  couleur:'var(--orange)' },
  suppr:   { ico:'✕', txt:'Supprimée', couleur:'var(--rouge)' },
  report:  { ico:'→', txt:'Reportée',  couleur:'var(--orange)' },
  archive: { ico:'▣', txt:'Archivée',  couleur:'var(--gris)' }
};
let journal = []; // { t, a, titre, d } du plus récent au plus ancien
let filtreJournal = '';

function chargerJournal(){
  try{
    const l = JSON.parse(localStorage.getItem(CLE_JOURNAL) || '[]');
    const limite = Date.now() - DUREE_JOURNAL_MS;
    journal = (Array.isArray(l) ? l : []).filter(e => e && typeof e.t === 'number' && e.t > limite && TYPES_JOURNAL[e.a] && typeof e.titre === 'string')
      .map(e => ({ t:e.t, a:e.a, titre:e.titre.slice(0,140), d:typeof e.d === 'string' ? e.d.slice(0,60) : '' }))
      .slice(0, MAX_JOURNAL);
  }catch(_){ journal = []; }
}
function sauverJournal(){
  try{ localStorage.setItem(CLE_JOURNAL, JSON.stringify(journal)); }catch(_){}
}
function noter(action, titre, detail){
  if(!TYPES_JOURNAL[action] || !titre) return;
  journal.unshift({ t:Date.now(), a:action, titre:String(titre).slice(0,140), d:detail ? String(detail).slice(0,60) : '' });
  if(journal.length > MAX_JOURNAL) journal.length = MAX_JOURNAL;
  sauverJournal();
}
function viderJournal(){ journal = []; sauverJournal(); }

function libelleJour(ts){
  const iso = versISO(new Date(ts));
  return iso === auj() ? "Aujourd'hui" : iso === ajouterJours(auj(), -1) ? 'Hier'
    : new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
}

function htmlJournal(){
  const puces = [['', 'Tout'], ['ajout', 'Ajouts'], ['fait', 'Terminées'], ['suppr', 'Suppressions'], ['report', 'Reports']]
    .map(([k, n]) => `<button class="filtre-cat${filtreJournal === k ? ' actif' : ''}" type="button" data-jfiltre="${k}">${n}</button>`).join('');
  const liste = journal.filter(e => !filtreJournal || e.a === filtreJournal);
  let corps;
  if(!liste.length){
    corps = journal.length
      ? '<div class="vide"><b>Rien dans cette catégorie</b>Choisis « Tout » pour tout revoir.</div>'
      : '<div class="vide"><b>Journal vide</b>Tes actions (ajout, tâche terminée, suppression…) apparaîtront ici pendant 90 jours.</div>';
  } else {
    const jours = new Map();
    liste.forEach(e => { const j = versISO(new Date(e.t)); if(!jours.has(j)) jours.set(j, []); jours.get(j).push(e); });
    corps = [...jours.values()].map(es => `<div class="groupe"><div class="groupe-titre"><span>${echapper(libelleJour(es[0].t))}</span><span>${es.length}</span></div>
      <div class="groupe-liste">${es.map(e => {
        const ty = TYPES_JOURNAL[e.a];
        const h = new Date(e.t).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        return `<div class="journal-ligne"><span class="journal-ico" style="--c:${ty.couleur}">${ty.ico}</span>
          <div class="journal-txt"><div class="journal-titre">${echapper(e.titre)}</div><div class="journal-sous">${ty.txt}${e.d ? ' · ' + echapper(e.d) : ''}</div></div>
          <span class="journal-heure">${h}</span></div>`;
      }).join('')}</div></div>`).join('');
    corps += '<div class="modal-delete-link"><button type="button" data-act="vider-journal">Effacer le journal</button></div>';
  }
  return `<div class="filtres-cat filtres-journal">${puces}</div>${corps}`;
}
