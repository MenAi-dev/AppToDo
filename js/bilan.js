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

  return `<div class="sous-titre"><span class="num">A</span>Les signes que ça marche</div>
    <p class="aide">Sur les 14 derniers jours enregistrés (${histo.length} jour${histo.length > 1 ? 's' : ''}).</p>
    <div class="stats-grille">
      ${tuile('Listes terminées', pc(terminees, histo.length), `${terminees}/${histo.length} jours`)}
      ${tuile('Grenouille avant midi', pc(gMatin, avecG.length), `${gMatin}/${avecG.length} jours`)}
      ${tuile('Journées réalistes', pc(realistes, avecMin), '≤ 60 % planifiés')}
      ${tuile('Estimé → réel', ratio ? `×${ratio.toFixed(1).replace('.', ',')}` : '—', ratio ? (ratio > 1.3 ? 'augmente ta marge' : 'estimations justes') : 'mesure avec Focus')}
    </div>
    ${reportees ? `<div class="loi alerte">${reportees} tâche${reportees > 1 ? 's' : ''} reportée${reportees > 1 ? 's' : ''} 3 fois ou plus : découpe, range « plus tard » ou supprime.</div>` : ''}
    ${barres ? `<section class="carte"><div class="carte-tete"><div class="micro">Estimé · réel (Hofstadter)</div></div><div class="er-leg"><span><i class="est"></i>estimé</span><span><i class="reel"></i>réel</span></div>${barres}</section>` : ''}
    <div class="sous-titre"><span class="num">B</span>Ta régularité</div>
    ${htmlAnalyse()}
    <div class="sous-titre"><span class="num">C</span>Les lois du temps</div>
    <p class="aide">Touche une loi pour voir ce que tu fais.</p>
    <div class="lois">${LOIS.map(([n, dit, fais], i) => `<button type="button" class="loi-carte" style="--i:${i}" data-loi="${i}"><span class="loi-face"><b>${n}</b><small>${dit}</small></span><span class="loi-dos"><b>${n}</b><small>${fais}</small></span></button>`).join('')}</div>
    <button class="voir-plus" type="button" data-act="ouvrir-journal">Ouvrir le journal des actions →</button>`;
}

// Retourner une carte de loi
document.addEventListener('click', e => {
  const c = e.target.closest('[data-loi]');
  if(c){ c.classList.toggle('retournee'); vibrer(4); }
});
