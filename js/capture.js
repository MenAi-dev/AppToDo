// LOT 2 · Capture (vider sa tête) et tri carte par carte (partie 7.1-7.2 du guide, inspirée de GTD).
// Capture : on écrit tout, sans trier, une idée par ligne. Rien ne s'y perd et l'esprit se libère (effet Zeigarnik).
// Tri : chaque élément passe une seule fois par la question « qu'est-ce que j'en fais ? ».

const enCapture = () => taches.filter(t => !t.archive && !t.fait && t.liste === 'capture').sort((a, b) => a.creeLe - b.creeLe);

// Ajoute une ou plusieurs idées (une par ligne) à la capture
function capturer(texte){
  const lignes = String(texte || '').split(/\r?\n/).map(s => s.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 50);
  lignes.forEach((titre, i) => {
    const t = nettoyerTache({ id:nouvelId(), titre, liste:'capture', date:'', taille:'petite', priorite:'B', creeLe:Date.now() + i });
    if(t){ taches.push(t); noter('ajout', t.titre, 'capture'); }
  });
  if(lignes.length) sauvegarder();
  return lignes.length;
}

function htmlCapture(){
  const items = enCapture();
  const lignes = items.map(t => `<div class="capture-ligne" data-id="${t.id}">
      <span class="capture-puce"></span><span class="capture-titre">${echapper(t.titre)}</span>
      <button class="capture-x" type="button" data-act="suppr-capture" aria-label="Supprimer">✕</button></div>`).join('');
  return `<p class="chapo">Écris tout ce qui te passe par la tête : tâches, idées, rappels, inquiétudes. Ne trie pas encore.</p>
    <form class="capture-form" id="formCapture" autocomplete="off">
      <input id="inputCapture" type="text" maxlength="140" placeholder="Une idée… puis Entrée" enterkeyhint="send" aria-label="Noter une idée">
      <button type="submit" class="btn-plus" aria-label="Noter">+</button>
    </form>
    <div class="loi">Zeigarnik : une tâche non notée continue de tourner dans la tête. Ce qui est écrit n'a plus besoin d'être retenu.</div>
    ${items.length ? `
      <button class="btn-tri" type="button" data-act="trier"><span class="btn-tri-n">${items.length}</span><span><b>Trier la capture</b><small>Supprimer · Faire · Planifier · Déléguer</small></span><span class="fleche">→</span></button>
      <section class="groupe"><div class="groupe-titre"><span>Dans la capture</span><span class="groupe-nb">${items.length}</span></div><div class="groupe-liste capture-liste">${lignes}</div></section>`
      : `<div class="vide"><b>Tête vide, esprit libre</b>Note ici tout ce qui te traverse l'esprit, puis trie-le en une fois.</div>`}`;
}

// ---------- Le tri : une carte à la fois ----------
let tri = null; // { file:[ids], i, hist:[] }

function ouvrirTri(){
  const ids = enCapture().map(t => t.id);
  if(!ids.length) return;
  tri = { file:ids, i:0, hist:[] };
  $('overlayTri').classList.add('actif');
  dessinerCarteTri();
}
function fermerTri(){
  $('overlayTri').classList.remove('actif');
  tri = null;
  rendre();
}
function dessinerCarteTri(){
  const zone = $('triZone');
  const t = tri && taches.find(x => x.id === tri.file[tri.i]);
  $('triCompte').textContent = tri ? `${Math.min(tri.i + 1, tri.file.length)} / ${tri.file.length}` : '';
  $('triBarre').style.width = tri ? (tri.i / tri.file.length * 100) + '%' : '0';
  $('triAnnuler').hidden = !(tri && tri.hist.length);
  if(!t){
    zone.innerHTML = `<div class="tri-fin"><div class="index">✓</div><b>Capture triée</b><p>Tout a trouvé sa place. L'esprit est libre.</p>
      <button class="btn-valider" type="button" data-tri="fermer">Terminé</button></div>`;
    $('triActions').hidden = true;
    return;
  }
  $('triActions').hidden = false;
  $('triDelegue').hidden = true;
  zone.innerHTML = `<div class="tri-carte" id="triCarte">
      <div class="micro"><i class="carre"></i>Qu'est-ce que j'en fais ?</div>
      <div class="tri-titre">${echapper(t.titre)}</div>
      <div class="tri-indice g">Supprimer</div><div class="tri-indice d">Aujourd'hui</div><div class="tri-indice h">Plus tard</div>
    </div>
    <p class="tri-aide">Glisse ← supprimer · → aujourd'hui · ↑ plus tard</p>`;
  const c = $('triCarte'); c.classList.add('entre');
}

// Applique une décision à la carte en cours (avec mémoire pour « Annuler »)
function deciderTri(choix, qui){
  const t = tri && taches.find(x => x.id === tri.file[tri.i]);
  if(!t) return;
  const avant = { ...t };
  let message = '';
  if(choix === 'suppr'){
    const idx = taches.indexOf(t); taches.splice(idx, 1); noter('suppr', t.titre, 'tri');
    tri.hist.push({ type:'suppr', t:avant, idx });
    message = 'Supprimée : pas utile';
  } else {
    if(choix === 'fait'){ t.fait = true; t.faitLe = Date.now(); t.liste = 'jour'; t.date = auj(); noter('fait', t.titre, 'moins de 2 min'); message = 'Faite tout de suite (règle des 2 minutes)'; }
    if(choix === 'jour'){ t.liste = 'jour'; t.date = auj(); t.taille = premiereTailleLibre(); message = "Ajoutée à aujourd'hui"; }
    if(choix === 'semaine'){ t.liste = 'semaine'; t.date = ''; message = 'Ajoutée à la semaine'; }
    if(choix === 'plustard'){ t.liste = 'plustard'; t.date = ''; message = 'Rangée « un jour, peut-être »'; }
    if(choix === 'deleguer'){ t.liste = 'semaine'; t.date = ajouterJours(auj(), 2); t.delegue = qui; t.titre = `Vérifier avec ${qui} : ${t.titre}`.slice(0, 140); message = `Confiée à ${qui} · suivi dans 2 jours`; }
    tri.hist.push({ type:'modif', t:avant });
  }
  sauvegarder();
  vibrer(choix === 'suppr' ? 18 : 8);
  // La carte s'envole dans la direction du choix
  const c = $('triCarte'), dir = { suppr:'g', jour:'d', fait:'d', plustard:'h', semaine:'h', deleguer:'h' }[choix];
  if(c){ c.classList.add('part-' + dir); }
  $('triMessage').textContent = message;
  setTimeout(() => { tri.i++; dessinerCarteTri(); }, 220);
}
function annulerTri(){
  if(!tri || !tri.hist.length) return;
  const h = tri.hist.pop();
  if(h.type === 'suppr') taches.splice(Math.min(h.idx, taches.length), 0, h.t);
  else { const t = taches.find(x => x.id === h.t.id); if(t) Object.assign(t, h.t); }
  sauvegarder();
  tri.i = Math.max(0, tri.i - 1);
  $('triMessage').textContent = 'Décision annulée';
  dessinerCarteTri();
}

// ---------- Branchements ----------
(function(){
  // Saisie de la capture (le formulaire est redessiné : délégation sur le document)
  document.addEventListener('submit', e => {
    if(e.target.id !== 'formCapture') return;
    e.preventDefault();
    const champ = $('inputCapture');
    const n = capturer(champ.value);
    if(!n){ champ.focus(); return; }
    vibrer(6);
    rendre();
    const neuf = $('inputCapture'); if(neuf) neuf.focus();
  });
  // Coller plusieurs lignes : une idée par ligne
  document.addEventListener('paste', e => {
    if(e.target.id !== 'inputCapture') return;
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    if(!/\n/.test(txt)) return;
    e.preventDefault();
    const n = capturer(txt);
    rendre(); toast(`${n} idée${n > 1 ? 's' : ''} capturée${n > 1 ? 's' : ''}`);
  });

  $('overlayTri').addEventListener('click', e => {
    const b = e.target.closest('[data-tri]');
    if(!b) return;
    const a = b.dataset.tri;
    if(a === 'fermer') return fermerTri();
    if(a === 'annuler') return annulerTri();
    if(a === 'deleguer'){ $('triDelegue').hidden = false; $('triQui').value = ''; $('triQui').focus(); return; }
    if(a === 'deleguer-ok'){
      const qui = $('triQui').value.trim();
      if(!qui){ $('triQui').focus(); return; }
      return deciderTri('deleguer', qui.slice(0, 40));
    }
    deciderTri(a);
  });
  $('triQui').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); $('overlayTri').querySelector('[data-tri="deleguer-ok"]').click(); } });

  // Glisser la carte : ← supprimer, → aujourd'hui, ↑ plus tard
  let g = null;
  $('triZone').addEventListener('pointerdown', e => {
    const c = e.target.closest('.tri-carte');
    if(!c) return;
    g = { c, x0:e.clientX, y0:e.clientY, dx:0, dy:0, pid:e.pointerId };
    try{ c.setPointerCapture(e.pointerId); }catch(_){}
    c.classList.add('glisse');
  });
  $('triZone').addEventListener('pointermove', e => {
    if(!g || e.pointerId !== g.pid) return;
    g.dx = e.clientX - g.x0; g.dy = Math.min(0, e.clientY - g.y0);
    g.c.style.transform = `translate(${g.dx}px, ${g.dy}px) rotate(${g.dx / 18}deg)`;
    const seuil = 90;
    g.c.dataset.vers = g.dx < -seuil ? 'g' : g.dx > seuil ? 'd' : g.dy < -seuil ? 'h' : '';
  });
  const fin = e => {
    if(!g || e.pointerId !== g.pid) return;
    const vers = g.c.dataset.vers, c = g.c;
    g = null;
    c.classList.remove('glisse');
    if(vers){ c.style.transform = ''; deciderTri(vers === 'g' ? 'suppr' : vers === 'd' ? 'jour' : 'plustard'); }
    else { c.style.transform = ''; delete c.dataset.vers; }
  };
  $('triZone').addEventListener('pointerup', fin);
  $('triZone').addEventListener('pointercancel', fin);
  document.addEventListener('keydown', e => {
    if(!tri || !$('overlayTri').classList.contains('actif') || !$('triDelegue').hidden) return;
    const k = { ArrowLeft:'suppr', ArrowRight:'jour', ArrowUp:'plustard', Escape:'fermer' }[e.key];
    if(k === 'fermer') fermerTri(); else if(k){ e.preventDefault(); deciderTri(k); }
  });
})();
