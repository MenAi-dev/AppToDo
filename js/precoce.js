// Chargé dans <head>, avant l'affichage : évite tout « éclair » au démarrage.
// 1. Si un code PIN est défini, l'appli démarre déjà verrouillée (aucun contenu visible avant la saisie).
// 2. Thème, couleur d'accent et taille du texte (réglages) sont posés tout de suite.
try{
  var r = document.documentElement;
  if(localStorage.getItem('todoPin')) r.classList.add('verrouille');
  var t = JSON.parse(localStorage.getItem('todoTheme') || '{}'), m = t.mode || 'sombre';
  r.dataset.theme = (m === 'clair' || (m === 'auto' && matchMedia('(prefers-color-scheme: light)').matches)) ? 'clair' : 'sombre';
  r.dataset.accent = t.accent || 'emeraude';
  if(t.texte === 'grand') r.dataset.texte = 'grand';
}catch(e){}
