// LOT 4 · Mode Focus (partie 11) : une seule chose à la fois, minuteur Pomodoro, temps réel mesuré.
// - 25 min de travail / 5 min de pause (ou 50/10, dans les Réglages) ; pause longue après 4 cycles (loi d'Illich).
// - Le temps réellement passé s'ajoute à la tâche : le Bilan compare estimé et réel (loi de Hofstadter).
// - L'état est gardé sur l'appareil : le minuteur continue même si l'écran s'éteint ou si l'appli est fermée.
const CLE_FOCUS = 'todoFocus';
let focus = lireJSON(CLE_FOCUS, null); // { id, phase:'travail'|'pause', fin (ts) | reste (ms, en pause), cycles, sec (travail cumulé) }
let tic = null;

const dureesPomodoro = () => reglagesTheme.pomodoro === 50 ? { travail:50, pause:10, longue:20 } : { travail:25, pause:5, longue:20 };
const sauverFocus = () => ecrireJSON(CLE_FOCUS, focus);
const tacheFocus = () => focus && taches.find(t => t.id === focus.id);

function ouvrirFocus(id){
  const t = taches.find(x => x.id === id);
  if(!t) return;
  if(!focus || focus.id !== id){
    arreterSegment();
    focus = { id, phase:'travail', reste:dureesPomodoro().travail * 60000, fin:null, cycles:0, sec:0, debutSeg:null };
    sauverFocus();
  }
  $('overlayFocus').classList.add('actif');
  document.documentElement.classList.add('en-focus');
  dessinerFocus();
  clearInterval(tic); tic = setInterval(tick, 250);
}
function fermerFocus(){
  $('overlayFocus').classList.remove('actif');
  document.documentElement.classList.remove('en-focus');
  clearInterval(tic); tic = null;
  rendre();
}
const enMarche = () => !!(focus && focus.fin);
function restantMs(){ return !focus ? 0 : focus.fin ? Math.max(0, focus.fin - Date.now()) : focus.reste; }

// Le temps de travail compte dès que le minuteur tourne en phase « travail »
function arreterSegment(){
  if(!focus || !focus.debutSeg) return;
  focus.sec += (Date.now() - focus.debutSeg) / 1000;
  focus.debutSeg = null;
  const t = tacheFocus();
  if(t){
    const ajout = Math.floor(focus.sec / 60);
    if(ajout > 0){ t.reel = (t.reel || 0) + ajout; focus.sec -= ajout * 60; sauvegarder(); }
  }
}
function demarrer(){
  if(!focus || enMarche()) return;
  focus.fin = Date.now() + focus.reste;
  if(focus.phase === 'travail') focus.debutSeg = Date.now();
  sauverFocus(); vibrer(8); dessinerFocus();
}
function mettrePause(){
  if(!enMarche()) return;
  focus.reste = restantMs(); focus.fin = null;
  arreterSegment(); sauverFocus(); dessinerFocus();
}
function phaseSuivante(auto){
  const d = dureesPomodoro();
  arreterSegment();
  if(focus.phase === 'travail'){
    focus.cycles++;
    focus.phase = 'pause';
    focus.reste = (focus.cycles % 4 === 0 ? d.longue : d.pause) * 60000;
  } else {
    focus.phase = 'travail';
    focus.reste = d.travail * 60000;
  }
  focus.fin = null;
  sauverFocus();
  if(auto){
    vibrer([200, 100, 200]);
    const msg = focus.phase === 'pause' ? (focus.cycles % 4 === 0 ? 'Quatre cycles : prends une vraie pause (loi d\'Illich).' : 'Pomodoro terminé : 5 minutes de pause.') : 'Pause terminée : on reprend.';
    toast(msg, 'succes');
    try{
      if('Notification' in window && Notification.permission === 'granted'){
        navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification('Tâches', { body:msg, tag:'focus', icon:'icons/icon-192.png' }) : new Notification('Tâches', { body:msg }));
      }
    }catch(_){}
  }
  dessinerFocus();
}
function tick(){
  if(!focus) return;
  if(enMarche() && restantMs() <= 0) phaseSuivante(true);
  else majCompteur();
}

function majCompteur(){
  const ms = restantMs(), total = (focus.phase === 'travail' ? dureesPomodoro().travail : (focus.cycles % 4 === 0 ? dureesPomodoro().longue : dureesPomodoro().pause)) * 60000;
  const s = Math.ceil(ms / 1000);
  $('focusTemps').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const L = 2 * Math.PI * 108;
  $('focusArc').style.strokeDasharray = L;
  $('focusArc').style.strokeDashoffset = L * (ms / total);
  // Temps réel en direct (Hofstadter : au-delà de 150 % de l'estimation, on replanifie)
  const t = tacheFocus();
  if(t){
    const reel = (t.reel || 0) + Math.floor((focus.sec + (focus.debutSeg ? (Date.now() - focus.debutSeg) / 1000 : 0)) / 60);
    $('focusReel').textContent = t.duree ? `Prévu ${dureeTexte(t.duree)} · passé ${dureeTexte(reel)}` : `Passé ${dureeTexte(reel)}`;
    const depasse = t.duree && reel > t.duree * 1.5;
    $('focusLoi').textContent = depasse ? 'Hofstadter : cette tâche dépasse sa durée de 50 %. Arrête-toi et replanifie : découpe-la ou repousse la fin.'
      : focus.phase === 'pause' ? 'Illich : la pause fait partie du travail. Lève-toi, bois de l\'eau, regarde au loin.'
      : 'Carlson : un travail interrompu coûte plus cher. Téléphone en silencieux, une seule chose à la fois.';
    $('focusLoi').classList.toggle('alerte', !!depasse);
  }
}
function dessinerFocus(){
  const t = tacheFocus();
  if(!t){ fermerFocus(); return; }
  const o = $('overlayFocus');
  o.dataset.phase = focus.phase;
  o.classList.toggle('marche', enMarche());
  $('focusPhase').textContent = focus.phase === 'travail' ? `Cycle ${focus.cycles + 1} · travail` : (focus.cycles % 4 === 0 ? 'Pause longue' : 'Pause');
  $('focusTitre').textContent = t.titre;
  $('focusLecture').textContent = enMarche() ? 'Pause' : (focus.phase === 'travail' ? 'Démarrer' : 'Démarrer la pause');
  $('focusCycles').innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < focus.cycles % 4 || (focus.cycles && focus.cycles % 4 === 0 && focus.phase === 'pause') ? 'ok' : ''}"></i>`).join('');
  majCompteur();
}
function terminerFocus(){
  const t = tacheFocus();
  arreterSegment();
  focus = null; ecrireJSON(CLE_FOCUS, null);
  fermerFocus();
  if(t && !t.fait) basculerFait(t);
}
function quitterFocus(){
  arreterSegment();
  focus = null; ecrireJSON(CLE_FOCUS, null);
  fermerFocus();
}

(function(){
  $('overlayFocus').addEventListener('click', e => {
    const b = e.target.closest('[data-focus]');
    if(!b) return;
    const a = b.dataset.focus;
    if(a === 'lecture') enMarche() ? mettrePause() : demarrer();
    else if(a === 'passer') phaseSuivante(false);
    else if(a === 'terminer') terminerFocus();
    else if(a === 'quitter') quitterFocus();
    else if(a === 'reduire') fermerFocus();
  });
  // Au retour dans l'appli, le minuteur a continué : on rattrape
  document.addEventListener('visibilitychange', () => { if(!document.hidden && focus && $('overlayFocus').classList.contains('actif')) tick(); });
  // Un Focus était en cours à la fermeture : on le rouvre
  // (après le chargement des tâches par app.js)
  setTimeout(() => {
    if(focus && tacheFocus() && !tacheFocus().fait) ouvrirFocus(focus.id);
    else if(focus){ focus = null; ecrireJSON(CLE_FOCUS, null); }
  }, 300);
})();
