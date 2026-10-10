// Réglages : apparence (thème, couleur, taille du texte), prénom, vibrations, objectif, données, application.
// Tout est mémorisé sur l'appareil (clé « todoTheme »). js/precoce.js (dans <head>) pose déjà le thème avant l'affichage.
const THEME_CLE = 'todoTheme';
const VERSION_APP = 'v22';
const ACCENTS = [
  ['emeraude','Émeraude','#059669'], ['bleu','Bleu','#0A84FF'], ['vert','Vert','#30D158'], ['violet','Violet','#BF5AF2'],
  ['orange','Orange','#FF9F0A'], ['rose','Rose','#FF375F'], ['turquoise','Turquoise','#32ADE6']
];
const reglagesTheme = { mode:'sombre', accent:'emeraude', texte:'normal', prenom:'', vibrations:true };

// Accepte n'importe quoi (stockage modifié, fichier de sauvegarde…) et corrige les valeurs invalides
function nettoyerReglages(t){
  t = (t && typeof t === 'object') ? t : {};
  return {
    mode: ['auto','clair','sombre'].includes(t.mode) ? t.mode : 'sombre',
    accent: ACCENTS.some(a => a[0] === t.accent) ? t.accent : 'emeraude',
    texte: t.texte === 'grand' ? 'grand' : 'normal',
    prenom: typeof t.prenom === 'string' ? t.prenom.trim().slice(0, 30) : '',
    vibrations: t.vibrations !== false
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

// Texte sous le titre : date du jour, précédée d'un bonjour si un prénom est renseigné
function texteEntete(dateTxt){
  return reglagesTheme.prenom ? `Bonjour ${reglagesTheme.prenom} 👋 · ${dateTxt}` : dateTxt;
}

function appliquerTheme(){
  const r = document.documentElement, clair = themeClair();
  r.dataset.theme = clair ? 'clair' : 'sombre';
  r.dataset.accent = reglagesTheme.accent;
  if(reglagesTheme.texte === 'grand') r.dataset.texte = 'grand'; else delete r.dataset.texte;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = clair ? '#F2F3F7' : '#000000';
  document.querySelectorAll('.theme-mode[data-mode]').forEach(b => b.classList.toggle('actif', b.dataset.mode === reglagesTheme.mode));
  document.querySelectorAll('.reg-texte').forEach(b => b.classList.toggle('actif', b.dataset.texte === reglagesTheme.texte));
  document.querySelectorAll('.theme-accent').forEach(b => {
    const on = b.dataset.accent === reglagesTheme.accent;
    b.classList.toggle('actif', on); b.setAttribute('aria-pressed', on);
  });
  const pn = $('prefPrenom');
  if(pn && document.activeElement !== pn) pn.value = reglagesTheme.prenom;
  $('prefVibrations').checked = reglagesTheme.vibrations;
  if(typeof rendre === 'function' && typeof taches !== 'undefined') rendre(); // met à jour la salutation
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
function ouvrirReglages(){
  appliquerTheme(); majInfoObjectif(); majBoutonHistorique();
  if(typeof majInfoVerrou === 'function'){ majInfoVerrou(); majZoneSecours(); }
  $('overlayReglages').classList.add('actif');
}
function fermerReglages(){ $('overlayReglages').classList.remove('actif'); }

(function(){
  $('themeAccents').innerHTML = ACCENTS.map(([id, nom, couleur]) =>
    `<button class="theme-accent" type="button" data-accent="${id}" style="--c:${couleur}" aria-label="${nom}" title="${nom}"></button>`).join('');

  $('btnReglages').addEventListener('click', ouvrirReglages);
  $('reglagesFermer').addEventListener('click', fermerReglages);
  $('overlayReglages').addEventListener('click', e => { if(e.target === $('overlayReglages')) fermerReglages(); });

  $('overlayReglages').addEventListener('click', e => {
    const x = e.target.closest('.reg-texte'), m = e.target.closest('.theme-mode[data-mode]'), a = e.target.closest('.theme-accent');
    if(x) reglagesTheme.texte = x.dataset.texte;
    else if(m) reglagesTheme.mode = m.dataset.mode;
    else if(a) reglagesTheme.accent = a.dataset.accent;
    else return;
    enregistrerTheme(); appliquerTheme();
  });
  $('prefPrenom').addEventListener('input', e => {
    reglagesTheme.prenom = e.target.value.trim().slice(0, 30);
    enregistrerTheme(); appliquerTheme();
  });
  $('prefVibrations').addEventListener('change', e => {
    reglagesTheme.vibrations = e.target.checked;
    enregistrerTheme();
    if(reglagesTheme.vibrations) vibrer(30); // petit essai pour sentir la vibration
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
    if(!confirm(`Effacer définitivement ${n} tâche${n>1?'s':''} archivée${n>1?'s':''} ? Elles disparaîtront aussi de l'onglet Analyse.`)) return;
    taches = taches.filter(t => !t.archive);
    sauvegarder(); rendre(); fermerReglages();
    toast('Tâches archivées effacées');
  });

  // Application
  $('btnResetPrefs').addEventListener('click', () => {
    if(!confirm("Remettre l'apparence, le prénom et les vibrations à leur valeur d'origine ? Tes tâches ne sont pas touchées.")) return;
    Object.assign(reglagesTheme, nettoyerReglages(null));
    enregistrerTheme(); appliquerTheme();
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
