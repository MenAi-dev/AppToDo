// Analyse de la saisie : repère date, importance et répétition dans le texte (français)
const JOURS_SEMAINE = { dimanche:0, lundi:1, mardi:2, mercredi:3, jeudi:4, vendredi:5, samedi:6 };
const MOIS_NOMS = { janvier:1, janv:1, fevrier:2, fevr:2, fev:2, mars:3, avril:4, avr:4, mai:5, juin:6,
  juillet:7, juil:7, aout:8, septembre:9, sept:9, octobre:10, oct:10, novembre:11, nov:11, decembre:12, dec:12 };
const RE_JOUR = Object.keys(JOURS_SEMAINE).join('|');
const RE_MOIS = Object.keys(MOIS_NOMS).sort((a,b)=>b.length-a.length).join('|');

// Minuscules, sans accents, apostrophes droites : MÊME longueur que le texte d'origine
function plierTexte(s){
  return Array.from(s).map(c=>{
    if(c === '\u2019' || c === '\u2018') return "'";
    if(c.length !== 1) return c;
    const b = c.normalize('NFD')[0].toLowerCase();
    return b.length === 1 ? b : c;
  }).join('');
}

function dateDepuisJMA(j, m, a){
  const d = new Date(a, m - 1, j, 12);
  return (d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j) ? versISO(d) : '';
}
// Jour + mois sans année : aujourd'hui ou à venir
function prochaineOccurrenceJM(j, m){
  const t = auj(), a = Number(t.slice(0,4));
  let d = dateDepuisJMA(j, m, a);
  if(d && d < t) d = dateDepuisJMA(j, m, a + 1);
  return d;
}
// Jour de la semaine : toujours strictement dans le futur
function prochainJourSemaine(cible){
  const t = auj(), dow = new Date(t + 'T12:00:00').getDay();
  return ajouterJours(t, ((cible - dow + 7) % 7) || 7);
}
// « le 5 » : prochain 5 du mois (aujourd'hui inclus)
function prochainJourDuMois(j){
  if(j < 1 || j > 31) return '';
  const t = auj();
  let [a, m] = t.split('-').map(Number);
  for(let i = 0; i < 14; i++){
    const d = dateDepuisJMA(j, m, a);
    if(d && d >= t) return d;
    if(++m > 12){ m = 1; a++; }
  }
  return '';
}

function analyserSaisie(texte){
  const orig = String(texte).normalize('NFC');
  let f = plierTexte(orig);
  const rien = { titre:orig.trim(), date:'', heure:'', important:false, repeter:'', cat:'', trouve:false };
  const P = '(^|[\\s,;(])', S = '(?=$|[\\s,;.!?)])';
  const plages = [];
  let date = '', important = false, repeter = '', cat = '', heure = '';

  const finDeTexte = fin => f.slice(fin).replace(/!+/g,'').trim() === '';
  // Cherche un motif ; calc(m) renvoie la date (ou '' pour refuser). Ne garde que la première date trouvée.
  const essayer = (re, calc) => {
    if(date) return;
    const m = new RegExp(P + re + S).exec(f);
    if(!m) return;
    const d = calc(m, m.index + m[0].length);
    if(!d) return;
    date = d;
    plages.push([m.index + m[1].length, m.index + m[0].length]);
  };
  const retirer = re => {
    const m = new RegExp(P + re + S).exec(f);
    if(m) plages.push([m.index + m[1].length, m.index + m[0].length]);
    return m;
  };

  // 0. Catégorie : #travail (le texte masqué ne gêne plus les autres détections)
  const mc = /(^|[\s,;(])#([\p{L}\p{N}_-]{2,24})(?=$|[\s,;.!?)])/u.exec(orig);
  if(mc && /\p{L}/u.test(mc[2])){
    const d = mc.index + mc[1].length, e = mc.index + mc[0].length;
    cat = mc[2];
    plages.push([d, e]);
    f = f.slice(0, d) + ' '.repeat(e - d) + f.slice(e);
  }

  // 1. Répétition
  let m = retirer('(?:tous les|toutes les|chaque)\\s+(jours?|semaines?|mois|(' + RE_JOUR + ')s?)');
  if(m){
    if(m[3]){ repeter = 'semaine'; date = prochainJourSemaine(JOURS_SEMAINE[m[3]]); }
    else repeter = m[2].startsWith('jour') ? 'jour' : m[2].startsWith('semaine') ? 'semaine' : 'mois';
  } else if((m = retirer('(quotidien(?:ne)?|hebdo(?:madaire)?|mensuel(?:le)?)'))){
    repeter = m[2][0] === 'q' ? 'jour' : m[2][0] === 'h' ? 'semaine' : 'mois';
  }

  // 2. Date
  essayer('(apres[- ]?demain)', () => ajouterJours(auj(), 2));
  essayer('(demain)', () => ajouterJours(auj(), 1));
  essayer("(aujourd'?hui|ajd|ce (?:matin|soir|midi))", () => auj());
  essayer('(dans\\s+(\\d{1,3})\\s+(jours?|semaines?|mois))', m => {
    const n = Number(m[3]);
    return m[4].startsWith('jour') ? ajouterJours(auj(), n) : m[4].startsWith('semaine') ? ajouterJours(auj(), 7 * n) : ajouterMois(auj(), n);
  });
  essayer('((?:(?:' + RE_JOUR + ')\\s+)?(le\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?)', (m, fin) => {
    const j = Number(m[4]), mo = Number(m[5]);
    let a = m[6] ? Number(m[6]) : 0;
    if(a && a < 100) a += 2000;
    // « 1/2 litre » n'est pas une date : sans « le », sans année ni jour de la semaine, on exige la fin du texte
    if(!m[3] && !a && !/^\s*(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/.test(m[2]) && !finDeTexte(fin)) return '';
    return a ? dateDepuisJMA(j, mo, a) : prochaineOccurrenceJM(j, mo);
  });
  essayer('((?:(?:' + RE_JOUR + ')\\s+)?(?:le\\s+)?(\\d{1,2}|1er)\\s+(' + RE_MOIS + ')\\.?(?:\\s+(\\d{4}))?)', m => {
    const j = parseInt(m[3], 10), mo = MOIS_NOMS[m[4]];
    return m[5] ? dateDepuisJMA(j, mo, Number(m[5])) : prochaineOccurrenceJM(j, mo);
  });
  essayer('((?:(?:ce|le)\\s+)?(' + RE_JOUR + ')(?:\\s+prochain)?)', m => prochainJourSemaine(JOURS_SEMAINE[m[3]]));
  essayer('(le\\s+(\\d{1,2}))', (m, fin) => (finDeTexte(fin) || repeter === 'mois') ? prochainJourDuMois(Number(m[3])) : '');

  // 2b. Heure : « à 15h », « 15h30 », « 9:05 » (pas « dans 2h »)
  const mh = new RegExp(P + '((?:a\\s+)?(\\d{1,2})(?:h(\\d{2})?|:(\\d{2})))' + S).exec(f);
  if(mh){
    const h = Number(mh[3]), mi = Number(mh[4] || mh[5] || 0), debut = mh.index + mh[1].length;
    if(h <= 23 && mi <= 59 && !/dans\s+$/.test(f.slice(0, debut))){
      heure = pad(h) + ':' + pad(mi);
      plages.push([debut, mh.index + mh[0].length]);
    }
  }

  // 3. Importance : « ! » en fin de texte
  const mi = /!+\s*$/.exec(f);
  if(mi && f.slice(0, mi.index).trim()){ plages.push([mi.index, f.length]); important = true; }

  if(!plages.length) return rien;
  if(heure && !date){ // « à 15h » seul : aujourd'hui si l'heure n'est pas passée, sinon demain
    const n = new Date();
    date = heure > pad(n.getHours()) + ':' + pad(n.getMinutes()) ? auj() : ajouterJours(auj(), 1);
  }
  if(repeter && !date) date = auj();

  // 4. Titre nettoyé
  plages.sort((x, y) => x[0] - y[0]);
  let reste = '', pos = 0;
  plages.forEach(([d, e]) => { if(d >= pos){ reste += orig.slice(pos, d); pos = e; } else if(e > pos){ pos = e; } });
  reste += orig.slice(pos);
  let t = reste.replace(/\s{2,}/g, ' ').replace(/\s+([,;.])/g, '$1').trim().replace(/^[,;.\s]+/, '');
  for(let i = 0; i < 3; i++){
    t = t.replace(/[,;.\s]+$/, '').replace(/\s+(?:pour|avant|le|la|à|au|de|du|ce|d['\u2019]ici|vers|dès)$/i, '');
  }
  if(!t) return rien;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return { titre:t, date, heure, important, repeter, cat, trouve:true };
}
