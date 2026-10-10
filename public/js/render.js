let filtre = 'afaire';
let requete = ''; // texte de la recherche en cours
let filtreCat = ''; // catégorie filtrée ('' = toutes)
const ouvertesNotes = new Set(); // tâches dont la note est dépliée
const ouverts = new Set(); // tâches dont la checklist est dépliée (état d'affichage, non sauvegardé)

const TITRES_VUE = { afaire:'À faire', faites:'Terminées', recurrentes:'Tâches répétées', analyse:'Analyse', journal:'Journal' };
const SVG_COCHE = '<svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';

function trier(a, b){
  if(a.important !== b.important) return a.important ? -1 : 1;
  if(a.date !== b.date){
    if(!a.date) return 1;
    if(!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.creeLe - b.creeLe;
}

// --- Recherche : sans accents ni majuscules, tous les mots doivent se trouver ---
function termesRecherche(){
  return plierTexte(requete.normalize('NFC')).split(/\s+/).filter(Boolean);
}
function correspond(t, termes){
  const texte = plierTexte([t.titre, t.cat, t.note, ...(t.sous || []).map(s=>s.titre)].join(' ').normalize('NFC'));
  return termes.every(x => texte.includes(x));
}
// Échappe le texte et entoure les passages trouvés de <mark>
function surligner(texte, termes){
  if(!termes.length) return echapper(texte);
  texte = String(texte).normalize('NFC');
  const f = plierTexte(texte), marque = new Array(texte.length).fill(false);
  termes.forEach(x=>{
    for(let i = f.indexOf(x); i !== -1; i = f.indexOf(x, i + x.length)){
      for(let k = i; k < i + x.length; k++) marque[k] = true;
    }
  });
  let out = '', k = 0;
  while(k < texte.length){
    let j = k;
    while(j < texte.length && marque[j] === marque[k]) j++;
    const morceau = echapper(texte.slice(k, j));
    out += marque[k] ? `<mark>${morceau}</mark>` : morceau;
    k = j;
  }
  return out;
}

function htmlTache(t, termes){
  termes = Array.isArray(termes) ? termes : [];
  const aujourdhui = auj();
  let meta = '', checklist = '';
  const sous = t.sous || [];
  // pendant une recherche, la checklist se déplie si une étape correspond
  const ouvert = sous.length > 0 && (ouverts.has(t.id) || (termes.length > 0 && sous.some(s => termes.some(x => plierTexte(s.titre.normalize('NFC')).includes(x)))));
  const nFaites = sous.filter(s=>s.fait).length;
  const chip = sous.length
    ? `<button class="sous-chip${nFaites === sous.length ? ' complet' : ''}" type="button" data-act="sous-voir" aria-expanded="${ouvert}">☑ ${nFaites}/${sous.length} ${ouvert ? '▾' : '▸'}</button>`
    : '';
  const rep = t.repeter ? `<span class="repet">🔁 ${LIBELLES_REPET[t.repeter]}</span>` : '';
  const tag = t.cat ? `<span class="cat-tag" style="--c:${couleurCat(t.cat)}"><i></i>${surligner(t.cat, termes)}</span>` : '';
  // la note se déplie à la main, ou toute seule si la recherche la concerne
  const noteOuverte = !!t.note && (ouvertesNotes.has(t.id) || (termes.length > 0 && termes.some(x => plierTexte(t.note.normalize('NFC')).includes(x))));
  const chipNote = t.note
    ? `<button class="note-chip" type="button" data-act="note-voir" aria-expanded="${noteOuverte}" aria-label="Afficher la note">📝 ${noteOuverte ? '▾' : '▸'}</button>`
    : '';
  const noteHtml = noteOuverte ? `<div class="note-texte">${termes.length ? surligner(t.note, termes) : noteVersHtml(t.note)}</div>` : '';
  if(ouvert){
    checklist = `<div class="sous-inline">${sous.map(s=>`<button class="sous-ligne${s.fait ? ' fait' : ''}" type="button" data-act="sous" data-sid="${echapper(s.id)}"><span class="sous-coche"></span><span class="sous-titre">${surligner(s.titre, termes)}</span></button>`).join('')}</div>`;
  }
  if(t.date || rep || chip || tag || chipNote){
    const enRetard = !!t.date && !t.fait && t.date < aujourdhui;
    const cls = enRetard ? 'retard' : (t.date === aujourdhui ? 'auj' : '');
    meta = `<div class="tache-meta ${cls}">${tag}${t.date ? `<span>${echapper(libelleDate(t.date))}${t.heure ? ' · 🔔 ' + echapper(t.heure) : ''}</span>` : ''}${rep}${chipNote}${chip}</div>`;
    if(enRetard){
      meta += `<div class="reporter">
        <button class="pill-report" type="button" data-act="reporter" data-jours="0">Reporter à aujourd'hui</button>
        <button class="pill-report" type="button" data-act="reporter" data-jours="1">Demain</button>
      </div>`;
    }
  }
  meta += noteHtml + checklist;
  return `<div class="tache${t.fait?' fait':''}${t.important?' important':''}" data-id="${t.id}" data-d="${t.fait ? '↩ Rouvrir' : '✓ Terminer'}" data-g="Supprimer ✕">
    <button class="coche" type="button" data-act="toggle" aria-label="${t.fait?'Marquer comme à faire':'Marquer comme faite'}">${SVG_COCHE}</button>
    <div class="tache-corps" data-act="edit"><div class="tache-titre">${surligner(t.titre, termes)}</div>${meta}</div>
    <button class="etoile" type="button" data-act="star" aria-label="Basculer important">★</button>
    <button class="icone" type="button" data-act="edit" aria-label="Modifier">✎</button>
    <button class="icone suppr" type="button" data-act="suppr" aria-label="Supprimer">✕</button>
  </div>`;
}

function htmlGroupe(titre, liste, cls, actionHtml, termes){
  if(!liste.length) return '';
  return `<div class="groupe"><div class="groupe-titre ${cls||''}"><span>${titre}</span>${actionHtml||''}</div>
    <div class="groupe-liste">${liste.map(t => htmlTache(t, termes)).join('')}</div></div>`;
}

function rendre(){
  majRappels();
  const visibles = taches.filter(t=>!t.archive); // les tâches archivées ne comptent que dans l'analyse
  const restantes = visibles.filter(t=>!t.fait);
  const faites = visibles.filter(t=>t.fait);
  const aujourdhui = auj();
  const enRetard = restantes.filter(t=>t.date && t.date < aujourdhui);

  // Résumé
  $('dateJour').textContent = texteEntete((s => s.charAt(0).toUpperCase() + s.slice(1))(
    new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
  ));
  // La carte résumé change de couleur selon l'état : retard (alerte), tout fait (vert), sinon couleur d'accent
  const etat = enRetard.length ? 'retard' : (visibles.length && !restantes.length ? 'fini' : 'ok');
  $('resume').dataset.etat = etat;
  $('resumeMessage').textContent = enRetard.length
    ? `${enRetard.length} tâche${enRetard.length>1?'s':''} en retard : reporte-${enRetard.length>1?'les':'la'} ou termine-${enRetard.length>1?'les':'la'}.`
    : etat === 'fini' ? 'Tout est fait, bravo !'
    : restantes.length ? `${restantes.filter(t=>t.date === aujourdhui).length} pour aujourd'hui · ${restantes.length} au total.` : '';
  const nRec = visibles.filter(t=>!t.fait && t.repeter).length;
  $('navRec').textContent = nRec || '';
  $('titreVue').textContent = TITRES_VUE[filtre] || '';
  $('resteNb').textContent = restantes.length;
  $('resumeTotal').textContent = `sur ${visibles.length} tâche${visibles.length>1?'s':''}`;
  const r = $('resumeRetard');
  r.hidden = !enRetard.length;
  r.textContent = `${enRetard.length} en retard`;
  const pct = visibles.length ? Math.round(faites.length / visibles.length * 100) : 0;
  $('barreFill').style.width = pct + '%';
  $('barreFill').classList.toggle('complet', visibles.length > 0 && pct === 100);
  $('navAFaire').textContent = restantes.length;
  $('navFaites').textContent = faites.length;

  // Filtre par catégorie (ne s'affiche que s'il existe au moins une catégorie)
  const cats = toutesCategories(visibles);
  if(filtreCat && !cats.some(c => cleCat(c) === cleCat(filtreCat))) filtreCat = '';
  const zoneCat = $('filtresCat');
  if(!['afaire', 'faites'].includes(filtre) || !cats.length){
    zoneCat.hidden = true;
  } else {
    zoneCat.hidden = false;
    zoneCat.innerHTML = `<button class="filtre-cat${filtreCat ? '' : ' actif'}" type="button" data-cat="">Toutes</button>` +
      cats.map(c => `<button class="filtre-cat${cleCat(c) === cleCat(filtreCat) ? ' actif' : ''}" type="button" data-cat="${echapper(c)}" style="--c:${couleurCat(c)}"><i></i>${echapper(c)}</button>`).join('');
  }
  const dansFiltre = t => !filtreCat || memeCat(t, filtreCat);
  const restantesL = restantes.filter(dansFiltre), faitesL = faites.filter(dansFiltre);

  // Liste
  if(filtre === 'analyse'){ $('liste').innerHTML = htmlAnalyse(); return; }
  if(filtre === 'recurrentes'){ $('liste').innerHTML = htmlRecurrentes(); return; }
  if(filtre === 'journal'){ $('liste').innerHTML = htmlJournal(); return; }
  let html = '';
  const termes = termesRecherche();
  if(termes.length){ // recherche : résultats « À faire » et « Terminées », quel que soit l'onglet
    const trouvees = visibles.filter(t => dansFiltre(t) && correspond(t, termes));
    const trouveesA = trouvees.filter(t=>!t.fait).sort(trier);
    const trouveesF = trouvees.filter(t=>t.fait).sort((a,b)=>(b.faitLe||0)-(a.faitLe||0));
    html = trouvees.length
      ? htmlGroupe(`À faire · ${trouveesA.length}`, trouveesA, '', '', termes) + htmlGroupe(`Terminées · ${trouveesF.length}`, trouveesF, '', '', termes)
      : `<div class="vide"><b>Aucun résultat</b>Rien ne correspond à « ${echapper(requete.trim())} ».</div>`;
    $('liste').innerHTML = html;
    return;
  }
  if(filtre === 'afaire'){
    if(!restantes.length){
      html = visibles.length
        ? '<div class="vide"><b>Tout est fait 🎉</b>Profite, ou ajoute une nouvelle tâche.</div>'
        : '<div class="vide"><b>Aucune tâche</b>Écris ta première tâche ci-dessus.</div>';
    } else if(!restantesL.length){
      html = `<div class="vide"><b>Rien à faire dans « ${echapper(filtreCat)} »</b>Choisis « Toutes » pour tout revoir.</div>`;
    } else {
      const trie = restantesL.slice().sort(trier);
      const retardees = trie.filter(t=>t.date && t.date < aujourdhui);
      const actionRetard = retardees.length > 1
        ? '<button class="lien-discret neutre" type="button" data-act="reporter-tout">Tout reporter à aujourd\'hui</button>' : '';
      html += htmlGroupe('En retard', retardees, 'retard', actionRetard);
      html += htmlGroupe("Aujourd'hui", trie.filter(t=>t.date === aujourdhui));
      html += htmlGroupe('À venir', trie.filter(t=>t.date && t.date > aujourdhui));
      html += htmlGroupe('Sans date', trie.filter(t=>!t.date));
    }
  } else {
    if(!faites.length){
      html = '<div class="vide"><b>Rien ici</b>Les tâches terminées apparaîtront ici.</div>';
    } else if(!faitesL.length){
      html = `<div class="vide"><b>Rien de terminé dans « ${echapper(filtreCat)} »</b>Choisis « Toutes » pour tout revoir.</div>`;
    } else {
      const trie = faitesL.slice().sort((a,b)=>(b.faitLe||0)-(a.faitLe||0));
      html = `<div class="groupe"><div class="groupe-titre"><span>${faitesL.length} terminée${faitesL.length>1?'s':''}</span>
        <button class="lien-discret" type="button" data-act="vider">Tout archiver</button></div>
        <div class="groupe-liste">${trie.map(htmlTache).join('')}</div></div>`;
    }
  }
  $('liste').innerHTML = html;
}

function basculerFiltre(nom){
  filtre = nom;
  const vueListe = nom === 'afaire' || nom === 'faites'; // la recherche ne concerne que les listes de tâches
  $('btnRecherche').hidden = !vueListe;
  if(!vueListe){
    requete = ''; $('inputRecherche').value = '';
    $('zoneRecherche').hidden = true; $('btnRecherche').classList.remove('actif');
  }
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('actif', b.dataset.filtre === nom));
  const l = $('liste');
  l.classList.remove('anim'); void l.offsetWidth; l.classList.add('anim');
  rendre();
}


// ---------- Analyse des tâches terminées ----------
function htmlAnalyse(){
  const aujourdhui = auj();
  const faites = taches.filter(t=>t.fait);
  const datees = faites.filter(t=>t.faitLe);
  if(!datees.length){
    return '<div class="vide"><b>Pas encore de données</b>Termine quelques tâches pour voir ton analyse ici.</div>';
  }
  // nombre de tâches terminées par jour
  const parJour = {};
  datees.forEach(t=>{ const j = versISO(new Date(t.faitLe)); parJour[j] = (parJour[j]||0) + 1; });
  const compte = n => { let c = 0; for(let i=0;i<n;i++) c += parJour[ajouterJours(aujourdhui,-i)] || 0; return c; };
  const nAuj = parJour[aujourdhui] || 0, n7 = compte(7), n30 = compte(30);

  // série de jours consécutifs (on tolère « rien encore fait aujourd'hui »)
  let serie = 0, d = parJour[aujourdhui] ? aujourdhui : ajouterJours(aujourdhui,-1);
  while(parJour[d]){ serie++; d = ajouterJours(d,-1); }

  // 7 derniers jours (graphique)
  const jours = [];
  for(let i=6;i>=0;i--){ const j = ajouterJours(aujourdhui,-i); jours.push({ j, n: parJour[j]||0 }); }
  const max = Math.max(1, ...jours.map(x=>x.n));
  const barres = jours.map(x=>{
    const lbl = new Date(x.j+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'short' }).replace('.','');
    return `<div class="barre-col${x.j===aujourdhui?' auj':''}">
      <div class="barre-n">${x.n||''}</div>
      <div class="barre-piste"><div class="barre-haut" style="height:${Math.round(x.n/max*100)}%"></div></div>
      <div class="barre-lbl">${echapper(lbl)}</div></div>`;
  }).join('');

  // indicateurs
  const taux = taches.length ? Math.round(faites.length / taches.length * 100) : 0;
  const avecDate = faites.filter(t=>t.date && t.faitLe);
  const dansTemps = avecDate.filter(t=>versISO(new Date(t.faitLe)) <= t.date).length;
  const moy = (n30 / 30).toFixed(1).replace('.', ',');
  let meilleur = { j:'', n:0 };
  for(let i=0;i<30;i++){ const j = ajouterJours(aujourdhui,-i); if((parJour[j]||0) > meilleur.n) meilleur = { j, n: parJour[j] }; }
  const nImp = faites.filter(t=>t.important).length;

  // répartition par catégorie (30 derniers jours)
  const debut30 = ajouterJours(aujourdhui, -29);
  const parCat = {};
  datees.forEach(t=>{ if(versISO(new Date(t.faitLe)) >= debut30){ const c = t.cat ? canoniqueCat(t.cat) : ''; parCat[c] = (parCat[c] || 0) + 1; } });
  const lignesCat = Object.entries(parCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = Math.max(1, ...lignesCat.map(x => x[1]));
  const blocCat = lignesCat.some(x => x[0]) ? `
    <div class="groupe"><div class="groupe-titre"><span>Terminées par catégorie (30 j)</span></div>
      <div class="groupe-liste">${lignesCat.map(([c, n]) => {
        const col = c ? couleurCat(c) : 'var(--gris)';
        return `<div class="cat-ligne"><span class="cat-nom"><i style="background:${col}"></i>${echapper(c || 'Sans catégorie')}</span>
          <div class="cat-barre"><div style="width:${Math.round(n / maxCat * 100)}%;background:${col}"></div></div><b>${n}</b></div>`;
      }).join('')}</div></div>` : '';

  // objectif du jour
  const nbObjectif = compteObjectif(parJour);
  const blocObjectif = htmlObjectif(nAuj, nbObjectif);

  const ligne = (nom, val) => `<div class="stat-ligne"><span>${nom}</span><b>${val}</b></div>`;
  return `
    ${blocObjectif}
    <div class="stats-grille">
      <div class="stat-tuile"><div class="label">Aujourd'hui</div><div class="valeur">${nAuj}</div></div>
      <div class="stat-tuile"><div class="label">7 derniers jours</div><div class="valeur">${n7}</div></div>
      <div class="stat-tuile"><div class="label">30 derniers jours</div><div class="valeur">${n30}</div></div>
      <div class="stat-tuile"><div class="label">Série en cours</div><div class="valeur">${serie}<small> jour${serie>1?'s':''}</small></div></div>
    </div>
    <div class="groupe"><div class="groupe-titre"><span>Tâches terminées par jour</span></div>
      <div class="graphique">${barres}</div></div>
    ${htmlChaleur(parJour)}
    ${blocCat}
    <div class="groupe"><div class="groupe-titre"><span>Détails</span></div>
      <div class="groupe-liste stat-liste">
        ${ligne('Taux de réussite', `${taux} % (${faites.length}/${taches.length})`)}
        ${avecDate.length ? ligne('Terminées dans les temps', `${Math.round(dansTemps/avecDate.length*100)} % (${dansTemps}/${avecDate.length})`) : ''}
        ${ligne('Moyenne par jour (30 j)', moy)}
        ${meilleur.n ? ligne('Meilleur jour (30 j)', `${meilleur.n} · ${echapper(libelleDate(meilleur.j))}`) : ''}
        ${objectif ? ligne('Objectif atteint (30 j)', `${nbObjectif} jour${nbObjectif>1?'s':''} sur 30`) : ''}
        ${ligne('Importantes terminées', nImp)}
      </div></div>`;
}


// ---------- Objectif quotidien ----------
// Nombre de jours (sur les 30 derniers) où l'objectif a été atteint
function compteObjectif(parJour){
  if(!objectif) return 0;
  let c = 0;
  for(let i=0;i<30;i++) if((parJour[ajouterJours(auj(),-i)] || 0) >= objectif) c++;
  return c;
}

function htmlObjectif(nAuj){
  if(!objectif){
    return `<button class="objectif objectif-vide" type="button" data-act="objectif">
      <span class="objectif-titre">Fixer un objectif quotidien</span>
      <span class="objectif-sous">Combien de tâches veux-tu terminer par jour ?</span></button>`;
  }
  const pct = Math.min(100, Math.round(nAuj / objectif * 100));
  const atteint = nAuj >= objectif;
  const texte = atteint
    ? (nAuj > objectif ? `Objectif dépassé de ${nAuj - objectif}` : 'Objectif atteint 🎯')
    : `Encore ${objectif - nAuj} pour atteindre l'objectif`;
  return `<button class="objectif${atteint ? ' atteint' : ''}" type="button" data-act="objectif" aria-label="Modifier l'objectif quotidien">
    <div class="objectif-haut"><span class="objectif-titre">Objectif du jour</span><span class="objectif-val"><b>${nAuj}</b> / ${objectif}</span></div>
    <div class="objectif-piste"><div class="objectif-fill" style="width:${pct}%"></div></div>
    <div class="objectif-sous">${texte}</div></button>`;
}

// ---------- Carte de chaleur (12 dernières semaines, semaines du lundi au dimanche) ----------
const SEMAINES_CHALEUR = 12;

function niveauChaleur(n, max){
  if(!n) return 0;
  if(objectif){
    if(n >= objectif * 1.5) return 4;
    if(n >= objectif) return 3;
    return n >= objectif / 2 ? 2 : 1;
  }
  const r = n / max; // sans objectif : intensité relative au meilleur jour
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

function htmlChaleur(parJour){
  const aujourdhui = auj();
  const dow = (new Date(aujourdhui + 'T12:00:00').getDay() + 6) % 7; // lundi = 0
  const debut = ajouterJours(aujourdhui, -dow - (SEMAINES_CHALEUR - 1) * 7);
  let max = 1, total = 0;
  const cellules = [], mois = [];
  let moisPrec = '';
  for(let i = 0; i < SEMAINES_CHALEUR * 7; i++){
    const j = ajouterJours(debut, i);
    const futur = j > aujourdhui;
    if(!futur){ const n = parJour[j] || 0; max = Math.max(max, n); total += n; }
  }
  for(let w = 0; w < SEMAINES_CHALEUR; w++){
    const lundi = ajouterJours(debut, w * 7);
    const m = new Date(lundi + 'T12:00:00').toLocaleDateString('fr-FR', { month:'short' }).replace('.', '');
    mois.push(m !== moisPrec ? `<span>${echapper(m)}</span>` : '<span></span>');
    moisPrec = m;
    for(let d = 0; d < 7; d++){
      const j = ajouterJours(lundi, d);
      if(j > aujourdhui){ cellules.push('<span class="chaleur-case futur"></span>'); continue; }
      const n = parJour[j] || 0, niv = niveauChaleur(n, max);
      const atteint = objectif && n >= objectif;
      const lib = new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
      cellules.push(`<button class="chaleur-case n${niv}${atteint ? ' ok' : ''}${j === aujourdhui ? ' auj' : ''}" type="button" data-act="jour" data-lbl="${echapper(lib)}" data-n="${n}" aria-label="${echapper(lib)} : ${n}"></button>`);
    }
  }
  const legende = objectif
    ? '<span class="chaleur-leg"><i class="n1"></i> sous l\'objectif <i class="n3 ok"></i> atteint</span>'
    : '<span class="chaleur-leg">moins <i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i> plus</span>';
  return `<div class="groupe"><div class="groupe-titre"><span>Régularité · ${SEMAINES_CHALEUR} semaines</span></div>
    <div class="chaleur">
      <div class="chaleur-mois">${mois.join('')}</div>
      <div class="chaleur-corps">
        <div class="chaleur-jours"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div>
        <div class="chaleur-grille">${cellules.join('')}</div>
      </div>
      <div class="chaleur-pied"><span>${total} tâche${total>1?'s':''} terminée${total>1?'s':''}</span>${legende}</div>
    </div></div>`;
}
