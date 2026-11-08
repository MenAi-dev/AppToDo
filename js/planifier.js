// LOT 3 · Planifier : le rituel du soir (partie 10), les blocs horaires (partie 9) et la semaine (partie 13).
let sousPlan = 'semaine';   // 'rituel' | 'blocs' | 'semaine'
let etapeRituel = 1;        // 1 à 5
let blocChoisi = null;      // tâche sélectionnée pour être placée dans l'agenda

const demainISO = () => ajouterJours(auj(), 1);
// Lundi de la semaine d'une date (clé de la semaine)
function lundiDe(iso){ const d = new Date(iso + 'T12:00:00'); return ajouterJours(iso, -((d.getDay() + 6) % 7)); }

// ---------- Données de la semaine : objectifs, revue, thèmes de jours ----------
const THEMES_DEFAUT = ['Planification et prospection', 'Création de contenu', 'Rendez-vous et appels', 'Production et livraison', 'Suivi, relances, administratif', 'Apprentissage, projets personnels', 'Repos, famille, revue de la semaine'];
const REVUE = [
  'Vider toutes les listes de capture (carnet, notes, messages à soi-même)',
  'Relire l\'agenda de la semaine passée : qu\'est-ce qui reste à suivre ?',
  'Relire l\'agenda de la semaine à venir : qu\'est-ce qu\'il faut préparer ?',
  'Mettre à jour les projets et leur prochaine action',
  'Relire la liste « plus tard » : quelque chose devient-il prioritaire ?',
  'Noter ce qui a marché et ce qui change'
];
function donneesSemaine(){
  const d = lireJSON('todoSemaine', {});
  return { objectifs:d.objectifs || {}, revue:d.revue || {}, themes:Array.isArray(d.themes) && d.themes.length === 7 ? d.themes : THEMES_DEFAUT.slice(), themesActifs:d.themesActifs === true };
}
const sauverSemaine = d => ecrireJSON('todoSemaine', d);
// Thème du jour (lundi = 0) s'il est activé
function themeDuJour(){
  const d = donneesSemaine();
  return d.themesActifs ? (d.themes[(new Date().getDay() + 6) % 7] || '') : '';
}
function revueFaite(){
  const d = donneesSemaine(), r = d.revue[lundiDe(ajouterJours(auj(), 1))] || []; // le dimanche, on prépare la semaine qui vient
  return r.length === REVUE.length && r.every(Boolean);
}

// ---------- Écran « Planifier » ----------
function htmlPlanifier(){
  const onglets = [['rituel', 'Ce soir'], ['blocs', 'Blocs'], ['semaine', 'Semaine']]
    .map(([k, n]) => `<button type="button" data-sousplan="${k}" aria-pressed="${sousPlan === k}">${n}</button>`).join('');
  const corps = sousPlan === 'rituel' ? htmlRituel() : sousPlan === 'blocs' ? htmlBlocs() : htmlPlanSemaine();
  return `<div class="seg seg-3 seg-plan" role="group" aria-label="Planifier">${onglets}</div><div class="plan-corps">${corps}</div>`;
}

// ---------- Le rituel du soir : 5 étapes, 10 minutes ----------
const ETAPES = [['Relire', 'ce qui est fait'], ['Reporter', 'ce qui reste'], ['Choisir', 'la grande tâche'], ['Écrire', 'la liste 1-3-5'], ['Fermer', 'noter, ranger']];

function htmlRituel(){
  const fait = localStorage.getItem('todoRituel') === auj();
  const progres = ETAPES.map(([n, s], i) => `<button type="button" class="etape${i + 1 === etapeRituel ? ' actif' : ''}${i + 1 < etapeRituel ? ' passee' : ''}" data-etape="${i + 1}"><span class="etape-n">0${i + 1}</span><b>${n}</b><small>${s}</small></button>`).join('');
  const nav = `<div class="rituel-nav">
      ${etapeRituel > 1 ? '<button class="btn-annuler" type="button" data-rituel="prec">Précédent</button>' : '<span></span>'}
      ${etapeRituel < 5 ? '<button class="btn-valider" type="button" data-rituel="suiv">Suivant →</button>' : '<button class="btn-valider" type="button" data-rituel="fin">Terminer le rituel</button>'}
    </div>`;
  return `${fait ? '<div class="loi">Rituel fait ce soir : demain est prêt. Tu peux encore ajuster.</div>' : '<p class="chapo">Le soir, tu choisis selon l\'importance, pas selon l\'envie du moment (loi de Laborit). Le matin commence sans hésitation.</p>'}
    <div class="etapes">${progres}</div>
    <section class="rituel-etape">${[null, rituel1, rituel2, rituel3, rituel4, rituel5][etapeRituel]()}</section>${nav}`;
}

// 1. Relire : constater ce qui est accompli + le bilan en trois questions
function rituel1(){
  const faites = taches.filter(t => faiteAujourdhui(t));
  const b = lireJSON('todoBilans', {})[auj()] || {};
  const q = [['bien', 'Qu\'est-ce qui a bien fonctionné aujourd\'hui ?'], ['perdu', 'Qu\'est-ce qui m\'a fait perdre du temps ?'], ['change', 'Qu\'est-ce que je change demain ?']];
  return `<h2 class="etape-titre"><span class="index">01</span>Relire ce qui est fait</h2>
    <div class="grand-compte"><b>${faites.length}</b><span>tâche${faites.length > 1 ? 's' : ''} terminée${faites.length > 1 ? 's' : ''} aujourd'hui. Prends un instant pour le constater.</span></div>
    ${faites.length ? `<div class="groupe-liste">${faites.slice(0, 9).map(t => htmlLigne(t)).join('')}</div>` : ''}
    <div class="bilan-q">${q.map(([k, l]) => `<label class="champ"><span>${l}</span><textarea rows="2" data-bilan="${k}">${echapper(b[k] || '')}</textarea></label>`).join('')}</div>`;
}

// 2. Reporter : pour chaque tâche non faite, décider de son sort
const sortsReport = {}; // id → 'demain' | 'plustard' | 'suppr'
function rituel2(){
  const restantes = taches.filter(t => !t.archive && !t.fait && t.liste === 'jour');
  if(!restantes.length) return `<h2 class="etape-titre"><span class="index">02</span>Reporter ce qui reste</h2><div class="vide"><b>Rien à reporter</b>Toute la liste du jour est faite. Bravo.</div>`;
  return `<h2 class="etape-titre"><span class="index">02</span>Reporter ce qui reste</h2>
    <p class="aide">Pour chaque tâche : demain, plus tard ou supprimer. Reportée 3 fois ? Elle est sans doute trop grosse ou pas si importante.</p>
    <div class="reports">${restantes.map(t => {
      const s = sortsReport[t.id] || (t.reports >= 2 ? 'plustard' : 'demain');
      sortsReport[t.id] = s;
      return `<div class="report-ligne" data-id="${t.id}"><div class="report-titre">${echapper(t.titre)}${t.reports ? ` <small class="${t.reports >= 2 ? 'report3' : ''}">reportée ${t.reports}×</small>` : ''}</div>
        <div class="seg seg-3 seg-mini">${[['demain', 'Demain'], ['plustard', 'Plus tard'], ['suppr', 'Supprimer']].map(([v, l]) => `<button type="button" data-sort="${v}" aria-pressed="${s === v}">${l}</button>`).join('')}</div></div>`;
    }).join('')}</div>`;
}
function appliquerReports(){
  const demain = demainISO();
  let n = 0;
  Object.entries(sortsReport).forEach(([id, s]) => {
    const i = taches.findIndex(t => t.id === id && !t.fait && t.liste === 'jour');
    if(i < 0) return;
    const t = taches[i]; n++;
    if(s === 'demain'){ t.liste = 'semaine'; t.date = demain; t.reports = (t.reports || 0) + 1; noter('report', t.titre, 'à demain'); }
    else if(s === 'plustard'){ t.liste = 'plustard'; t.date = ''; noter('stock', t.titre, 'vers plus tard'); }
    else { taches.splice(i, 1); noter('suppr', t.titre, 'rituel du soir'); }
    delete sortsReport[id];
  });
  if(n){ sauvegarder(); toast(`${n} tâche${n > 1 ? 's' : ''} décidée${n > 1 ? 's' : ''}`); }
}

// 3. Choisir la grande tâche de demain
function rituel3(){
  const demain = demainISO(), p = planDuJour(demain);
  const actuelle = p.plan.grande.afaire[0];
  const candidats = [...p.jour.filter(t => !t.fait), ...taches.filter(t => !t.archive && !t.fait && t.liste === 'semaine' && !t.date), ...taches.filter(t => !t.archive && !t.fait && t.liste === 'plustard' && t.priorite === 'A')]
    .filter((t, i, a) => a.indexOf(t) === i).slice(0, 12);
  return `<h2 class="etape-titre"><span class="index">03</span>Choisir la grande tâche</h2>
    <blockquote class="citation">Quelle est la seule chose que je peux faire demain qui rendra le reste plus facile ou inutile ?</blockquote>
    ${candidats.length ? `<div class="choix">${candidats.map(t => `<button type="button" class="choix-ligne${actuelle && actuelle.id === t.id ? ' actif' : ''}" data-grenouille="${t.id}">
        <span class="choix-rond"></span><span><b>${echapper(t.titre)}</b><small>${t.liste === 'semaine' && t.date === demain ? 'prévue demain' : t.liste === 'plustard' ? 'plus tard · priorité A' : 'semaine'}${t.duree ? ' · ' + dureeTexte(t.duree) : ''}</small></span></button>`).join('')}</div>` : ''}
    <button class="voir-plus" type="button" data-act="ajouter" data-taille="grande" data-date="${demain}">+ Nouvelle grande tâche pour demain</button>`;
}
function choisirGrenouille(id){
  const demain = demainISO();
  taches.forEach(t => { if(t.id !== id && !t.fait && t.taille === 'grande' && dansLeJour(t, demain)) t.taille = 'moyenne'; });
  const t = taches.find(x => x.id === id);
  if(!t) return;
  t.taille = 'grande'; t.liste = 'semaine'; t.date = demain;
  noter('stock', t.titre, 'grenouille de demain');
  sauvegarder(); rendre(); vibrer(10);
  toast('Grenouille de demain choisie');
}

// 4. Écrire la liste 1-3-5 de demain, avec les durées
function rituel4(){
  const demain = demainISO(), p = planDuJour(demain);
  const lignes = p.jour.filter(t => !t.fait).sort((a, b) => TAILLES.indexOf(a.taille) - TAILLES.indexOf(b.taille));
  return `<h2 class="etape-titre"><span class="index">04</span>Écrire la liste de demain</h2>
    ${htmlFigure135(p)}
    <form class="capture-form" id="formDemain" autocomplete="off">
      <input id="inputDemain" type="text" maxlength="140" placeholder="Ajouter pour demain : verbe + objet + résultat" enterkeyhint="send">
      <button type="submit" class="btn-plus" aria-label="Ajouter">+</button>
    </form>
    ${lignes.length ? `<div class="groupe-liste">${lignes.map(t => htmlLigne(t)).join('')}</div>` : ''}
    ${htmlJauge(p)}`;
}

// 5. Fermer : noter les idées qui traînent, préparer le matin
function rituel5(){
  const coches = lireJSON('todoRituelCoches', {});
  const liste = coches.jour === auj() ? coches.c || [] : [];
  const items = ['Préparer le matériel du matin', 'Ranger son espace de travail', 'Relire la liste de demain avant d\'ouvrir les messages', 'Mettre le téléphone en silencieux pour le premier bloc'];
  return `<h2 class="etape-titre"><span class="index">05</span>Fermer la journée</h2>
    <label class="champ"><span>Idées qui traînent (une par ligne) → elles vont dans la capture</span><textarea id="ideesSoir" rows="3" placeholder="Une idée par ligne…"></textarea></label>
    <div class="checklist">${items.map((x, i) => `<label class="check"><input type="checkbox" data-check="${i}" ${liste[i] ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>`;
}

// ---------- Les blocs horaires de la journée (time blocking) ----------
const PX = 1.15; // pixels par minute
function htmlBlocs(){
  const p = planDuJour(), d0 = minutes(reglagesTheme.debut), d1 = minutes(reglagesTheme.fin), H = (d1 - d0) * PX;
  const aPlacer = p.dansPlan.filter(t => !t.fait && !t.heure);
  const places = p.jour.filter(t => t.heure && minutes(t.heure) < d1 && minutes(t.heure) + (dureePlanifiee(t) || 30) > d0);
  const y = m => (m - d0) * PX;
  // Bandes d'énergie (partie 9.1) : pic du matin, creux après le repas, bilan en fin de journée
  const bandes = [[d0, Math.min(d1, d0 + 120), 'Pic d\'énergie · travail profond', 'pic'], [Math.max(d0, 13 * 60), Math.min(d1, 14 * 60), 'Creux · messages et appels', 'creux'], [d1 - 30, d1, 'Bilan · liste de demain', 'bilan']]
    .filter(b => b[1] > b[0]).map(([a, b, l, c]) => `<div class="bande ${c}" style="top:${y(a)}px;height:${(b - a) * PX}px"><span>${l}</span></div>`).join('');
  let heures = '';
  for(let m = Math.ceil(d0 / 60) * 60; m <= d1; m += 60) heures += `<div class="heure" style="top:${y(m)}px"><span>${m / 60} h</span></div>`;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const blocs = places.map(t => {
    const m = minutes(t.heure), dur = dureePlanifiee(t) || 30;
    return `<div class="bloc${t.taille === 'grande' ? ' grande' : ''}${t.fait ? ' fait' : ''}${blocChoisi === t.id ? ' choisi' : ''}" data-bloc="${t.id}" style="top:${y(m)}px;height:${Math.max(26, dur * PX - 2)}px">
      <b>${echapper(t.titre)}</b><small>${t.heure.replace(':', ' h ')} · ${dureeTexte(dur)}</small>
      <button type="button" class="bloc-x" data-retirer="${t.id}" aria-label="Retirer de l'agenda">✕</button></div>`;
  }).join('');
  const total = places.reduce((s, t) => s + (dureePlanifiee(t) || 30), 0), { capacite } = capaciteJour();
  return `<p class="chapo">Un bloc = un type de tâche. La grande tâche dans le premier bloc, les messages groupés, un bloc tampon pour les imprévus.</p>
    ${aPlacer.length ? `<div class="micro">À placer · touche une tâche puis un horaire</div>
      <div class="a-placer">${aPlacer.map(t => `<button type="button" class="puce-tache${blocChoisi === t.id ? ' choisi' : ''}${t.taille === 'grande' ? ' grande' : ''}" data-choisir="${t.id}">${echapper(t.titre)}<small>${t.duree ? dureeTexte(dureePlanifiee(t)) : '30 min'}</small></button>`).join('')}</div>`
      : '<div class="loi">Toutes les tâches du plan ont un horaire. Glisse un bloc pour le déplacer.</div>'}
    <div class="timeline${blocChoisi ? ' en-choix' : ''}" id="timeline" style="height:${H}px" data-d0="${d0}">
      ${bandes}${heures}${now > d0 && now < d1 ? `<div class="maintenant" style="top:${y(now)}px"></div>` : ''}${blocs}
    </div>
    <div class="loi${total > capacite ? ' alerte' : ''}">${dureeTexte(total)} placés sur ${dureeTexte(capacite)} planifiables. ${total > capacite ? 'Trop chargé : retire un bloc.' : 'Laisse le reste libre pour les imprévus (loi de Murphy).'}</div>`;
}
function placerBloc(id, minute){
  const t = taches.find(x => x.id === id);
  if(!t) return;
  const d0 = minutes(reglagesTheme.debut), d1 = minutes(reglagesTheme.fin);
  const m = Math.max(d0, Math.min(d1 - 15, Math.round(minute / 15) * 15));
  t.heure = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  t.notifie = false; t.vu = false;
  blocChoisi = null;
  sauvegarder(); rendre(); vibrer(8);
}

// ---------- La semaine : objectifs, thèmes, revue, puis les listes ----------
function htmlPlanSemaine(){
  const d = donneesSemaine(), cle = lundiDe(auj());
  const objectifs = d.objectifs[cle] || [];
  const revue = d.revue[cle] || [];
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], ajd = (new Date().getDay() + 6) % 7;
  return `<section class="carte">
      <div class="carte-tete"><div class="micro">Résultats de la semaine</div><div class="compte"><b>${objectifs.filter(o => o.fait).length}</b>/${objectifs.length || 0}</div></div>
      ${objectifs.map(o => `<label class="check objectif-sem"><input type="checkbox" data-objectif="${o.id}" ${o.fait ? 'checked' : ''}><span>${echapper(o.titre)}</span><button type="button" class="capture-x" data-objsuppr="${o.id}" aria-label="Retirer">✕</button></label>`).join('')}
      ${objectifs.length < 5 ? `<form class="capture-form fin" id="formObjectif" autocomplete="off"><input id="inputObjectif" maxlength="100" placeholder="${objectifs.length < 3 ? 'Ajouter un résultat (3 à 5) : ex. 40 prospects contactés' : 'Un dernier résultat ?'}"><button class="btn-plus" type="submit" aria-label="Ajouter">+</button></form>` : '<div class="loi">5 résultats : c\'est le maximum. Concentre-toi.</div>'}
    </section>
    <section class="carte">
      <div class="carte-tete"><div class="micro">Thèmes de jours</div>
        <label class="mini-switch"><input type="checkbox" id="themesActifs" ${d.themesActifs ? 'checked' : ''}><span>${d.themesActifs ? 'activés' : 'désactivés'}</span></label></div>
      <div class="themes${d.themesActifs ? '' : ' off'}">${jours.map((j, i) => `<label class="theme-ligne${i === ajd ? ' auj' : ''}"><span>${j}</span><input data-theme-jour="${i}" maxlength="40" value="${echapper(d.themes[i])}"></label>`).join('')}</div>
    </section>
    <section class="carte">
      <div class="carte-tete"><div class="micro">Revue hebdomadaire · 30 min</div><div class="compte"><b>${revue.filter(Boolean).length}</b>/${REVUE.length}</div></div>
      ${REVUE.map((x, i) => `<label class="check"><input type="checkbox" data-revue="${i}" ${revue[i] ? 'checked' : ''}><span>${x}</span></label>`).join('')}
    </section>
    ${htmlSemaine()}`;
}

// ---------- Branchements (tout est redessiné : délégation) ----------
(function(){
  const zone = $('liste');
  zone.addEventListener('click', e => {
    const sp = e.target.closest('[data-sousplan]');
    if(sp){ sousPlan = sp.dataset.sousplan; blocChoisi = null; rendre(); return; }
    // Rituel
    const et = e.target.closest('[data-etape]');
    if(et){ if(etapeRituel === 2) appliquerReports(); sauverBilan(); etapeRituel = Number(et.dataset.etape); rendre(); window.scrollTo({ top:0 }); return; }
    const r = e.target.closest('[data-rituel]');
    if(r){
      sauverBilan();
      if(r.dataset.rituel === 'suiv'){ if(etapeRituel === 2) appliquerReports(); etapeRituel = Math.min(5, etapeRituel + 1); }
      else if(r.dataset.rituel === 'prec') etapeRituel = Math.max(1, etapeRituel - 1);
      else if(r.dataset.rituel === 'fin') return terminerRituel();
      rendre(); window.scrollTo({ top:0 }); return;
    }
    const so = e.target.closest('[data-sort]');
    if(so){ const id = so.closest('[data-id]').dataset.id; sortsReport[id] = so.dataset.sort; so.parentElement.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b === so))); vibrer(4); return; }
    const gr = e.target.closest('[data-grenouille]');
    if(gr){ choisirGrenouille(gr.dataset.grenouille); return; }
    // Blocs
    const ch = e.target.closest('[data-choisir]');
    if(ch){ blocChoisi = blocChoisi === ch.dataset.choisir ? null : ch.dataset.choisir; vibrer(4); rendre(); return; }
    const rx = e.target.closest('[data-retirer]');
    if(rx){ const t = taches.find(x => x.id === rx.dataset.retirer); if(t){ t.heure = ''; sauvegarder(); rendre(); } return; }
    const bl = e.target.closest('[data-bloc]');
    if(bl && !blocGlisse){ blocChoisi = blocChoisi === bl.dataset.bloc ? null : bl.dataset.bloc; rendre(); return; }
    const tl = e.target.closest('#timeline');
    if(tl && blocChoisi && !bl){
      const rect = tl.getBoundingClientRect();
      placerBloc(blocChoisi, Number(tl.dataset.d0) + (e.clientY - rect.top) / PX);
      return;
    }
    // Semaine
    const os = e.target.closest('[data-objsuppr]');
    if(os){ e.preventDefault(); const d = donneesSemaine(), cle = lundiDe(auj()); d.objectifs[cle] = (d.objectifs[cle] || []).filter(o => o.id !== os.dataset.objsuppr); sauverSemaine(d); rendre(); }
  });
  zone.addEventListener('change', e => {
    const d = donneesSemaine(), cle = lundiDe(auj());
    if(e.target.dataset.objectif){ (d.objectifs[cle] || []).forEach(o => { if(o.id === e.target.dataset.objectif) o.fait = e.target.checked; }); sauverSemaine(d); vibrer(6); rendre(); }
    else if(e.target.dataset.revue !== undefined){ const r = d.revue[cle] || []; r[Number(e.target.dataset.revue)] = e.target.checked; d.revue[cle] = r; sauverSemaine(d); rendre(); }
    else if(e.target.id === 'themesActifs'){ d.themesActifs = e.target.checked; sauverSemaine(d); rendre(); }
    else if(e.target.dataset.themeJour !== undefined){ d.themes[Number(e.target.dataset.themeJour)] = e.target.value.trim().slice(0, 40); sauverSemaine(d); }
    else if(e.target.dataset.check !== undefined){
      const c = lireJSON('todoRituelCoches', {}), l = c.jour === auj() ? c.c || [] : [];
      l[Number(e.target.dataset.check)] = e.target.checked; ecrireJSON('todoRituelCoches', { jour:auj(), c:l });
    }
  });
  document.addEventListener('submit', e => {
    if(e.target.id === 'formObjectif'){
      e.preventDefault();
      const v = $('inputObjectif').value.trim();
      if(!v) return;
      const d = donneesSemaine(), cle = lundiDe(auj());
      d.objectifs[cle] = [...(d.objectifs[cle] || []), { id:nouvelId(), titre:v.slice(0, 100), fait:false }].slice(0, 5);
      sauverSemaine(d); rendre(); const c = $('inputObjectif'); if(c) c.focus();
    } else if(e.target.id === 'formDemain'){
      e.preventDefault();
      const v = $('inputDemain').value.trim();
      if(!v) return;
      const demain = demainISO();
      const t = nettoyerTache({ id:nouvelId(), titre:v, liste:'semaine', date:demain, taille:premiereTailleLibre(demain), priorite:'B', creeLe:Date.now() });
      if(t){ taches.push(t); noter('ajout', t.titre, 'demain'); sauvegarder(); rendre(); const c = $('inputDemain'); if(c) c.focus(); }
    }
  });

  // Glisser un bloc pour changer son horaire (pas de 15 min)
  let blocGlisse = null, gb = null;
  zone.addEventListener('pointerdown', e => {
    const bl = e.target.closest('[data-bloc]');
    if(!bl || e.target.closest('[data-retirer]')) return;
    gb = { bl, y0:e.clientY, top0:parseFloat(bl.style.top), pid:e.pointerId, bouge:false };
  });
  zone.addEventListener('pointermove', e => {
    if(!gb || e.pointerId !== gb.pid) return;
    const dy = e.clientY - gb.y0;
    if(!gb.bouge && Math.abs(dy) < 6) return;
    if(!gb.bouge){ gb.bouge = true; try{ gb.bl.setPointerCapture(e.pointerId); }catch(_){} gb.bl.classList.add('glisse'); }
    e.preventDefault();
    const snap = Math.round(dy / (15 * PX)) * 15 * PX;
    gb.bl.style.top = (gb.top0 + snap) + 'px';
  });
  const finGlisse = e => {
    if(!gb || e.pointerId !== gb.pid) return;
    const g0 = gb; gb = null;
    if(!g0.bouge) return;
    blocGlisse = true; setTimeout(() => { blocGlisse = null; }, 50);
    const d0 = minutes(reglagesTheme.debut);
    placerBloc(g0.bl.dataset.bloc, d0 + parseFloat(g0.bl.style.top) / PX);
  };
  zone.addEventListener('pointerup', finGlisse);
  zone.addEventListener('pointercancel', finGlisse);
})();

function sauverBilan(){
  const champs = document.querySelectorAll('[data-bilan]');
  if(!champs.length) return;
  const tous = lireJSON('todoBilans', {}), b = tous[auj()] || {};
  champs.forEach(c => { b[c.dataset.bilan] = c.value.trim().slice(0, 500); });
  tous[auj()] = b;
  // on ne garde que 60 jours de bilans
  Object.keys(tous).sort().slice(0, -60).forEach(k => delete tous[k]);
  ecrireJSON('todoBilans', tous);
}
function terminerRituel(){
  const idees = $('ideesSoir') ? $('ideesSoir').value : '';
  const n = capturer(idees);
  try{ localStorage.setItem('todoRituel', auj()); }catch(_){}
  noter('fait', 'Rituel du soir', n ? `${n} idée${n > 1 ? 's' : ''} capturée${n > 1 ? 's' : ''}` : '');
  etapeRituel = 1;
  vibrer([10, 60, 10]);
  rendre();
  toast('Demain est prêt. Bonne soirée.', 'succes');
}
