// Réglages : apparence (papier / sombre / auto, taille du texte), prénom, journée de travail (règle 60/40),
// marge d'estimation, vibrations, ajout rapide, objectif, données, application.
// Tout est mémorisé sur l'appareil (clé « todoTheme »). js/precoce.js (dans <head>) pose déjà le thème avant l'affichage.
const THEME_CLE = 'todoTheme';
const VERSION_APP = 'v40';
const MARGES = [20, 30, 50];
const heureValide = h => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
// Couleurs système d'Apple (la valeur exacte, claire ou sombre, est dans css/ios.css) : [clé, nom, aperçu]
const COULEURS = [
  ['indigo','Indigo','#5E5CE6'], ['bleu','Bleu','#0A84FF'], ['violet','Violet','#BF5AF2'], ['rose','Rose','#FF375F'],
  ['rouge','Rouge','#FF453A'], ['orange','Orange','#FF9F0A'], ['vert','Vert','#30D158'], ['menthe','Menthe','#63E6E2'],
  ['sarcelle','Sarcelle','#40C8E0'], ['cyan','Cyan','#64D2FF'], ['marron','Marron','#AC8E68']
];
const reglagesTheme = { style:'oneui', mode:'sombre', couleur:'indigo', texte:'normal', prenom:'', vibrations:true, ajoutRapide:false, debut:'08:00', fin:'17:00', marge:30, pomodoro:25 };

// Accepte n'importe quoi (stockage modifié, fichier de sauvegarde…) et corrige les valeurs invalides
function nettoyerReglages(t){
  t = (t && typeof t === 'object') ? t : {};
  const debut = heureValide(t.debut) ? t.debut : '08:00', fin = heureValide(t.fin) && t.fin > debut ? t.fin : '17:00';
  return {
    style: t.style === 'apple' ? 'apple' : 'oneui', // style de l'interface : One UI (Samsung) ou Apple (iOS)
    mode: ['auto','clair','sombre'].includes(t.mode) ? t.mode : 'sombre',
    couleur: COULEURS.some(c => c[0] === t.couleur) ? t.couleur : 'indigo',
    texte: t.texte === 'grand' ? 'grand' : 'normal',
    prenom: typeof t.prenom === 'string' ? t.prenom.trim().slice(0, 30) : '',
    vibrations: t.vibrations !== false,
    ajoutRapide: t.ajoutRapide === true, // false par défaut : la fiche complète s'ouvre à chaque ajout
    debut, fin,
    marge: MARGES.includes(t.marge) ? t.marge : 30,
    pomodoro: t.pomodoro === 50 ? 50 : 25 // minutes de travail du mode Focus (25/5 ou 50/10)
  };
}
function chargerTheme(){
  try{ Object.assign(reglagesTheme, nettoyerReglages(JSON.parse(localStorage.getItem(THEME_CLE) || '{}'))); }catch(_){}
}
function themeClair(){
  return reglagesTheme.mode === 'clair' || (reglagesTheme.mode === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
}
function enregistrerTheme(){
  try{ localStorage.setItem(THEME_CLE, JSON.stringify(reglagesTheme)); }catch(_){ toast("Impossible d'enregistrer les réglages", 'danger'); }
}
function vibrer(ms){
  try{ if(reglagesTheme.vibrations && navigator.vibrate) navigator.vibrate(ms || 8); }catch(_){}
}

// Texte de la micro-ligne d'en-tête : date du jour, précédée d'un bonjour si un prénom est renseigné
function texteEntete(dateTxt){
  return dateTxt; // la salutation avec le prénom est sur l'écran de bienvenue
}

function appliquerTheme(){
  const r = document.documentElement, clair = themeClair();
  r.dataset.theme = clair ? 'clair' : 'sombre';
  // Style : la couche One UI se pose sur la couche Apple ; en « Apple », on la retire
  r.dataset.style = reglagesTheme.style;
  const feuille = $('cssOneui');
  if(feuille) feuille.disabled = reglagesTheme.style !== 'oneui';
  document.querySelectorAll('[data-style-choix]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.styleChoix === reglagesTheme.style)));
  delete r.dataset.accent; // ancien réglage de couleur (remplacé par data-couleur)
  r.dataset.couleur = reglagesTheme.couleur;
  document.querySelectorAll('[data-couleur-choix]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.couleurChoix === reglagesTheme.couleur)));
  const nom = COULEURS.find(c => c[0] === reglagesTheme.couleur);
  if($('couleurNom')) $('couleurNom').textContent = nom ? nom[1] : '';
  if(reglagesTheme.texte === 'grand') r.dataset.texte = 'grand'; else delete r.dataset.texte;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = clair ? '#F2F2F7' : '#000000';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === reglagesTheme.mode)));
  document.querySelectorAll('[data-texte]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.texte === reglagesTheme.texte)));
  document.querySelectorAll('[data-marge]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.marge) === reglagesTheme.marge)));
  document.querySelectorAll('[data-pomodoro]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.pomodoro) === reglagesTheme.pomodoro)));
  const pn = $('prefPrenom');
  if(pn && document.activeElement !== pn) pn.value = reglagesTheme.prenom;
  $('prefDebut').value = reglagesTheme.debut;
  $('prefFin').value = reglagesTheme.fin;
  $('prefVibrations').checked = reglagesTheme.vibrations;
  $('prefAjoutRapide').checked = reglagesTheme.ajoutRapide;
  if(typeof rendre === 'function' && typeof taches !== 'undefined') rendre();
}

// ---------- Feuille « Réglages » ----------
function majInfoObjectif(){
  $('infoObjectif').textContent = objectif ? `${objectif} tâche${objectif > 1 ? 's' : ''} par jour` : 'Aucun objectif';
}
function majBoutonHistorique(){
  const n = taches.filter(t => t.archive).length;
  $('btnHistorique').hidden = !n;
  $('btnHistorique').textContent = `Effacer les tâches archivées (${n})`;
}
function majInfoJournee(){
  const { dispo, capacite } = capaciteJour();
  $('infoJournee').textContent = `${dureeTexte(dispo)} disponibles · 60 % planifiables = ${dureeTexte(capacite)}`;
}
function ouvrirReglages(){
  appliquerTheme(); majInfoObjectif(); majBoutonHistorique(); majInfoJournee();
  if(typeof majInfoVerrou === 'function'){ majInfoVerrou(); majZoneSecours(); }
  $('overlayReglages').classList.add('actif');
}
function fermerReglages(){ $('overlayReglages').classList.remove('actif'); }

(function(){
  // Pastilles de couleur
  $('couleurs').innerHTML = COULEURS.map(([k, n, c]) => `<button type="button" class="couleur" data-couleur-choix="${k}" style="--c:${c}" aria-label="${n}" title="${n}"></button>`).join('');
  $('couleurs').addEventListener('click', e => {
    const b = e.target.closest('[data-couleur-choix]');
    if(!b) return;
    reglagesTheme.couleur = b.dataset.couleurChoix;
    enregistrerTheme(); appliquerTheme(); vibrer(6);
  });

  $('btnReglages').addEventListener('click', ouvrirReglages);
  $('reglagesFermer').addEventListener('click', fermerReglages);
  $('overlayReglages').addEventListener('click', e => { if(e.target === $('overlayReglages')) fermerReglages(); });

  $('overlayReglages').addEventListener('click', e => {
    const x = e.target.closest('[data-texte]'), m = e.target.closest('[data-mode]'), g = e.target.closest('[data-marge]'), p = e.target.closest('[data-pomodoro]');
    if(x) reglagesTheme.texte = x.dataset.texte;
    else if(m) reglagesTheme.mode = m.dataset.mode;
    else if(g) reglagesTheme.marge = Number(g.dataset.marge);
    else if(p) reglagesTheme.pomodoro = Number(p.dataset.pomodoro);
    else if(e.target.closest('[data-style-choix]')){
      const s = e.target.closest('[data-style-choix]').dataset.styleChoix;
      if(s === reglagesTheme.style) return;
      reglagesTheme.style = s;
      // Léger fondu pendant le changement de style
      document.body.classList.remove('change-style'); void document.body.offsetWidth; document.body.classList.add('change-style');
      vibrer(8);
      toast(s === 'oneui' ? 'Style One UI' : 'Style Apple');
    }
    else return;
    Object.assign(reglagesTheme, nettoyerReglages(reglagesTheme));
    enregistrerTheme(); appliquerTheme(); majInfoJournee();
  });
  $('prefPrenom').addEventListener('input', e => {
    reglagesTheme.prenom = e.target.value.trim().slice(0, 30);
    enregistrerTheme(); appliquerTheme();
  });
  ['prefDebut', 'prefFin'].forEach(id => $(id).addEventListener('change', () => {
    const avant = reglagesTheme.debut + reglagesTheme.fin;
    Object.assign(reglagesTheme, nettoyerReglages({ ...reglagesTheme, debut:$('prefDebut').value, fin:$('prefFin').value }));
    if(reglagesTheme.debut + reglagesTheme.fin === avant) toast("La fin doit être après le début", 'alerte');
    enregistrerTheme(); appliquerTheme(); majInfoJournee();
  }));
  $('prefVibrations').addEventListener('change', e => {
    reglagesTheme.vibrations = e.target.checked;
    enregistrerTheme();
    if(reglagesTheme.vibrations) vibrer(30); // petit essai pour sentir la vibration
  });
  $('prefAjoutRapide').addEventListener('change', e => {
    reglagesTheme.ajoutRapide = e.target.checked;
    enregistrerTheme();
  });

  $('btnObjectifReglage').addEventListener('click', () => { fermerReglages(); ouvrirObjectif(); });

  // En mode « Auto », on suit le réglage du téléphone en direct
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const suivre = () => { if(reglagesTheme.mode === 'auto') appliquerTheme(); };
  if(mq.addEventListener) mq.addEventListener('change', suivre); else if(mq.addListener) mq.addListener(suivre);

  // Données
  $('btnExport').addEventListener('click', () => exporter());
  $('btnImport').addEventListener('click', () => $('fichierImport').click());
  $('fichierImport').addEventListener('change', e => {
    if(e.target.files[0]) importer(e.target.files[0]);
    e.target.value = '';
  });
  $('btnHistorique').addEventListener('click', () => {
    const n = taches.filter(t => t.archive).length;
    if(!n) return;
    if(!confirm(`Effacer définitivement ${n} tâche${n>1?'s':''} archivée${n>1?'s':''} ? Elles disparaîtront aussi du Bilan.`)) return;
    taches = taches.filter(t => !t.archive);
    sauvegarder(); rendre(); fermerReglages();
    toast('Tâches archivées effacées');
  });

  // Tout supprimer : confirmation, copie de secours (récupérable dans les Réglages) et « Annuler » immédiat
  $('btnToutSupprimer').addEventListener('click', () => {
    const n = taches.length;
    if(!n){ toast('Aucune tâche à supprimer'); return; }
    const actives = taches.filter(t => !t.fait && !t.archive).length;
    if(!confirm(`Supprimer définitivement toutes les tâches ?\n\n${actives} à faire et ${n - actives} terminée(s), toutes listes confondues (jour, semaine, plus tard, capture).\n\nConseil : exporte d'abord une sauvegarde. Tu pourras annuler juste après, ou les récupérer depuis les Réglages.`)) return;
    try{ localStorage.setItem(CLE_AVANT_IMPORT, JSON.stringify({ taches })); }catch(_){} // filet de sécurité
    try{ localStorage.removeItem('todoFocus'); }catch(_){}
    const avant = taches;
    taches = [];
    noter('suppr', `${n} tâche${n > 1 ? 's' : ''}`, 'tout supprimer');
    sauvegarder(); rendre(); fermerReglages();
    if(typeof majZoneSecours === 'function') majZoneSecours();
    vibrer([20, 60, 20]);
    toast('Toutes les tâches ont été supprimées', 'danger', { label:'Annuler', fn:()=>{ taches = avant; sauvegarder(); rendre(); toast('Tâches restaurées', 'succes'); } });
  });

  // Application
  $('btnResetPrefs').addEventListener('click', () => {
    if(!confirm("Remettre l'apparence, le prénom, la journée et les vibrations à leur valeur d'origine ? Tes tâches ne sont pas touchées.")) return;
    Object.assign(reglagesTheme, nettoyerReglages(null));
    enregistrerTheme(); appliquerTheme(); majInfoJournee();
    toast('Réglages réinitialisés');
  });
  // Recharge la dernière version : retire le service worker et son cache (jamais les tâches)
  $('btnMajApp').addEventListener('click', async () => {
    if(!confirm("Mettre à jour l'application ? Elle va se recharger. Tes tâches ne sont pas touchées.")) return;
    try{
      if('serviceWorker' in navigator){
        const ins = await navigator.serviceWorker.getRegistrations();
        await Promise.all(ins.map(i => i.unregister()));
      }
      if(window.caches){
        const noms = await caches.keys();
        await Promise.all(noms.map(n => caches.delete(n)));
      }
    }catch(_){}
    location.reload();
  });
  $('versionApp').textContent = VERSION_APP;

  chargerTheme();
  document.addEventListener('keydown', e => { if(e.key === 'Escape') fermerReglages(); });
})();
