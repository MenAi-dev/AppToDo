// Chargé dans <head>, avant l'affichage : évite tout « éclair » au démarrage.
// 1. Si un code PIN est défini, l'appli démarre déjà verrouillée (aucun contenu visible avant la saisie).
// 2. Thème (sombre par défaut, style iOS) et taille du texte sont posés tout de suite.
try{
  var r = document.documentElement;
  if(localStorage.getItem('todoPin')) r.classList.add('verrouille');
  r.classList.add('avec-splash'); // écran de bienvenue au lancement (js/accueil.js)
  var t = JSON.parse(localStorage.getItem('todoTheme') || '{}');
  // Passage au style iOS (v32) : une seule fois, le thème passe en sombre
  if(!localStorage.getItem('todoV32')){
    t.mode = 'sombre'; delete t.accent;
    localStorage.setItem('todoTheme', JSON.stringify(t));
    localStorage.setItem('todoV32', '1');
  }
  var m = t.mode || 'sombre';
  r.dataset.theme = (m === 'clair' || (m === 'auto' && matchMedia('(prefers-color-scheme: light)').matches)) ? 'clair' : 'sombre';
  r.dataset.couleur = t.couleur || 'indigo'; // couleur principale (couleurs système d'Apple)
  if(t.texte === 'grand') r.dataset.texte = 'grand';
}catch(e){}
