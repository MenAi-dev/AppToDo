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
  if(RE_VAGUE.test(titre)) return 'Mot vague : commence par un verbe d\'action précis (appeler, écrire, envoyer, payer…) et un résultat visible.';
  if(titre.trim().split(/\s+/).length < 2) return 'Une bonne tâche = un verbe + un objet + un résultat. Ex. « Appeler M. Konan pour confirmer jeudi ».';
  return '';
}

// ---------- Version minimale (partie 12.4) : les jours difficiles, 1 à 3 actions seulement ----------
const versionMinimale = () => localStorage.getItem('todoMinimal') === auj();
function basculerMinimale(){
  try{ if(versionMinimale()) localStorage.removeItem('todoMinimal'); else localStorage.setItem('todoMinimal', auj()); }catch(_){}
  rendre();
  toast(versionMinimale() ? 'Version minimale : 1 à 3 actions, et la journée est réussie' : 'Retour au plan complet');
}

// ---------- Une ligne de tâche ----------
function htmlLigne(t, action, focus){
  const sous = t.sous || [], nFaites = sous.filter(s => s.fait).length;
  const meta = [
    `<b class="prio prio-${t.priorite}" title="${LIB_PRIO[t.priorite]}">${t.priorite}</b>`,
    t.duree ? `<span>${dureeTexte(t.duree)}${t.reel ? ` · réel ${dureeTexte(t.reel)}` : ''}</span>` : '<span class="sans-duree">sans durée</span>',
    t.heure ? `<span>${t.heure.replace(':', ' h ')}</span>` : '',
    t.liste !== 'jour' && t.date ? `<span>${echapper(libelleDate(t.date))}</span>` : '',
    t.delegue ? `<span>suivi : ${echapper(t.delegue)}</span>` : '',
    t.repeter ? `<span title="${LIBELLES_REPET[t.repeter]}">↻</span>` : '',
    sous.length ? `<span>${nFaites}/${sous.length} étapes</span>` : '',
    t.reports >= 3 && !t.fait ? `<span class="report3">reportée ${t.reports}×</span>` : (t.reports && !t.fait ? `<span>reportée ${t.reports}×</span>` : '')
  ].filter(Boolean).join('<i class="sep"></i>');
  const bouton = action ? `<button class="pill-action" type="button" data-act="${action.act}">${action.label}</button>` : '';
  const btnFocus = focus && !t.fait ? `<button class="btn-focus" type="button" data-act="focus" aria-label="Mode Focus sur cette tâche">${SVG_PLAY}</button>` : '';
  return `<div class="tache ligne${t.fait ? ' fait' : ''}" data-id="${t.id}" data-d="${t.fait ? '↩ Rouvrir' : '✓ Terminer'}" data-g="Supprimer ✕">
    <button class="coche" type="button" data-act="toggle" aria-label="${t.fait ? 'Marquer comme à faire' : 'Marquer comme faite'}">${SVG_COCHE}</button>
    <div class="tache-corps" data-act="edit"><div class="tache-titre">${echapper(t.titre)}</div><div class="tache-meta">${meta}</div></div>
    ${btnFocus}${bouton}
  </div>`;
}

// ---------- Figures réutilisables : 1-3-5 et jauge 60/40 (aujourd'hui ou demain) ----------
function htmlFigure135(p){
  const { plan, horsPlan, cible } = p;
  const lignes = TAILLES.map((tl, k) => {
    const pl = plan[tl], cases = [];
    pl.faites.forEach(() => cases.push('<i class="c fait"></i>'));
    pl.afaire.forEach(() => cases.push('<i class="c prevu"></i>'));
    while(cases.length < PLACES[tl]) cases.push(`<button class="c libre" type="button" data-act="ajouter" data-taille="${tl}" data-date="${cible}" aria-label="Ajouter une tâche ${tl}"></button>`);
    const trop = horsPlan.filter(t => t.taille === tl).length;
    return `<div class="f135-ligne" style="--i:${k}"><span class="f135-n">${PLACES[tl]}</span>
      <span class="f135-lbl"><b>${LIB_TAILLE[tl].toLowerCase()}</b><small>${AIDE_TAILLE[tl]}</small></span>
      <span class="f135-cases">${cases.join('')}${trop ? `<em class="trop">+${trop}</em>` : ''}</span></div>`;
  }).join('');
  const nDansPlan = TAILLES.reduce((s, tl) => s + plan[tl].faites.length + plan[tl].afaire.length, 0);
  const nFaites = TAILLES.reduce((s, tl) => s + plan[tl].faites.length, 0);
  return `<section class="carte f135" aria-label="Règle 1-3-5">
      <div class="carte-tete"><div class="micro">Règle 1-3-5</div><div class="compte"><b>${nFaites}</b>/${nDansPlan || 0} faites</div></div>
      ${lignes}
      ${horsPlan.length ? `<div class="loi">Au plus 9 tâches : ${horsPlan.length} hors plan. Si une tâche arrive, une autre sort.</div>` : ''}
    </section>`;
}
function htmlJauge(p){
  const { jour } = p;
  const { dispo, capacite } = capaciteJour();
  const prevu = jour.reduce((s, t) => s + dureePlanifiee(t), 0);
  const fait = jour.filter(t => t.fait).reduce((s, t) => s + dureePlanifiee(t), 0);
  const sansDuree = jour.filter(t => !t.fait && !t.duree).length;
  const depasse = prevu > capacite, presque = !depasse && prevu > capacite * 0.9;
  const pc = v => Math.min(100, v / dispo * 100).toFixed(1);
  const message = depasse ? `La liste dépasse 60 % de la journée de ${dureeTexte(prevu - capacite)}. Retire ou renvoie des tâches maintenant, pas à 17 h.`
    : sansDuree ? `Parkinson : ${sansDuree} tâche${sansDuree > 1 ? 's' : ''} sans durée. Donne-leur une limite pour savoir si la journée tient.`
    : presque ? 'Murphy : la journée est presque pleine. Garde un bloc tampon pour les imprévus.'
    : `Il reste ${dureeTexte(capacite - prevu)} planifiables. Les 40 % restants absorbent les imprévus.`;
  return `<section class="carte jauge${depasse ? ' depasse' : ''}" aria-label="Règle 60/40">
      <div class="carte-tete"><div class="micro">Règle 60/40</div><div class="compte"><b>${dureeTexte(prevu)}</b> / ${dureeTexte(capacite)}</div></div>
      <div class="jauge-horaires">${reglagesTheme.debut.replace(':', ' h ')} – ${reglagesTheme.fin.replace(':', ' h ')} · 60 % planifiables</div>
      <div class="jauge-piste">
        <div class="jauge-prevu" style="width:${pc(prevu)}%"></div>
        <div class="jauge-fait" style="width:${pc(fait)}%"></div>
        <div class="jauge-seuil" style="left:60%"><span>60 %</span></div>
      </div>
      <div class="jauge-leg"><span><i class="l-fait"></i>fait</span><span><i class="l-prevu"></i>prévu (marge ${reglagesTheme.marge} % incluse)</span><span><i class="l-libre"></i>imprévus</span></div>
      <div class="loi${depasse ? ' alerte' : ''}">${message}</div>
    </section>`;
}

// ---------- Écran « Aujourd'hui » ----------
function htmlJourHaut(){
  const p = planDuJour();
  const { plan } = p;
  const g = plan.grande.faites[0] || plan.grande.afaire[0];
  const h = new Date().getHours(), min = new Date().getHours() * 60 + new Date().getMinutes();
  let bandeaux = '';
  // Rituel du soir : à partir de la fin de journée, s'il n'est pas fait
  if(min >= minutes(reglagesTheme.fin) - 30 && localStorage.getItem('todoRituel') !== auj()){
    bandeaux += `<button class="bandeau" type="button" data-act="rituel"><span class="micro"><i class="carre"></i>Rituel du soir · 10 min</span><b>Prépare demain maintenant : la première tâche sera déjà choisie.</b><span class="fleche">→</span></button>`;
  }
  // Revue de la semaine : le dimanche
  if(new Date().getDay() === 0 && !revueFaite()){
    bandeaux += `<button class="bandeau" type="button" data-act="revue"><span class="micro"><i class="carre"></i>Revue de la semaine · 30 min</span><b>Fixe 3 à 5 résultats pour la semaine qui vient.</b><span class="fleche">→</span></button>`;
  }
  const theme = themeDuJour();

  let grenouille;
  if(g){
    const meta = [`Priorité ${g.priorite}`, g.duree ? dureeTexte(g.duree) : 'sans durée', g.heure ? g.heure.replace(':', ' h ') : '', g.reel ? `réel ${dureeTexte(g.reel)}` : ''].filter(Boolean).join(' · ');
    const conseil = !g.fait && h >= 12 ? '<div class="loi">Point de midi : la grenouille passe en premier après la pause.</div>'
      : (!g.fait && g.reports >= 3 ? '<div class="loi">Reportée 3 fois : trop grosse ? Découpe-la en étapes.</div>' : '');
    grenouille = `<section class="grenouille tache${g.fait ? ' fait' : ''}" data-id="${g.id}">
      <div class="micro"><i class="carre"></i>${g.fait ? 'Grenouille mangée' : 'La grenouille · à faire en premier'}</div>
      <div class="g-ligne">
        <button class="coche g-coche" type="button" data-act="toggle" aria-label="${g.fait ? 'Rouvrir' : 'Terminer la grenouille'}">${SVG_COCHE}</button>
        <div class="tache-corps" data-act="edit"><div class="g-titre">${echapper(g.titre)}</div><div class="g-meta">${meta}</div></div>
      </div>${conseil}
      ${g.fait ? '' : `<button class="g-focus" type="button" data-act="focus">${SVG_PLAY}<span>Commencer · Focus</span></button>`}
    </section>`;
  } else {
    grenouille = `<button class="grenouille vide-g" type="button" data-act="ajouter" data-taille="grande">
      <div class="micro"><i class="carre"></i>La grenouille</div>
      <div class="g-titre">Choisis ta grande tâche</div>
      <div class="g-meta">La plus importante — souvent la plus désagréable. Fais-la en premier, et la journée est gagnée.</div>
    </button>`;
  }
  const minimale = versionMinimale();
  return `${bandeaux}
    ${theme ? `<div class="theme-jour"><span class="micro">Thème du jour</span><b>${echapper(theme)}</b></div>` : ''}
    ${grenouille}
    ${minimale ? '' : htmlFigure135(p) + htmlJauge(p)}
    <button class="lien-minimal${minimale ? ' actif' : ''}" type="button" data-act="minimal">${minimale ? '← Revenir au plan complet' : 'Journée difficile ? Passer en version minimale'}</button>`;
}

function htmlJourListe(){
  const { plan, horsPlan, jour } = planDuJour();
  if(!jour.length){
    return `<div class="vide"><b>Ta journée est vide</b>Commence par ta grenouille, puis 3 tâches moyennes et 5 petites. Rien de plus.</div>`;
  }
  const section = (titre, liste, action, cls, focus) => liste.length ? `<section class="groupe ${cls || ''}"><div class="groupe-titre"><span>${titre}</span><span class="groupe-nb">${liste.length}</span></div>
    <div class="groupe-liste">${liste.map(t => htmlLigne(t, action, focus)).join('')}</div></section>` : '';
  const faitesAuj = jour.filter(t => t.fait && t.taille !== 'grande');
  if(versionMinimale()){
    // Les 1 à 3 actions qui rendent la journée réussie malgré tout : priorité A d'abord
    const restantes = [...plan.moyenne.afaire, ...plan.petite.afaire, ...horsPlan].sort((a, b) => ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]);
    const essentiel = restantes.slice(0, plan.grande.afaire.length ? 2 : 3);
    return `<p class="chapo">Version minimale : seulement l'essentiel. Le reste attend demain sans culpabilité.</p>`
      + section('L\'essentiel', essentiel, null, '', true)
      + (restantes.length > essentiel.length ? `<p class="aide">${restantes.length - essentiel.length} autre${restantes.length - essentiel.length > 1 ? 's' : ''} tâche${restantes.length - essentiel.length > 1 ? 's' : ''} en attente.</p>` : '')
      + section('Fait aujourd\'hui', faitesAuj, null, 'faites-auj');
  }
  return section('Tâches moyennes', plan.moyenne.afaire, null, '', true)
    + section('Petites tâches', plan.petite.afaire, null, '', true)
    + section('Hors plan · le 1-3-5 est plein', horsPlan, { act:'vers-semaine', label:'Semaine' }, 'hors-plan')
    + section('Fait aujourd\'hui', faitesAuj, null, 'faites-auj');
}

// ---------- Liste « Semaine » (dans Planifier) : à venir et « plus tard » ----------
function htmlSemaine(){
  const actives = taches.filter(t => !t.archive && !t.fait);
  const semaine = actives.filter(t => t.liste === 'semaine').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]));
  const plusTard = actives.filter(t => t.liste === 'plustard').sort((a, b) => (ORDRE_PRIO[a.priorite] - ORDRE_PRIO[b.priorite]) || (a.creeLe - b.creeLe));
  const versJour = { act:'vers-jour', label:'Aujourd\'hui' };
  if(!semaine.length && !plusTard.length) return '<div class="vide"><b>Rien à venir</b>Les tâches datées des prochains jours, et celles « un jour, peut-être », apparaîtront ici.</div>';
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
