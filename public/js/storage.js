const CLE_STOCKAGE = 'todoData';
const MAX_NOTE = 1000; // longueur max d'une note
const MAX_SOUS = 30; // sous-tâches max par tâche
const CLE_OBJECTIF = 'todoObjectif';
const MAX_OBJECTIF = 50;
let objectif = 0; // tâches à terminer par jour (0 = pas d'objectif)
let taches = []; // { id, titre, fait, heure, important, date, repeter, suiteId, archive, cat, note, sous:[{id,titre,fait}], creeLe, faitLe }

function nettoyerSous(liste){
  if(!Array.isArray(liste)) return [];
  return liste.map(s => (s && typeof s.titre === 'string' && s.titre.trim()) ? {
    id: typeof s.id === 'string' && s.id ? s.id : nouvelId(),
    titre: s.titre.trim().slice(0,140),
    fait: !!s.fait
  } : null).filter(Boolean).slice(0, MAX_SOUS);
}

function nettoyerTache(t){
  if(!t || typeof t.titre !== 'string' || !t.titre.trim()) return null;
  return {
    id: typeof t.id === 'string' && t.id ? t.id : nouvelId(),
    titre: t.titre.trim().slice(0,140),
    fait: !!t.fait,
    important: !!t.important,
    date: dateValide(t.date) ? t.date : '',
    avance: Number.isInteger(t.avance) && t.avance >= 0 && t.avance <= 1440 ? t.avance : null, // minutes d'avance (null = réglage par défaut)
    notifie: !!t.notifie, vu: !!t.vu,
    heure: dateValide(t.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.heure) ? t.heure : '', // rappel (HH:MM), seulement avec une date
    repeter: REPETITIONS.includes(t.repeter) ? t.repeter : '',
    suiteId: typeof t.suiteId === 'string' ? t.suiteId : '',
    archive: !!t.archive && !!t.fait, // seules les tâches terminées s'archivent
    sous: nettoyerSous(t.sous),
    note: typeof t.note === 'string' ? t.note.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE) : '',
    cat: typeof t.cat === 'string' ? t.cat.replace(/\s+/g, ' ').trim().slice(0,24) : '',
    creeLe: typeof t.creeLe === 'number' ? t.creeLe : Date.now(),
    faitLe: typeof t.faitLe === 'number' ? t.faitLe : null
  };
}

function nettoyerObjectif(n){
  n = Math.round(Number(n));
  return n >= 1 ? Math.min(n, MAX_OBJECTIF) : 0;
}
function chargerObjectif(){
  try{ objectif = nettoyerObjectif(localStorage.getItem(CLE_OBJECTIF)); }catch(_){ objectif = 0; }
}
function enregistrerObjectif(n){
  objectif = nettoyerObjectif(n);
  try{
    if(objectif) localStorage.setItem(CLE_OBJECTIF, String(objectif)); else localStorage.removeItem(CLE_OBJECTIF);
  }catch(_){ toast("Impossible d'enregistrer l'objectif", 'danger'); }
}

function charger(){
  chargerObjectif();
  try{
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if(brut){
      const data = JSON.parse(brut);
      taches = (Array.isArray(data.taches) ? data.taches : []).map(nettoyerTache).filter(Boolean);
      // L'historique archivé (utile à l'analyse) est purgé après un an pour ne pas remplir le stockage
      const limite = Date.now() - 365 * 86400000;
      taches = taches.filter(t => !(t.archive && (t.faitLe || t.creeLe) < limite));
    }
  }catch(e){ console.error('Erreur de lecture des données', e); taches = []; }
}

function sauvegarder(){
  try{
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ taches }));
  }catch(e){
    console.error('Erreur de sauvegarde', e);
    toast("Impossible d'enregistrer (stockage plein ou bloqué)", 'danger');
  }
}

// --- Export / import ---
// mdp (facultatif) : sauvegarde chiffrée (voir securite.js)
async function exporter(mdp){
  let contenu = JSON.stringify({ app:'mes-taches', exporteLe:new Date().toISOString(), objectif, prefs:reglagesTheme, taches }, null, 2);
  if(mdp){
    try{ contenu = JSON.stringify(await chiffrerTexte(contenu, mdp)); }
    catch(e){ toast('Le chiffrement a échoué', 'danger'); return; }
  }
  const blob = new Blob([contenu], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `taches-${auj()}${mdp ? '-chiffre' : ''}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  toast(mdp ? 'Sauvegarde chiffrée exportée' : 'Sauvegarde exportée', 'succes');
}

function importer(fichier){
  const lecteur = new FileReader();
  lecteur.onload = async () => {
    try{
      let data = JSON.parse(lecteur.result);
      if(data && data.chiffre){ // sauvegarde chiffrée : on demande le mot de passe
        if(!cryptoDispo()) throw new Error("Le déchiffrement n'est pas disponible ici (il faut une connexion sécurisée, en https).");
        const mdp = await demanderSecret({ titre:'Sauvegarde chiffrée', sub:'Entre le mot de passe choisi lors de la sauvegarde.', label:'Mot de passe' });
        if(mdp == null) return;
        data = JSON.parse(await dechiffrerPaquet(data, mdp));
      }
      const liste = (Array.isArray(data) ? data : data.taches);
      if(!Array.isArray(liste)) throw new Error('Fichier invalide');
      const propres = liste.map(nettoyerTache).filter(Boolean);
      const nActuelles = taches.filter(t=>!t.archive).length, nImportees = propres.filter(t=>!t.archive).length;
      if(!confirm(`Remplacer tes ${nActuelles} tâche(s) actuelle(s) par les ${nImportees} de cette sauvegarde ?\n\nTu pourras revenir en arrière depuis les Réglages.`)) return;
      try{ localStorage.setItem(CLE_AVANT_IMPORT, JSON.stringify({ taches })); }catch(_){} // filet de sécurité
      taches = propres;
      if(!Array.isArray(data)){
        if(data.objectif !== undefined) enregistrerObjectif(data.objectif);
        if(data.prefs){ Object.assign(reglagesTheme, nettoyerReglages(data.prefs)); enregistrerTheme(); appliquerTheme(); }
      }
      sauvegarder(); rendre(); fermerReglages(); majZoneSecours();
      toast(`${nImportees} tâche(s) importée(s)`, 'succes');
    }catch(e){
      toast(e instanceof SyntaxError ? 'Fichier invalide' : (e.message || 'Fichier invalide'), 'danger');
    }
  };
  lecteur.readAsText(fichier);
}