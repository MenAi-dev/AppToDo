// LOT 4 · Bilan : les signes que la méthode fonctionne (partie 14.3) et les lois du temps (partie 3.6).
// Chaque soir (au premier affichage du lendemain), une ligne d'historique garde l'essentiel de la journée.
const CLE_HISTO = 'todoHistorique';

function enregistrerJour(jour){
  const histo = lireJSON(CLE_HISTO, []);
  if(histo.some(h => h.date === jour)) return;
  const p = planDuJour(jour);
  const tous = [...p.dansPlan, ...p.horsPlan];
  if(!tous.length) return;
  const g = p.plan.grande.faites[0], gPrevue = g || p.plan.grande.afaire[0];
  histo.push({
    date:jour, prevues:tous.length, faites:tous.filter(t => t.fait).length,
    grenouille: !gPrevue ? 'aucune' : g ? (new Date(g.faitLe).getHours() < 12 ? 'matin' : 'apres') : 'non',
    minutes: tous.reduce((s, t) => s + dureePlanifiee(t), 0)
  });
  ecrireJSON(CLE_HISTO, histo.slice(-120));
}

const LOIS = [
  ['Parkinson', 'Le travail occupe tout le temps disponible.', 'Donne une durée limite à chaque tâche.'],
  ['Pareto', 'Environ 20 % des actions donnent 80 % des résultats.', 'Fais d\'abord les 2 ou 3 tâches à fort impact.'],
  ['Illich', 'Au-delà d\'un seuil, le rendement baisse.', 'Travaille en blocs de 50 à 90 min, avec de vraies pauses.'],
  ['Carlson', 'Un travail interrompu prend plus de temps.', 'Protège tes plages de concentration.'],
  ['Laborit', 'On fait d\'abord ce qui plaît ou ce qui est facile.', 'Commence par la tâche difficile : la grenouille.'],
  ['Hofstadter', 'Tout prend plus de temps que prévu.', 'Ajoute une marge de 20 à 30 %.'],
  ['Murphy', 'Ce qui peut mal tourner finit par mal tourner.', 'Prévois un bloc tampon et un plan B.'],
  ['Fraisse', 'Le temps vécu n\'a pas la durée de l\'horloge.', 'Mesure ton temps réel, ne te fie pas à l\'impression.'],
  ['Zeigarnik', 'Une tâche inachevée occupe l\'esprit.', 'Écris tout, avec une prochaine action.']
];

function htmlBilan(){
  const histo = lireJSON(CLE_HISTO, []).filter(h => h.date >= ajouterJours(auj(), -14));
  const pc = (n, d) => d ? Math.round(n / d * 100) + ' %' : '—';
  const terminees = histo.filter(h => h.faites >= h.prevues).length;
  const avecG = histo.filter(h => h.grenouille !== 'aucune'), gMatin = avecG.filter(h => h.grenouille === 'matin').length;
  const { capacite } = capaciteJour();
  const realistes = histo.filter(h => h.minutes && h.minutes <= capacite).length, avecMin = histo.filter(h => h.minutes).length;
  const mesurees = taches.filter(t => t.fait && t.duree && t.reel).sort((a, b) => b.faitLe - a.faitLe);
  const ratio = mesurees.length ? mesurees.reduce((s, t) => s + t.reel / t.duree, 0) / mesurees.length : 0;
  const reportees = taches.filter(t => !t.archive && !t.fait && t.reports >= 3).length;
  const tuile = (label, val, sous) => `<div class="stat-tuile"><div class="label">${label}</div><div class="valeur">${val}</div>${sous ? `<div class="stat-sous">${sous}</div>` : ''}</div>`;

  // Estimé contre réel : les 6 dernières tâches mesurées en mode Focus
  const maxM = Math.max(1, ...mesurees.slice(0, 6).flatMap(t => [t.duree, t.reel]));
  const barres = mesurees.slice(0, 6).map((t, i) => `<div class="er-ligne" style="--i:${i}"><div class="er-titre">${echapper(t.titre)}</div>
      <div class="er-barre"><i class="est" style="width:${t.duree / maxM * 100}%"></i><span>${dureeTexte(t.duree)}</span></div>
      <div class="er-barre"><i class="reel${t.reel > t.duree * 1.3 ? ' trop' : ''}" style="width:${t.reel / maxM * 100}%"></i><span>${dureeTexte(t.reel)}</span></div></div>`).join('');

  return `<div class="sous-titre"><span class="num">A</span>14 derniers jours</div>
    <div class="stats-grille">
      ${tuile('Listes terminées', pc(terminees, histo.length), `${terminees}/${histo.length} jours`)}
      ${tuile('Grenouille avant midi', pc(gMatin, avecG.length), `${gMatin}/${avecG.length} jours`)}
      ${tuile('Journées réalistes', pc(realistes, avecMin), '≤ 60 % planifiés')}
      ${tuile('Estimé → réel', ratio ? `×${ratio.toFixed(1).replace('.', ',')}` : '—', ratio ? (ratio > 1.3 ? 'augmente ta marge' : 'estimations justes') : 'mesure avec Focus')}
    </div>
    ${reportees ? `<div class="loi alerte">${reportees} tâche${reportees > 1 ? 's' : ''} reportée${reportees > 1 ? 's' : ''} 3 fois ou plus</div>` : ''}
    ${barres ? `<section class="carte"><div class="carte-tete"><div class="micro">Estimé · réel</div></div><div class="er-leg"><span><i class="est"></i>estimé</span><span><i class="reel"></i>réel</span></div>${barres}</section>` : ''}
    <div class="sous-titre"><span class="num">B</span>Ta régularité</div>
    ${htmlAnalyse()}
    <div class="sous-titre"><span class="num">C</span>Les lois du temps</div>
    <div class="lois">${LOIS.map(([n], i) => `<button type="button" class="loi-carte" style="--i:${i}" data-loi="${i}" aria-label="Loi de ${n}"><span class="loi-num">${String(i + 1).padStart(2, '0')}</span><b>${n}</b></button>`).join('')}</div>
    <button class="voir-plus" type="button" data-act="ouvrir-journal">Journal →</button>`;
}

// ---------- Fiche animée d'une loi : la carte s'agrandit, une petite animation illustre la loi, puis les détails ----------
// Auteur et contexte (tirés du guide)
const ORIGINES = ['Cyril N. Parkinson · 1955', 'Vilfredo Pareto · fin du XIXᵉ siècle', 'Ivan Illich', 'Sune Carlson · 1951', 'Henri Laborit',
  'Douglas Hofstadter · 1979', 'Loi populaire', 'Paul Fraisse', 'Bluma Zeigarnik · années 1920'];
// Une illustration animée par loi (SVG 240 × 110, animée en CSS)
const ILLUSTRATIONS = [
  // Parkinson : la tâche s'étire jusqu'à remplir tout le temps donné
  `<rect class="a-cadre" x="10" y="38" width="220" height="34" rx="8"/><rect class="a-plein a-parkinson" x="10" y="38" width="220" height="34" rx="8"/>
   <text x="10" y="28">temps donné</text><text class="a-fin" x="230" y="96" text-anchor="end">la tâche le remplit</text>`,
  // Pareto : 20 % des actions → 80 % des résultats
  `<rect class="a-plein a-pareto1" x="10" y="22" width="44" height="26" rx="6"/><text x="62" y="40">20 % des actions</text>
   <rect class="a-plein a-pareto2" x="10" y="62" width="176" height="26" rx="6"/><text class="a-blanc" x="20" y="80">80 % des résultats</text>`,
  // Illich : le rendement monte, plafonne, puis baisse
  `<path class="a-axe" d="M14 96H232M14 96V14"/><path class="a-trait a-illich" d="M14 92C60 30 92 22 120 24S180 50 226 90" pathLength="1"/>
   <line class="a-seuil" x1="120" y1="14" x2="120" y2="96"/><text x="124" y="18">seuil</text>`,
  // Carlson : un bloc continu contre des morceaux interrompus
  `<rect class="a-plein a-carlson1" x="10" y="24" width="150" height="24" rx="6"/><text x="168" y="41">continu</text>
   <g class="a-carlson2"><rect x="10" y="64" width="32" height="24" rx="6"/><rect x="50" y="64" width="32" height="24" rx="6"/><rect x="90" y="64" width="32" height="24" rx="6"/><rect x="130" y="64" width="32" height="24" rx="6"/><rect x="170" y="64" width="32" height="24" rx="6"/></g>
   <text class="a-fin" x="230" y="104" text-anchor="end">interrompu : plus long</text>`,
  // Laborit : la tâche facile passe devant la difficile
  `<g class="a-laborit-dur"><rect x="10" y="22" width="150" height="28" rx="8"/><text class="a-blanc" x="22" y="41">Difficile · important</text></g>
   <g class="a-laborit-facile"><rect x="10" y="62" width="110" height="28" rx="8"/><text x="22" y="81">Facile · agréable</text></g>`,
  // Hofstadter : la durée réelle dépasse l'estimation
  `<text x="10" y="30">prévu</text><rect class="a-plein" x="60" y="18" width="110" height="18" rx="5"/>
   <text x="10" y="74">réel</text><rect class="a-plein a-hofstadter" x="60" y="62" width="168" height="18" rx="5"/>`,
  // Murphy : le plan bien droit… et l'imprévu
  `<path class="a-axe" d="M10 70H230"/><path class="a-trait a-murphy" d="M10 70H100L112 40L124 96L136 70H230" pathLength="1"/>
   <circle class="a-alerte" cx="118" cy="40" r="7"/>`,
  // Fraisse : deux horloges, deux vitesses
  `<g transform="translate(62 56)"><circle class="a-cadre" r="32"/><line class="a-aiguille a-lente" x1="0" y1="0" x2="0" y2="-24"/></g>
   <g transform="translate(178 56)"><circle class="a-cadre" r="32"/><line class="a-aiguille a-rapide" x1="0" y1="0" x2="0" y2="-24"/></g>
   <text x="62" y="106" text-anchor="middle">ennui</text><text x="178" y="106" text-anchor="middle">plaisir</text>`,
  // Zeigarnik : l'inachevé « tourne », le noté s'apaise
  `<g transform="translate(62 54)"><circle class="a-trait a-zeigarnik" r="28" pathLength="1"/></g>
   <g transform="translate(178 54)"><circle class="a-plein" r="28"/><path class="a-coche" d="M-12 0l8 8 16-17"/></g>
   <text x="62" y="104" text-anchor="middle">en tête</text><text x="178" y="104" text-anchor="middle">noté</text>`
];

let loiOuverte = -1;
function htmlLoi(i){
  const [nom, dit, fais] = LOIS[i];
  return `<div class="loi-num-grand">${String(i + 1).padStart(2, '0')} / 09</div>
    <h2 class="loi-nom">${nom}</h2>
    <div class="loi-origine">${ORIGINES[i]}</div>
    <svg class="loi-illu" viewBox="0 0 240 110" aria-hidden="true">${ILLUSTRATIONS[i]}</svg>
    <div class="loi-bloc b1"><span class="loi-etiquette">Ce qu'elle dit</span><p>${dit}</p></div>
    <div class="loi-bloc b2"><span class="loi-etiquette">Ce que tu fais</span><p>${fais}</p></div>
    <div class="loi-points">${LOIS.map((_, k) => `<i class="${k === i ? 'actif' : ''}"></i>`).join('')}</div>`;
}
function ouvrirLoi(i, source){
  const o = $('overlayLoi'), panneau = $('loiPanneau');
  loiOuverte = i;
  $('loiContenu').innerHTML = htmlLoi(i);
  // La fiche grandit depuis la carte touchée
  if(source){
    const r = source.getBoundingClientRect();
    panneau.style.setProperty('--ox', `${r.left + r.width / 2}px`);
    panneau.style.setProperty('--oy', `${r.top + r.height / 2}px`);
  }
  o.classList.remove('ferme'); o.classList.add('actif');
  vibrer(6);
}
function fermerLoi(){
  const o = $('overlayLoi');
  if(!o.classList.contains('actif')) return;
  o.classList.add('ferme');
  setTimeout(() => { o.classList.remove('actif', 'ferme'); loiOuverte = -1; }, 260);
}
function changerLoi(sens){
  if(loiOuverte < 0) return;
  const i = (loiOuverte + sens + LOIS.length) % LOIS.length;
  const c = $('loiContenu');
  c.classList.remove('vers-g', 'vers-d'); void c.offsetWidth;
  c.classList.add(sens > 0 ? 'vers-g' : 'vers-d');
  loiOuverte = i;
  c.innerHTML = htmlLoi(i);
  vibrer(4);
}

(function(){
  // Fenêtre créée une fois, à la fin de la page
  const o = document.createElement('div');
  o.className = 'overlay-loi'; o.id = 'overlayLoi';
  o.innerHTML = `<div class="loi-panneau" id="loiPanneau" role="dialog" aria-modal="true">
      <button class="btn-icone loi-fermer" type="button" data-loiact="fermer" aria-label="Fermer">✕</button>
      <div class="loi-contenu" id="loiContenu"></div>
      <div class="loi-nav">
        <button class="btn-icone" type="button" data-loiact="prec" aria-label="Loi précédente">‹</button>
        <button class="btn-icone" type="button" data-loiact="suiv" aria-label="Loi suivante">›</button>
      </div>
    </div>`;
  document.body.appendChild(o);

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-loi]');
    if(c){ ouvrirLoi(Number(c.dataset.loi), c); return; }
    const a = e.target.closest('[data-loiact]');
    if(a){ const v = a.dataset.loiact; v === 'fermer' ? fermerLoi() : changerLoi(v === 'suiv' ? 1 : -1); return; }
    if(e.target === o) fermerLoi();
  });
  document.addEventListener('keydown', e => {
    if(loiOuverte < 0) return;
    if(e.key === 'Escape') fermerLoi();
    else if(e.key === 'ArrowRight') changerLoi(1);
    else if(e.key === 'ArrowLeft') changerLoi(-1);
  });
  // Glisser à gauche / à droite pour changer de loi, vers le bas pour fermer
  let x0 = null, y0 = null;
  o.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive:true });
  o.addEventListener('touchend', e => {
    if(x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) changerLoi(dx < 0 ? 1 : -1);
    else if(dy > 90 && Math.abs(dy) > Math.abs(dx)) fermerLoi();
    x0 = y0 = null;
  });
})();
