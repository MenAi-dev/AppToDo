// Rappels : une alerte quelques minutes avant l'heure d'une tâche.
// Limite : sans serveur, l'alerte ne peut partir que tant que l'app tourne encore (ouverte ou récemment utilisée).
const CLE_AVANCE = 'todoAvance';
let avanceDefaut = 10; // minutes proposées par défaut
try{ const n = parseInt(localStorage.getItem(CLE_AVANCE), 10); if(n >= 0 && n <= 1440) avanceDefaut = n; }catch(_){}
function enregistrerAvanceDefaut(n){
  avanceDefaut = n;
  try{ localStorage.setItem(CLE_AVANCE, String(n)); }catch(_){}
}

const avanceDe = t => (t.avance === null || t.avance === undefined) ? avanceDefaut : t.avance;
const momentDe = t => new Date(t.date + 'T' + t.heure + ':00').getTime();
const alerteDe = t => momentDe(t) - avanceDe(t) * 60000;
const rappelsActifs = () => taches.filter(t => !t.fait && !t.archive && t.date && t.heure);

// --- Notifications système ---
function aideNotification(){
  if(!('Notification' in window)) return "Pour recevoir une notification : Partager → Sur l'écran d'accueil, puis ouvre l'app depuis l'icône. Sinon, tu verras l'alerte dans l'app.";
  if(Notification.permission === 'denied') return "Notifications bloquées dans les réglages d'Android : l'alerte s'affichera seulement dans l'app.";
  return "L'alerte arrive quelques minutes avant l'heure, tant que l'app est ouverte ou récemment utilisée.";
}
// À appeler depuis un geste (clic), sinon le navigateur refuse la demande
function demanderNotifications(){
  try{ if('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }catch(_){}
}
async function notifierSysteme(t, min){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body: min > 0 ? `Dans ${min} min · ${t.heure}` : `Maintenant · ${t.heure}`, tag:'rappel-' + t.id, icon:'icons/icon-192.png', data:{ id:t.id } };
  try{
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if(reg) await reg.showNotification(t.titre, options); else new Notification(t.titre, options);
  }catch(_){}
}

// --- Bandeau dans l'app ---
function texteQuand(t, now){
  const min = Math.round((momentDe(t) - now) / 60000);
  if(min > 0) return `dans ${min} min · ${t.heure}`;
  if(min === 0) return `maintenant · ${t.heure}`;
  return min > -60 ? `il y a ${-min} min · ${t.heure}` : `à ${t.heure}`;
}
function rendreBandeau(now){
  const zone = $('bandeauRappels');
  if(!zone) return;
  const liste = rappelsActifs()
    .filter(t => !t.vu && now >= alerteDe(t) && now - momentDe(t) < 12 * 3600000)
    .sort((a, b) => momentDe(a) - momentDe(b));
  zone.hidden = !liste.length;
  zone.innerHTML = liste.map(t => `<div class="rappel-item" data-id="${echapper(t.id)}">
    <div class="rappel-txt"><b>🔔 ${echapper(t.titre)}</b><span>${echapper(texteQuand(t, now))}</span></div>
    <button type="button" data-r="fait">Fait</button><button type="button" data-r="ok">OK</button></div>`).join('');
}

function majRappels(){
  const now = Date.now();
  let change = false;
  rappelsActifs().forEach(t => {
    if(!t.notifie && now >= alerteDe(t)){
      t.notifie = true; change = true;
      if(now <= momentDe(t) + 10 * 60000) notifierSysteme(t, Math.max(0, Math.ceil((momentDe(t) - now) / 60000)));
    }
  });
  if(change) sauvegarder();
  rendreBandeau(now);
}

$('bandeauRappels').addEventListener('click', e => {
  const b = e.target.closest('[data-r]');
  const t = b && taches.find(x => x.id === b.closest('.rappel-item').dataset.id);
  if(!t) return;
  if(b.dataset.r === 'fait') basculerFait(t);
  else { t.vu = true; sauvegarder(); majRappels(); }
});

setInterval(() => { if(!document.hidden) majRappels(); }, 15000);
