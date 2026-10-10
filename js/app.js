function init(){
  chargerJournal();
  charger();
  rendre();
  majOptionsAjout();
  astuceGestes();
}

// Une seule fois, sur écran tactile : explique les gestes (sinon personne ne les découvre)
function astuceGestes(){
  try{
    if(!window.matchMedia('(pointer: coarse)').matches || localStorage.getItem('todoAstuceGestes') || !taches.some(t=>!t.archive)) return;
    localStorage.setItem('todoAstuceGestes', '1');
    setTimeout(()=>toast('Astuce : glisse une tâche vers la droite pour la terminer, vers la gauche pour la supprimer'), 1200);
  }catch(_){}
}
init();

// Si l'appli reste ouverte à minuit, on met à jour « Aujourd'hui / En retard »
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) rendre(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.error('SW', e));
  });
}
