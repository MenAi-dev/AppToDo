// La méthode de « L'art de planifier sa journée », appliquée :
//  - Liste du jour 1-3-5 : 1 grande tâche (la grenouille), 3 moyennes, 5 petites. Au-delà : « hors plan ».
//  - Durées : chaque tâche a une estimation ; on planifie avec une marge (loi de Hofstadter).
//  - Règle 60/40 : on ne planifie pas plus de 60 % de la journée de travail.
//  - Listes : capture, jour, semaine, plus tard. Les tâches avancent seules le jour venu ; une tâche du jour non faite
//    est reportée au lendemain et son compteur de reports augmente (au 3e report, on se pose la question).

const PLACES = { grande:1, moyenne:3, petite:5 };
const LIB_TAILLE = { grande:'Grande tâche', moyenne:'Tâches moyennes', petite:'Petites tâches' };
const AIDE_TAILLE = { grande:'1 h 30 à 3 h', moyenne:'30 à 60 min', petite:'5 à 15 min' };
const LIB_PRIO = { A:'Grave si non faite', B:'Conséquences légères', C:'Si le temps le permet' };
const ORDRE_PRIO = { A:0, B:1, C:2 };
const SVG_PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';

const minutes = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const heureTexte = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`;
function dureeTexte(min){
  if(!min) return '0 min';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`) : `${m} min`;
}
// Durée planifiée = estimation + marge, arrondie aux 5 minutes supérieures
const dureePlanifiee = t => t.duree ? Math.ceil(t.duree * (1 + reglagesTheme.marge / 100) / 5) * 5 : 0;
function capaciteJour(){
  const dispo = Math.max(60, minutes(reglagesTheme.fin) - minutes(reglagesTheme.debut));
  return { dispo, capacite: Math.round(dispo * 0.6) };
}
const faiteLe = (t, jour) => t.fait && t.faitLe && versISO(new Date(t.faitLe)) === jour;
const faiteAujourdhui = t => faiteLe(t, auj());
const lireJSON = (cle, defaut) => { try{ const v = JSON.parse(localStorage.getItem(cle)); return v == null ? defaut : v; }catch(_){ return defaut; } };
const ecrireJSON = (cle, v) => { try{ localStorage.setItem(cle, JSON.stringify(v)); }catch(_){} };

// ---------- Les tâches avancent toutes seules ----------
// Au changement de jour, on garde d'abord une trace de la veille (pour le Bilan), puis :
// semaine → jour le jour venu ; jour non fait → reporté à aujourd'hui (+1 report) ; « plus tard » daté → semaine.
function avancerListes(){
  const a = auj(), semaineFin = ajouterJours(a, 7);
  const dernier = localStorage.getItem('todoDernierJour');
  if(dernier && dernier < a) enregistrerJour(dernier); // voir bilan.js
  if(dernier !== a){ try{ localStorage.setItem('todoDernierJour', a); }catch(_){} }
  let change = false;
  taches.forEach(t => {
    if(t.fait || t.archive) return;
    if(t.liste === 'jour'){
      if(!t.date){ t.date = a; change = true; }
      else if(t.date < a){ t.date = a; t.reports = (t.reports || 0) + 1; noter('report', t.titre, 'au lendemain'); change = true; }
    } else if(t.liste === 'semaine' && t.date && t.date <= a){ t.liste = 'jour'; t.date = a; change = true; }
    else if(t.liste === 'plustard' && t.date && t.date <= semaineFin){ t.liste = t.date <= a ? 'jour' : 'semaine'; if(t.date < a) t.date = a; change = true; }
  });
  return change;
}

// ---------- Le plan d'un jour (aujourd'hui ou demain) réparti dans les places 1-3-5 ----------
function dansLeJour(t, cible){
  if(t.archive || !(t.liste === 'jour' || t.liste === 'semaine')) return false;
  if(t.fait) return faiteLe(t, cible) && (t.date === cible || t.liste === 'jour');
  return t.date === cible;
}
function planDuJour(cible){
  cible = cible || auj();
  const jour = taches.filter(t => dansLeJour(t, cible));
  const ordre = (a, b) => (ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]) || ((a.heure || '99') < (b.heure || '99') ? -1 : (a.heure || '99') > (b.heure || '99') ? 1 : 0) || (a.creeLe - b.creeLe);
  const plan = {}, horsPlan = [];
  TAILLES.forEach(tl => {
    const faites = jour.filter(t => t.taille === tl && t.fait).sort((a, b) => a.faitLe - b.faitLe);
    const afaire = jour.filter(t => t.taille === tl && !t.fait).sort(ordre);
    const libres = Math.max(0, PLACES[tl] - faites.length);
    plan[tl] = { faites, afaire:afaire.slice(0, libres) };
    horsPlan.push(...afaire.slice(libres));
  });
  const dansPlan = TAILLES.flatMap(tl => [...plan[tl].faites, ...plan[tl].afaire]);
  return { jour, plan, horsPlan, dansPlan, cible };
}
function premiereTailleLibre(cible){
  const { plan } = planDuJour(cible);
  return TAILLES.find(tl => plan[tl].faites.length + plan[tl].afaire.length < PLACES[tl]) || 'petite';
}
function placesRestantes(taille, sauf, cible){
  const n = taches.filter(t => dansLeJour(t, cible || auj()) && t.taille === taille && t.id !== sauf).length;
  return PLACES[taille] - n;
}

// Mots vagues (partie 7.3 du guide) : la tâche ne dit pas quoi faire concrètement
const RE_VAGUE = /(^|\s)(g[ée]rer|s'occuper|s’occuper|voir pour|penser [àa]|regarder pour|truc)(\s|$)/i;
function conseilTitre(titre){
  if(!titre.trim()) return '';
  if(RE_VAGUE.test(titre)) return 'Mot vague : commence par un verbe d\'action (appeler, écrire, envoyer…).';
  if(titre.trim().split(/\s+/).length < 2) return '';
  return '';
}

// ---------- Version minimale (partie 12.4) : les jours difficiles, 1 à 3 actions seulement ----------
const versionMinimale = () => localStorage.getItem('todoMinimal') === auj();
function basculerMinimale(){
  try{ if(versionMinimale()) localStorage.removeItem('todoMinimal'); else localStorage.setItem('todoMinimal', auj()); }catch(_){}
  rendre();
  toast(versionMinimale() ? 'Mode minimal : l\'essentiel seulement' : 'Plan complet');
}

// ---------- Icônes (traits fins, façon SF Symbols) : remplacent le texte dans l'interface ----------
const ICONES = {
  horloge:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cloche:'<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  repet:'<path d="M17 2.5l3 3-3 3"/><path d="M4 11V9.5a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/>',
  etapes:'<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
  report:'<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4.5h4.5"/>',
  calendrier:'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  personne:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  lune:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  etiquette:'<path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  plume:'<path d="M20 4c-8 0-14 6-14 14v2"/><path d="M20 4c0 8-6 12-12 12"/>',
  alerte:'<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>'
};
const ic = (nom, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nom]}</svg>`;

// ---------- Une ligne de tâche : le titre, puis des icônes (pas de phrases) ----------
function htmlLigne(t, action, focus){
  const sous = t.sous || [], nFaites = sous.filter(s => s.fait).length;
  const meta = [
    `<b class="prio prio-${t.priorite}" title="${LIB_PRIO[t.priorite]}">${t.priorite}</b>`,
    t.duree ? `<span title="Durée estimée${t.reel ? ' · réel ' + dureeTexte(t.reel) : ''}">${ic('horloge')}${dureeTexte(t.duree)}</span>` : '',
    t.heure ? `<span title="Heure prévue">${ic('cloche')}${t.heure.replace(':', ' h ')}</span>` : '',
    t.liste !== 'jour' && t.date ? `<span>${ic('calendrier')}${echapper(libelleDate(t.date))}</span>` : '',
    t.delegue ? `<span title="Confiée à ${echapper(t.delegue)}">${ic('personne')}${echapper(t.delegue)}</span>` : '',
    t.repeter ? `<span title="${LIBELLES_REPET[t.repeter]}">${ic('repet')}</span>` : '',
    sous.length ? `<span title="Étapes">${ic('etapes')}${nFaites}/${sous.length}</span>` : '',
    t.reports && !t.fait ? `<span class="${t.reports >= 3 ? 'report3' : ''}" title="Reportée ${t.reports} fois">${ic('report')}${t.reports}</span>` : ''
  ].filter(Boolean).join('');
  const bouton = action ? `<button class="pill-action" type="button" data-act="${action.act}">${action.label}</button>` : '';
  const btnFocus = focus && !t.fait ? `<button class="btn-focus" type="button" data-act="focus" aria-label="Mode Focus sur cette tâche">${SVG_PLAY}</button>` : '';
  return `<div class="tache ligne${t.fait ? ' fait' : ''}" data-id="${t.id}" data-d="${t.fait ? '↩ Rouvrir' : '✓ Terminer'}" data-g="Supprimer ✕">
    <button class="coche" type="button" data-act="toggle" aria-label="${t.fait ? 'Marquer comme à faire' : 'Marquer comme faite'}">${SVG_COCHE}</button>
    <div class="tache-corps" data-act="edit"><div class="tache-titre">${echapper(t.titre)}</div><div class="tache-meta">${meta}</div></div>
    ${btnFocus}${bouton}
  </div>`;
}

// ---------- Figures réutilisables : 1-3-5 et charge de la journée (aujourd'hui ou demain) ----------
function htmlFigure135(p, sansCarte){
  const { plan, horsPlan, cible } = p;
  const lignes = TAILLES.map((tl, k) => {
    const pl = plan[tl], cases = [];
    pl.faites.forEach(() => cases.push('<i class="c fait"></i>'));
    pl.afaire.forEach(() => cases.push('<i class="c prevu"></i>'));
    while(cases.length < PLACES[tl]) cases.push(`<button class="c libre" type="button" data-act="ajouter" data-taille="${tl}" data-date="${cible}" aria-label="Ajouter une tâche ${tl}"></button>`);
    const trop = horsPlan.filter(t => t.taille === tl).length;
    return `<div class="f135-ligne" style="--i:${k}" title="${LIB_TAILLE[tl]} · ${AIDE_TAILLE[tl]}"><span class="f135-n">${PLACES[tl]}</span>
      <span class="f135-cases">${cases.join('')}</span>${trop ? `<em class="trop">+${trop}</em>` : ''}</div>`;
  }).join('');
  const nDansPlan = TAILLES.reduce((s, tl) => s + plan[tl].faites.length + plan[tl].afaire.length, 0);
  const nFaites = TAILLES.reduce((s, tl) => s + plan[tl].faites.length, 0);
  const corps = `<div class="carte-tete"><div class="micro">1 · 3 · 5</div><div class="compte"><b>${nFaites}</b>/${nDansPlan || 0}</div></div>${lignes}`;
  return sansCarte ? corps : `<section class="carte f135" aria-label="Règle 1-3-5">${corps}</section>`;
}
function htmlJauge(p, sansCarte){
  const { jour } = p;
  const { dispo, capacite } = capaciteJour();
  const prevu = jour.reduce((s, t) => s + dureePlanifiee(t), 0);
  const fait = jour.filter(t => t.fait).reduce((s, t) => s + dureePlanifiee(t), 0);
  const sansDuree = jour.filter(t => !t.fait && !t.duree).length;
  const depasse = prevu > capacite;
  const pc = v => Math.min(100, v / dispo * 100).toFixed(1);
  // Une seule information, et seulement si elle demande une action
  const alerte = depasse ? `<div class="jauge-note alerte">${ic('alerte')}Trop chargé de ${dureeTexte(prevu - capacite)}</div>`
    : sansDuree ? `<div class="jauge-note">${ic('horloge')}${sansDuree} sans durée</div>` : '';
  const corps = `<div class="carte-tete"><div class="micro">Charge · 60 %</div><div class="compte"><b>${dureeTexte(prevu)}</b> / ${dureeTexte(capacite)}</div></div>
      <div class="jauge-piste" title="Fait · prévu (marge ${reglagesTheme.marge} % incluse) · ligne = 60 % de la journée">
        <div class="jauge-prevu" style="width:${pc(prevu)}%"></div>
        <div class="jauge-fait" style="width:${pc(fait)}%"></div>
        <div class="jauge-seuil" style="left:60%"></div>
      </div>${alerte}`;
  return sansCarte ? corps : `<section class="carte jauge${depasse ? ' depasse' : ''}" aria-label="Charge de la journée">${corps}</section>`;
}

// ---------- Écran « Aujourd'hui » ----------
function htmlJourHaut(){
  const p = planDuJour();
  const { plan } = p;
  const g = plan.grande.faites[0] || plan.grande.afaire[0];
  const h = new Date().getHours(), min = h * 60 + new Date().getMinutes();
  let bandeaux = '';
  if(min >= minutes(reglagesTheme.fin) - 30 && localStorage.getItem('todoRituel') !== auj()){
    bandeaux += `<button class="bandeau" type="button" data-act="rituel">${ic('lune')}<b>Préparer demain</b><span class="fleche">${ic('chevron')}</span></button>`;
  }
  if(new Date().getDay() === 0 && !revueFaite()){
    bandeaux += `<button class="bandeau" type="button" data-act="revue">${ic('calendrier')}<b>Revue de la semaine</b><span class="fleche">${ic('chevron')}</span></button>`;
  }
  const theme = themeDuJour();

  let grenouille;
  if(g){
    const meta = [g.duree ? `<span>${ic('horloge')}${dureeTexte(g.duree)}</span>` : '', g.heure ? `<span>${ic('cloche')}${g.heure.replace(':', ' h ')}</span>` : ''].join('');
    grenouille = `<section class="grenouille tache${g.fait ? ' fait' : ''}" data-id="${g.id}">
      <div class="micro">${g.fait ? 'Grenouille mangée' : 'Grenouille'}</div>
      <div class="g-ligne">
        <button class="coche g-coche" type="button" data-act="toggle" aria-label="${g.fait ? 'Rouvrir' : 'Terminer la grenouille'}">${SVG_COCHE}</button>
        <div class="tache-corps" data-act="edit"><div class="g-titre">${echapper(g.titre)}</div>${meta ? `<div class="g-meta">${meta}</div>` : ''}</div>
      </div>
      ${g.fait ? '' : `<button class="g-focus" type="button" data-act="focus">${SVG_PLAY}<span>Focus</span></button>`}
      ${!g.fait && h >= 12 ? '<span class="g-badge">En premier après la pause</span>' : ''}
    </section>`;
  } else {
    grenouille = `<button class="grenouille vide-g" type="button" data-act="ajouter" data-taille="grande">
      <div class="micro">Grenouille</div>
      <div class="g-titre">Choisis ta grande tâche</div>
    </button>`;
  }
  const minimale = versionMinimale();
  const depasse = p.jour.reduce((s, t) => s + dureePlanifiee(t), 0) > capaciteJour().capacite;
  return `${bandeaux}
    ${theme ? `<div class="theme-jour">${ic('etiquette')}<b>${echapper(theme)}</b></div>` : ''}
    ${grenouille}
    ${minimale ? '' : `<section class="carte journee${depasse ? ' depasse' : ''}">${htmlFigure135(p, true)}<div class="journee-sep"></div>${htmlJauge(p, true)}</section>`}
    <button class="lien-minimal${minimale ? ' actif' : ''}" type="button" data-act="minimal">${ic('plume')}${minimale ? 'Plan complet' : 'Mode minimal'}</button>`;
}

function htmlJourListe(){
  const { plan, horsPlan, jour } = planDuJour();
  if(!jour.length){
    return `<div class="vide"><b>Journée vide</b>1 grande, 3 moyennes, 5 petites.</div>
      <button class="bloc-pres" type="button" data-act="presentation">
        <span class="bloc-pres-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>
        <span class="bloc-pres-txt"><b>Découvrir Tâches</b><small>Présentation animée · 57 s</small></span>
        ${ic('chevron')}
      </button>`;
  }
  const section = (titre, liste, action, cls, focus) => liste.length ? `<section class="groupe ${cls || ''}"><div class="groupe-titre"><span>${titre}</span><span class="groupe-nb">${liste.length}</span></div>
    <div class="groupe-liste">${liste.map(t => htmlLigne(t, action, focus)).join('')}</div></section>` : '';
  const faitesAuj = jour.filter(t => t.fait && t.taille !== 'grande');
  if(versionMinimale()){
    const restantes = [...plan.moyenne.afaire, ...plan.petite.afaire, ...horsPlan].sort((a, b) => ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]);
    const essentiel = restantes.slice(0, plan.grande.afaire.length ? 2 : 3);
    return section('L\'essentiel', essentiel, null, '', true)
      + section('Fait', faitesAuj, null, 'faites-auj');
  }
  return section('Moyennes', plan.moyenne.afaire, null, '', true)
    + section('Petites', plan.petite.afaire, null, '', true)
    + section('Hors plan', horsPlan, { act:'vers-semaine', label:'Semaine' }, 'hors-plan')
    + section('Fait', faitesAuj, null, 'faites-auj');
}

// ---------- Liste « Semaine » (dans Planifier) : à venir et « plus tard » ----------
function htmlSemaine(){
  const actives = taches.filter(t => !t.archive && !t.fait);
  const semaine = actives.filter(t => t.liste === 'semaine').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]));
  const plusTard = actives.filter(t => t.liste === 'plustard').sort((a, b) => (ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]) || (a.creeLe - b.creeLe));
  const versJour = { act:'vers-jour', label:'Aujourd\'hui' };
  if(!semaine.length && !plusTard.length) return '<div class="vide"><b>Rien à venir</b></div>';
  const jours = [...new Set(semaine.filter(t => t.date).map(t => t.date))].sort();
  const bloc = (titre, liste, action, cle) => {
    if(!liste.length) return '';
    const replie = groupeReplie(cle);
    return `<section class="groupe"><div class="groupe-titre"><button class="groupe-toggle" type="button" data-gtoggle="${cle}" aria-expanded="${!replie}"><span class="chevron${replie ? ' ferme' : ''}">▾</span><span>${titre}</span><span class="groupe-nb">${liste.length}</span></button></div>
      ${replie ? '' : `<div class="groupe-liste">${liste.map(t => htmlLigne(t, action)).join('')}</div>`}</section>`;
  };
  let html = '';
  if(semaine.length){
    html += `<div class="sous-titre"><span class="num">A</span>Cette semaine</div>`;
    html += jours.map(j => bloc(titreJour(j), semaine.filter(t => t.date === j), versJour, 'j-' + j)).join('');
    html += bloc('Sans jour fixé', semaine.filter(t => !t.date), versJour, 'sem-sansjour');
  }
  if(plusTard.length){
    html += `<div class="sous-titre"><span class="num">B</span>Plus tard</div>`;
    html += bloc('Un jour, peut-être', plusTard, { act:'vers-semaine', label:'Semaine' }, 'plustard');
  }
  return html;
}

// Déplacer une tâche d'une liste à l'autre (avec « Annuler »)
function deplacer(t, liste){
  const avant = { liste:t.liste, date:t.date };
  t.liste = liste;
  if(liste === 'jour') t.date = auj();
  else if(liste === 'semaine' && (!t.date || t.date <= auj())) t.date = ajouterJours(auj(), 1);
  else if(liste === 'plustard' && t.date && t.date <= ajouterJours(auj(), 7)) t.date = '';
  t.notifie = false; t.vu = false;
  noter(liste === 'jour' ? 'destock' : 'stock', t.titre, liste === 'jour' ? "vers aujourd'hui" : liste === 'semaine' ? 'vers la semaine' : 'vers plus tard');
  sauvegarder(); rendre();
  const lib = { jour:"Ajoutée à aujourd'hui", semaine:`Envoyée à la semaine (${libelleDate(t.date)})`, plustard:'Rangée dans « plus tard »' }[liste];
  toast(lib, '', { label:'Annuler', fn:()=>{ t.liste = avant.liste; t.date = avant.date; sauvegarder(); rendre(); } });
}
