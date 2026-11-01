// Courbe d'évolution des tâches terminées (accueil). SVG dessiné à la main, sans bibliothèque.
// Interactive : toucher ou glisser le doigt sur la courbe affiche le jour et le nombre de tâches terminées.
// Elle démarre dès la première tâche terminée, et se redessine (animation du trait) à chaque nouvelle tâche terminée.
const CLE_COURBE = 'todoCourbe';
let courbeJours = 7;
try{ const n = parseInt(localStorage.getItem(CLE_COURBE), 10); if(n === 7 || n === 30) courbeJours = n; }catch(_){}
let courbeDernierTotal = null;   // total de tâches terminées lors du dernier dessin (pour animer une nouvelle réussite)
let courbeDonnees = [];          // [{ j, n }] pour la période affichée
let courbeGeo = null;            // géométrie du dernier dessin (pour le survol)

// Tâches terminées par jour sur les n derniers jours (archivées comprises)
function donneesCourbe(n){
  const parJour = {};
  taches.forEach(t => { if(t.fait && t.faitLe){ const j = versISO(new Date(t.faitLe)); parJour[j] = (parJour[j] || 0) + 1; } });
  const fin = auj(), out = [];
  for(let i = n - 1; i >= 0; i--){ const j = ajouterJours(fin, -i); out.push({ j, n:parJour[j] || 0 }); }
  const total = taches.filter(t => t.fait && t.faitLe).length;
  return { jours:out, total };
}

// Courbe lisse qui ne dépasse pas les points (interpolation cubique monotone)
function cheminLisse(p){
  const n = p.length;
  if(n < 2) return `M${p[0].x},${p[0].y}`;
  const h = [], d = [];
  for(let i = 0; i < n - 1; i++){ h[i] = p[i+1].x - p[i].x; d[i] = (p[i+1].y - p[i].y) / h[i]; }
  const m = [d[0]];
  for(let i = 1; i < n - 1; i++) m[i] = d[i-1] * d[i] <= 0 ? 0 : (d[i-1] + d[i]) / 2;
  m[n-1] = d[n-2];
  for(let i = 0; i < n - 1; i++){
    if(d[i] === 0){ m[i] = 0; m[i+1] = 0; continue; }
    const a = m[i] / d[i], b = m[i+1] / d[i], s = a*a + b*b;
    if(s > 9){ const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i+1] = t * b * d[i]; }
  }
  let c = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for(let i = 0; i < n - 1; i++){
    c += `C${(p[i].x + h[i]/3).toFixed(1)},${(p[i].y + m[i]*h[i]/3).toFixed(1)} ${(p[i+1].x - h[i]/3).toFixed(1)},${(p[i+1].y - m[i+1]*h[i]/3).toFixed(1)} ${p[i+1].x.toFixed(1)},${p[i+1].y.toFixed(1)}`;
  }
  return c;
}

const libelleCourbe = j => new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }).replace(/\./g, '');
const pluriel = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;

function rendreCourbe(){
  const zone = $('courbe');
  if(!zone || zone.hidden) return;
  const { jours, total } = donneesCourbe(courbeJours);
  courbeDonnees = jours;
  const somme = jours.reduce((s, x) => s + x.n, 0), max = Math.max(3, ...jours.map(x => x.n));
  const anime = courbeDernierTotal !== null && total > courbeDernierTotal;
  courbeDernierTotal = total;

  const W = Math.max(260, zone.clientWidth - 0 || 320), H = 150, g = 6, haut = 12, bas = 24;
  const x = i => g + i * (W - 2 * g) / (jours.length - 1);
  const y = v => haut + (1 - v / max) * (H - haut - bas);
  const pts = jours.map((d, i) => ({ x:x(i), y:y(d.n) }));
  const ligne = cheminLisse(pts);
  const aire = `${ligne}L${pts[pts.length-1].x.toFixed(1)},${(H - bas)}L${pts[0].x.toFixed(1)},${(H - bas)}Z`;
  courbeGeo = { W, pts };

  // Étiquettes de l'axe : initiales des jours (7 j) ou 3 dates (30 j)
  const etiq = jours.map((d, i) => {
    if(courbeJours === 7){
      const l = new Date(d.j + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'narrow' }).toUpperCase();
      return `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="${i === jours.length - 1 ? 'auj' : ''}">${l}</text>`;
    }
    if(i === 0 || i === Math.floor((jours.length - 1) / 2) || i === jours.length - 1){
      const l = new Date(d.j + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' }).replace(/\./g, '');
      return `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === jours.length - 1 ? 'end' : 'middle'}">${l}</text>`;
    }
    return '';
  }).join('');

  const vide = total === 0;
  zone.innerHTML = `
    <div class="courbe-tete">
      <div>
        <div class="micro">Évolution</div>
        <div class="courbe-valeur" id="cvVal">${somme}</div>
        <div class="courbe-sous" id="cvSub">${vide ? 'Aucune tâche terminée pour l\'instant' : pluriel(somme, 'tâche') + ' terminée' + (somme > 1 ? 's' : '') + ' · ' + courbeJours + ' derniers jours'}</div>
      </div>
      <div class="seg seg-courbe" role="group" aria-label="Période">
        <button type="button" data-cj="7" aria-pressed="${courbeJours === 7}">7 j</button>
        <button type="button" data-cj="30" aria-pressed="${courbeJours === 30}">30 j</button>
      </div>
    </div>
    <div class="courbe-zone" id="cvZone">
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Courbe des tâches terminées par jour">
        <defs><linearGradient id="cvGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--bleu)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--bleu)" stop-opacity="0"/></linearGradient></defs>
        <line class="cv-grille" x1="${g}" x2="${W - g}" y1="${y(0)}" y2="${y(0)}"/>
        <line class="cv-grille cv-tiret" x1="${g}" x2="${W - g}" y1="${y(max)}" y2="${y(max)}"/>
        <text class="cv-max" x="${g}" y="${y(max) - 4}">${max}</text>
        <path class="cv-aire" d="${aire}" fill="url(#cvGrad)"/>
        <path class="cv-ligne${anime ? ' anime' : ''}" id="cvLigne" d="${ligne}" pathLength="1"/>
        <g id="cvCurseur" hidden><line class="cv-guide" id="cvGuide" y1="${haut}" y2="${H - bas}"/><circle class="cv-point" id="cvPoint" r="5"/></g>
        <circle class="cv-point cv-auj" id="cvAuj" cx="${pts[pts.length-1].x.toFixed(1)}" cy="${pts[pts.length-1].y.toFixed(1)}" r="4.5"/>
        ${etiq}
      </svg>
      ${vide ? '<div class="courbe-vide">Termine une tâche : ta courbe commence ici.</div>' : ''}
    </div>`;
}

// Interactions (une seule fois, par délégation)
(function(){
  const zone = $('courbe');
  function indexDepuis(e){
    const z = $('cvZone');
    if(!z || !courbeGeo) return -1;
    const r = z.getBoundingClientRect();
    const px = (e.clientX - r.left) * (courbeGeo.W / r.width);
    let meilleur = 0, dmin = Infinity;
    courbeGeo.pts.forEach((p, i) => { const d = Math.abs(p.x - px); if(d < dmin){ dmin = d; meilleur = i; } });
    return meilleur;
  }
  function montrer(i){
    const p = courbeGeo.pts[i], d = courbeDonnees[i];
    $('cvCurseur').hidden = false;
    $('cvGuide').setAttribute('x1', p.x); $('cvGuide').setAttribute('x2', p.x);
    $('cvPoint').setAttribute('cx', p.x); $('cvPoint').setAttribute('cy', p.y);
    $('cvAuj').style.opacity = 0;
    $('cvVal').textContent = d.n;
    $('cvSub').textContent = `${pluriel(d.n, 'tâche')} terminée${d.n > 1 ? 's' : ''} · ${libelleCourbe(d.j)}`;
  }
  function masquer(){
    if(!$('cvCurseur')) return;
    $('cvCurseur').hidden = true; $('cvAuj').style.opacity = 1;
    const somme = courbeDonnees.reduce((s, x) => s + x.n, 0);
    $('cvVal').textContent = somme;
    $('cvSub').textContent = courbeDernierTotal === 0 ? "Aucune tâche terminée pour l'instant"
      : `${pluriel(somme, 'tâche')} terminée${somme > 1 ? 's' : ''} · ${courbeJours} derniers jours`;
  }
  let actif = false;
  zone.addEventListener('pointerdown', e => { if(!e.target.closest('#cvZone')) return; actif = true; const i = indexDepuis(e); if(i >= 0){ montrer(i); vibrer(4); } });
  zone.addEventListener('pointermove', e => { if(!e.target.closest('#cvZone')) return; if(actif || e.pointerType === 'mouse'){ const i = indexDepuis(e); if(i >= 0) montrer(i); } });
  ['pointerup', 'pointercancel'].forEach(t => zone.addEventListener(t, e => { actif = false; if(e.pointerType !== 'mouse') masquer(); }));
  zone.addEventListener('pointerleave', () => { actif = false; masquer(); });
  zone.addEventListener('click', e => {
    const b = e.target.closest('[data-cj]');
    if(!b) return;
    courbeJours = Number(b.dataset.cj) === 30 ? 30 : 7;
    try{ localStorage.setItem(CLE_COURBE, String(courbeJours)); }catch(_){}
    rendreCourbe();
  });
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(rendreCourbe, 150); });
})();
