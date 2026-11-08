let nouvelleDate = '';
let nouvelImportant = false;
let nouvelleRepet = '';
let sousEdition = []; // brouillon des sous-tâches pendant que la modale est ouverte
let nouvelleCat = '';
let ignorerAuto = false; // l'utilisateur refuse la détection automatique pour cette saisie
let tacheEnEdition = null;

// --- Ajout rapide ---
function majOptionsAjout(){
  // Les puces d'options restent cachées tant qu'on n'écrit pas, sauf si l'une d'elles est déjà choisie
  $('formAjout').classList.toggle('avec-options', !!(nouvelleDate || nouvelImportant || nouvelleRepet || nouvelleCat));
  $('chipDate').classList.toggle('actif', !!nouvelleDate);
  $('chipDateTxt').textContent = nouvelleDate ? '📅 ' + libelleDate(nouvelleDate) : '📅 Date';
  $('effacerDate').hidden = !nouvelleDate;
  const ci = $('chipImportant');
  ci.classList.toggle('actif', nouvelImportant);
  ci.classList.toggle('important', nouvelImportant);
  ci.textContent = nouvelImportant ? '★ Important' : '☆ Important';
  const cr = $('chipRepeter');
  cr.classList.toggle('actif', !!nouvelleRepet);
  cr.textContent = '🔁 ' + (nouvelleRepet ? LIBELLES_REPET[nouvelleRepet] : 'Répéter');
  const cc = $('chipCat');
  cc.classList.toggle('actif', !!nouvelleCat);
  cc.textContent = '🏷 ' + (nouvelleCat || 'Catégorie');
}
function reinitialiserOptions(){
  nouvelleDate = ''; nouvelImportant = false; nouvelleRepet = ''; nouvelleCat = ''; ignorerAuto = false; $('inputDate').value = '';
  majOptionsAjout(); majApercu();
}

$('inputDate').addEventListener('change', e=>{ nouvelleDate = e.target.value; majOptionsAjout(); });
$('effacerDate').addEventListener('click', ()=>{ nouvelleDate = ''; $('inputDate').value = ''; majOptionsAjout(); });
// --- Détection automatique dans le texte saisi ---
function majApercu(){
  const zone = $('apercu');
  const a = ignorerAuto ? null : analyserSaisie($('inputTitre').value.trim());
  if(!a || !a.trouve){ zone.hidden = true; return; }
  const parts = [];
  if(a.date) parts.push(libelleDate(a.date));
  if(a.heure) parts.push('🔔 ' + a.heure);
  if(a.important) parts.push('★ Important');
  if(a.repeter) parts.push('🔁 ' + LIBELLES_REPET[a.repeter]);
  if(a.cat) parts.push('🏷 ' + canoniqueCat(a.cat));
  zone.innerHTML = `<span>Détecté : <b>${echapper(parts.join(' · '))}</b></span><button type="button" id="ignorerAuto">Ignorer</button>`;
  zone.hidden = false;
}
$('inputTitre').addEventListener('input', majApercu);
$('apercu').addEventListener('click', e=>{
  if(e.target.id === 'ignorerAuto'){ ignorerAuto = true; majApercu(); $('inputTitre').focus(); }
});

// Un tap fait défiler les catégories existantes ; s'il n'y en a pas, on amorce un #hashtag dans le texte
$('chipCat').addEventListener('click', ()=>{
  const liste = toutesCategories();
  if(!liste.length){
    const champ = $('inputTitre');
    if(!/(^|\s)#\S*$/.test(champ.value)) champ.value = champ.value.replace(/\s*$/, champ.value ? ' #' : '#');
    champ.focus(); majApercu();
    toast('Écris le nom juste après le #, ex. #travail');
    return;
  }
  const suite = ['', ...liste];
  nouvelleCat = suite[(Math.max(0, suite.indexOf(nouvelleCat)) + 1) % suite.length];
  majOptionsAjout();
});
$('filtresCat').addEventListener('click', e=>{
  const b = e.target.closest('[data-cat]');
  if(!b) return;
  filtreCat = b.dataset.cat;
  rendre();
});
$('chipImportant').addEventListener('click', ()=>{ nouvelImportant = !nouvelImportant; majOptionsAjout(); });
// Un tap fait défiler : Répéter -> Chaque jour -> Chaque semaine -> Chaque mois -> Répéter
$('chipRepeter').addEventListener('click', ()=>{
  nouvelleRepet = REPETITIONS[(REPETITIONS.indexOf(nouvelleRepet) + 1) % REPETITIONS.length];
  if(nouvelleRepet && !nouvelleDate){ nouvelleDate = auj(); $('inputDate').value = nouvelleDate; } // une tâche récurrente a besoin d'une date
  majOptionsAjout();
});

// --- Ajout d'une tâche : la fiche complète s'ouvre, préremplie avec ce qui a été saisi ou détecté ---
let brouillonTache = null; // tâche en cours de création (pas encore enregistrée)

// Construit la tâche à partir de la saisie (texte + puces + détection automatique). saisie vide = fiche vierge.
// taille (facultatif) : forcer la taille (ex. « choisir la grenouille »). Sinon : la première place libre du 1-3-5.
function construireBrouillon(saisie, taille){
  // Les puces choisies à la main passent avant ce qui est détecté dans le texte
  const auto = (saisie && !ignorerAuto) ? analyserSaisie(saisie) : null;
  const detecte = !!(auto && auto.trouve);
  let date = nouvelleDate || (detecte ? auto.date : '');
  if(!date) date = auj(); // sans date précisée, la tâche est pour aujourd'hui
  const important = nouvelImportant || (detecte && auto.important);
  return { id:nouvelId(), titre:detecte ? auto.titre : saisie, fait:false, important, date,
    heure:(detecte && auto.heure) ? auto.heure : '', avance:null, notifie:false, vu:false,
    repeter:nouvelleRepet || (detecte ? auto.repeter : ''), cat:nouvelleCat || (detecte && auto.cat ? canoniqueCat(auto.cat) : ''),
    liste:listeDepuisDate(date), taille:taille || premiereTailleLibre(), priorite:important ? 'A' : 'B', duree:null, reports:0,
    suiteId:'', sous:[], note:'', creeLe:Date.now(), faitLe:null };
}

// Enregistre la tâche et remet la saisie rapide à zéro
function enregistrerNouvelle(brut){
  const t = nettoyerTache(brut);
  if(!t) return;
  taches.push(t);
  noter('ajout', t.titre, t.date ? libelleDate(t.date) : '');
  // la nouvelle tâche doit rester visible : on rouvre les groupes repliés et le jour concerné
  groupesReplies.clear();
  if(t.date > auj()) groupesOuverts.add('j-' + t.date);
  sauverGroupes();
  sauvegarder();
  $('inputTitre').value = '';
  reinitialiserOptions();
  if(requete) fermerRecherche();
  vibrer(10);
  if(t.liste !== 'jour'){ // pas pour aujourd'hui : elle attend dans « Semaine », et reviendra seule le jour venu
    rendre();
    toast(t.liste === 'semaine' ? `Ajoutée à la semaine (${libelleDate(t.date)})` : 'Rangée dans « plus tard »', '', { label:'Voir', fn:()=>basculerFiltre('semaine') });
  } else {
    if(filtre !== 'afaire') basculerFiltre('afaire'); else rendre();
    const horsPlan = planDuJour().horsPlan.some(x => x.id === t.id);
    toast(horsPlan ? 'Ajoutée hors plan : le 1-3-5 est plein' : 'Tâche ajoutée', horsPlan ? 'alerte' : 'succes',
      horsPlan ? { label:'Vers la semaine', fn:()=>{ const x = taches.find(y => y.id === t.id); if(x) deplacer(x, 'semaine'); } } : null);
  }
}

$('formAjout').addEventListener('submit', e=>{
  e.preventDefault();
  const brouillon = construireBrouillon($('inputTitre').value.trim());
  if(reglagesTheme.ajoutRapide && brouillon.titre){ enregistrerNouvelle(brouillon); $('inputTitre').focus(); } // option « Ajout rapide »
  else ouvrirEdition(brouillon, true);
});

// --- Recherche ---
function ouvrirRecherche(){
  $('zoneRecherche').hidden = false;
  $('btnRecherche').classList.add('actif');
  $('inputRecherche').focus();
}
function fermerRecherche(){
  requete = ''; $('inputRecherche').value = '';
  $('zoneRecherche').hidden = true;
  $('btnRecherche').classList.remove('actif');
  rendre();
}
$('btnRecherche').addEventListener('click', ()=>{ $('zoneRecherche').hidden ? ouvrirRecherche() : fermerRecherche(); });
$('rechercheFermer').addEventListener('click', fermerRecherche);
$('inputRecherche').addEventListener('input', e=>{ requete = e.target.value; rendre(); });
$('inputRecherche').addEventListener('keydown', e=>{
  if(e.key === 'Escape') fermerRecherche();
  else if(e.key === 'Enter'){ e.preventDefault(); e.target.blur(); } // referme le clavier
});

// --- Navigation ---
$('nav').addEventListener('click', e=>{
  const b = e.target.closest('.nav-btn');
  if(b && b.dataset.filtre !== filtre) basculerFiltre(b.dataset.filtre);
});

// --- Actions sur les tâches : la liste ET le haut de l'accueil (grenouille, places du 1-3-5) ---
document.querySelector('.wrap').addEventListener('click', e=>{
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const act = el.dataset.act;

  // Méthode : ajouter dans une place du 1-3-5 (aujourd'hui ou demain), déplacer entre les listes, ouvrir le journal
  if(act === 'ajouter'){
    const b = construireBrouillon('', el.dataset.taille);
    if(el.dataset.date && el.dataset.date > auj()){ b.liste = 'semaine'; b.date = el.dataset.date; if(!el.dataset.taille) b.taille = premiereTailleLibre(b.date); }
    ouvrirEdition(b, true); return;
  }
  if(act === 'ouvrir-journal'){ basculerFiltre('journal'); return; }
  if(act === 'trier'){ ouvrirTri(); return; }
  if(act === 'minimal'){ basculerMinimale(); return; }
  if(act === 'rituel'){ sousPlan = 'rituel'; basculerFiltre('planifier'); return; }
  if(act === 'revue'){ sousPlan = 'semaine'; basculerFiltre('planifier'); return; }
  if(act === 'focus'){ const ft = el.closest('[data-id]'); if(ft) ouvrirFocus(ft.dataset.id); return; }
  if(act === 'suppr-capture'){ supprimerTache(el.closest('[data-id]').dataset.id); return; }
  if(act === 'vers-jour' || act === 'vers-semaine' || act === 'vers-plustard'){
    const lt = taches.find(x => x.id === el.closest('[data-id]').dataset.id);
    if(lt) deplacer(lt, act.slice(5));
    return;
  }

  if(act === 'vider'){
    const aArchiver = taches.filter(t=>t.fait && !t.archive && (!filtreCat || memeCat(t, filtreCat)));
    if(!aArchiver.length) return;
    aArchiver.forEach(t=>{ t.archive = true; });
    const n = aArchiver.length;
    noter('archive', `${n} tâche${n>1?'s':''} terminée${n>1?'s':''}`);
    sauvegarder(); rendre();
    toast(`${n} tâche${n>1?'s':''} archivée${n>1?'s':''} · stats conservées`, '',
      { label:'Annuler', fn:()=>{ aArchiver.forEach(t=>{ t.archive = false; }); sauvegarder(); rendre(); } });
    return;
  }

  if(act === 'reporter-tout'){
    const aujourdhui = auj();
    reporterTaches(taches.filter(t=>!t.fait && !t.stock && !t.archive && t.date && t.date < aujourdhui && (!filtreCat || memeCat(t, filtreCat))), 0);
    return;
  }

  if(act === 'objectif'){ ouvrirObjectif(); return; }
  if(act === 'vider-journal'){
    if(!journal.length || !confirm('Effacer tout le journal ? Tes tâches ne sont pas touchées.')) return;
    viderJournal(); rendre(); toast('Journal effacé');
    return;
  }
  if(act === 'jour'){
    const n = Number(el.dataset.n) || 0;
    toast(`${el.dataset.lbl} : ${n} tâche${n>1?'s':''} terminée${n>1?'s':''}`);
    return;
  }

  const ligne = el.closest('.tache');
  const t = ligne && taches.find(x=>x.id === ligne.dataset.id);
  if(!t) return;

  if(act === 'toggle'){
    basculerFait(t);
  } else if(act === 'star'){
    t.important = !t.important;
    sauvegarder(); rendre();
  } else if(act === 'edit'){
    ouvrirEdition(t);
  } else if(act === 'suppr'){
    supprimerTache(t.id);
  } else if(act === 'note-voir'){
    if(ouvertesNotes.has(t.id)) ouvertesNotes.delete(t.id); else ouvertesNotes.add(t.id);
    rendre();
  } else if(act === 'sous-voir'){
    if(ouverts.has(t.id)) ouverts.delete(t.id); else ouverts.add(t.id);
    rendre();
  } else if(act === 'sous'){
    basculerSous(t, el.dataset.sid);
  } else if(act === 'reporter'){
    reporterTaches([t], Number(el.dataset.jours) || 0);
  }
});

// Cocher / décocher une étape de la checklist
function basculerSous(t, sid){
  const s = (t.sous || []).find(x=>x.id === sid);
  if(!s) return;
  s.fait = !s.fait;
  sauvegarder(); rendre();
  if(s.fait && !t.fait && t.sous.every(x=>x.fait)){
    toast('Toutes les étapes sont faites', '', { label:'Terminer la tâche', fn:()=>{ if(!t.fait) basculerFait(t); } });
  }
}

// Terminer / rouvrir une tâche. Une tâche récurrente crée sa prochaine occurrence.
function basculerFait(t){
  if(!t.fait){
    t.fait = true; t.faitLe = Date.now();
    let suivante = null;
    if(t.repeter){
      const dateSuivante = prochaineDate(t.date, t.repeter);
      suivante = { id:nouvelId(), titre:t.titre, fait:false, important:t.important,
        liste:listeDepuisDate(dateSuivante), taille:t.taille, priorite:t.priorite, duree:t.duree, reports:0, // elle attend dans la semaine
        date:dateSuivante, heure:t.heure || '', avance:t.avance, notifie:false, vu:false, repeter:t.repeter, suiteId:'', creeLe:Date.now(), faitLe:null,
        cat:t.cat || '', note:t.note || '', sous:(t.sous || []).map(s=>({ id:nouvelId(), titre:s.titre, fait:false })) }; // checklist remise à zéro
      taches.push(suivante);
      t.suiteId = suivante.id;
    }
    noter('fait', t.titre);
    vibrer(10);
    // Loi de Laborit : on commence spontanément par le facile. Rappel doux (une fois par jour) si la grenouille attend.
    if(t.taille !== 'grande' && t.liste === 'jour' && new Date().getHours() < 12 && localStorage.getItem('todoLaborit') !== auj()){
      const g = planDuJour().plan.grande.afaire[0];
      if(g){ try{ localStorage.setItem('todoLaborit', auj()); }catch(_){} setTimeout(()=>toast('Laborit : la grenouille d\'abord, le facile ensuite', 'alerte', { label:'Focus', fn:()=>ouvrirFocus(g.id) }), 900); }
    }
    sauvegarder(); rendre();
    if(objectif && !suivante && compteAujourdhui() === objectif) toast('Objectif du jour atteint 🎯', 'succes');
    if(suivante){
      toast(`Prochaine occurrence : ${libelleDate(suivante.date).toLowerCase()}`, '',
        { label:'Annuler', fn:()=>{ if(t.fait) basculerFait(t); } });
    }
  } else {
    t.fait = false; t.faitLe = null;
    if(t.suiteId){ // on retire l'occurrence suivante si elle n'a pas été traitée
      const i = taches.findIndex(x=>x.id === t.suiteId && !x.fait);
      if(i >= 0) taches.splice(i,1);
      t.suiteId = '';
    }
    noter('rouvert', t.titre);
    sauvegarder(); rendre();
  }
}

// Tâches terminées aujourd'hui (archivées comprises)
function compteAujourdhui(){
  const j = auj();
  return taches.filter(t => t.fait && t.faitLe && versISO(new Date(t.faitLe)) === j).length;
}

// --- Objectif quotidien ---
function fermerObjectif(){ $('overlayObjectif').classList.remove('actif'); }
function ouvrirObjectif(){
  $('objValeur').value = objectif || 3;
  $('objRetirer').hidden = !objectif;
  $('overlayObjectif').classList.add('actif');
}
const borneObjectif = n => Math.max(1, Math.min(MAX_OBJECTIF, Math.round(Number(n)) || 1));
$('objMoins').addEventListener('click', ()=>{ $('objValeur').value = borneObjectif(($('objValeur').value || 1) - 1); });
$('objPlus').addEventListener('click', ()=>{ $('objValeur').value = borneObjectif(Number($('objValeur').value || 0) + 1); });
$('objAnnuler').addEventListener('click', fermerObjectif);
$('objValider').addEventListener('click', ()=>{
  enregistrerObjectif(borneObjectif($('objValeur').value));
  fermerObjectif(); rendre();
  toast(`Objectif : ${objectif} tâche${objectif>1?'s':''} par jour`);
});
$('objRetirer').addEventListener('click', ()=>{ enregistrerObjectif(0); fermerObjectif(); rendre(); toast('Objectif retiré'); });
$('objValeur').addEventListener('keydown', e=>{ if(e.key === 'Enter') $('objValider').click(); });

// Reporte des tâches à aujourd'hui (0) ou plus tard (n jours), avec annulation
function reporterTaches(liste, jours){
  if(!liste.length) return;
  const cible = ajouterJours(auj(), jours);
  const avant = liste.map(t=>({ t, date:t.date }));
  liste.forEach(t=>{ t.date = cible; });
  const n = liste.length;
  noter('report', n > 1 ? `${n} tâches` : liste[0].titre, libelleDate(cible));
  sauvegarder(); rendre();
  toast(`${n>1 ? n + ' tâches reportées' : 'Tâche reportée'} pour ${libelleDate(cible).toLowerCase()}`, '',
    { label:'Annuler', fn:()=>{ avant.forEach(a=>{ a.t.date = a.date; }); sauvegarder(); rendre(); } });
}

function supprimerTache(id){
  const i = taches.findIndex(x=>x.id === id);
  if(i < 0) return;
  noter('suppr', taches[i].titre);
  if(taches[i].fait){ // une tâche terminée est archivée : elle reste dans l'analyse
    const t = taches[i];
    t.archive = true;
    sauvegarder(); rendre();
    toast('Tâche supprimée', '', { label:'Annuler', fn:()=>{ t.archive = false; sauvegarder(); rendre(); } });
    return;
  }
  const [supprimee] = taches.splice(i,1);
  sauvegarder(); rendre();
  toast('Tâche supprimée', '', { label:'Annuler', fn:()=>{ taches.splice(Math.min(i, taches.length), 0, supprimee); sauvegarder(); rendre(); } });
}

// --- La fiche : créer ou modifier une tâche (méthode du guide : taille 1-3-5, priorité, durée, liste) ---
const valeurSeg = id => { const b = $(id).querySelector('[aria-pressed="true"]'); return b ? b.dataset.v : ''; };
function choisirSeg(id, v){ $(id).querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }

// Conseils en direct, tirés du guide (lois en contexte)
function majFiche(){
  const liste = valeurSeg('editListe'), taille = valeurSeg('editTaille');
  $('champDate').hidden = liste === 'jour';
  $('editConseil').textContent = conseilTitre($('editTitre').value);
  // 1-3-5 : places restantes pour cette taille aujourd'hui
  const jourCible = liste === 'jour' ? auj() : (liste === 'semaine' && $('editDate').value) || '';
  if(jourCible){
    const reste = placesRestantes(taille, tacheEnEdition, jourCible);
    $('editTailleInfo').textContent = reste > 0 ? `${reste}/${PLACES[taille]} libre${reste > 1 ? 's' : ''} · ${AIDE_TAILLE[taille]}` : 'Complet : elle sera hors plan';
    $('editTailleInfo').classList.toggle('alerte', reste <= 0);
  } else { $('editTailleInfo').textContent = ''; $('editTailleInfo').classList.remove('alerte'); }
  $('editPrioInfo').textContent = '';
  // Durée : estimation + marge (Hofstadter), ou rappel de Parkinson
  const d = parseInt($('editDuree').value, 10);
  $('editDureeInfo').textContent = d > 0
    ? `≈ ${dureeTexte(dureePlanifiee({ duree:d }))} avec la marge${d > 120 ? ' · à découper' : ''}`
    : '';
  document.querySelectorAll('#editDurees [data-min]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === d)));
  majChampHeure();
}

function ouvrirEdition(t, creation){
  tacheEnEdition = t.id;
  brouillonTache = creation ? t : null;
  $('editEntete').textContent = creation ? 'Nouvelle tâche' : 'Modifier la tâche';
  $('editIndex').textContent = creation ? '+' : '✎';
  $('editValider').textContent = creation ? 'Ajouter' : 'Enregistrer';
  $('editSecondaire').hidden = !!creation;
  $('editTitre').value = t.titre;
  choisirSeg('editListe', t.liste || listeDepuisDate(t.date));
  choisirSeg('editTaille', t.taille || 'petite');
  choisirSeg('editPrio', t.priorite || 'B');
  $('editDuree').value = t.duree || '';
  $('editDate').value = (t.liste && t.liste !== 'jour') ? (t.date || '') : '';
  $('editHeure').value = t.heure || '';
  $('editAvance').value = t.avance === null || t.avance === undefined ? avanceDefaut : t.avance;
  $('editRepeter').value = t.repeter || '';
  $('editNote').value = t.note || '';
  sousEdition = (t.sous || []).map(s=>({ ...s }));
  dessinerSousEdition();
  $('editSousNouvelle').value = '';
  $('editReport').hidden = !(t.reports >= 3 && !t.fait);
  $('editReport').textContent = `Reportée ${t.reports} fois : à découper, ranger ou supprimer.`;
  majFiche();
  $('overlayEdit').classList.add('actif');
  if(creation && !t.titre) setTimeout(()=>$('editTitre').focus(), 250);
}
function fermerEdition(){ $('overlayEdit').classList.remove('actif'); tacheEnEdition = null; brouillonTache = null; } // annuler garde le texte saisi

$('editAnnuler').addEventListener('click', fermerEdition);
$('overlayEdit').addEventListener('click', e=>{
  const s = e.target.closest('.seg [data-v]');
  if(s){ choisirSeg(s.parentElement.id, s.dataset.v); vibrer(4); majFiche(); return; }
  const d = e.target.closest('[data-min]');
  if(d){ $('editDuree').value = d.dataset.min; vibrer(4); majFiche(); }
});
['editTitre', 'editDuree', 'editDate'].forEach(id => $(id).addEventListener('input', majFiche));

// --- Rappels : champ heure + minutes d'avance ---
function majChampHeure(){
  const liste = valeurSeg('editListe');
  const date = liste === 'jour' ? auj() : $('editDate').value;
  $('editHeure').disabled = !date;
  if(!date) $('editHeure').value = '';
  $('blocAvance').hidden = !$('editHeure').value;
  $('aideRappel').textContent = '';
}
$('editHeure').addEventListener('input', majChampHeure);

$('editValider').addEventListener('click', ()=>{
  const t = brouillonTache && brouillonTache.id === tacheEnEdition ? brouillonTache : taches.find(x=>x.id === tacheEnEdition);
  const titre = $('editTitre').value.trim();
  if(!t) return fermerEdition();
  if(!titre){ toast('Écris la tâche : un verbe, un objet, un résultat', 'alerte'); $('editTitre').focus(); return; }
  t.titre = titre;
  const avantRappel = [t.date, t.heure, t.avance].join('|');
  // Liste et date : « aujourd'hui » = la date du jour ; une date passée ou du jour ramène la tâche dans la journée
  let liste = valeurSeg('editListe') || t.liste; // une idée de la capture reste dans la capture tant qu'on ne choisit pas
  let date = liste === 'jour' ? auj() : $('editDate').value;
  if(liste !== 'jour' && date && date <= auj()){ liste = 'jour'; date = auj(); }
  if(liste === 'semaine' && !date) date = '';
  t.liste = liste; t.date = date;
  t.taille = valeurSeg('editTaille') || 'petite';
  t.priorite = valeurSeg('editPrio') || 'B';
  t.important = t.priorite === 'A';
  const d = parseInt($('editDuree').value, 10);
  t.duree = d > 0 && d <= 720 ? d : null;
  t.heure = t.date ? $('editHeure').value : '';
  if(t.heure){
    const av = parseInt($('editAvance').value, 10);
    t.avance = av >= 0 && av <= 1440 ? av : null;
    if(t.avance !== null) enregistrerAvanceDefaut(t.avance); // sert de valeur proposée la prochaine fois
    demanderNotifications();
  } else t.avance = null;
  if([t.date, t.heure, t.avance].join('|') !== avantRappel){ t.notifie = false; t.vu = false; }
  const nouvelle = $('editSousNouvelle').value.trim();
  if(nouvelle && sousEdition.length < MAX_SOUS) sousEdition.push({ id:nouvelId(), titre:nouvelle.slice(0,140), fait:false });
  t.sous = nettoyerSous(sousEdition);
  t.note = $('editNote').value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE);
  t.repeter = $('editRepeter').value;
  if(t.repeter && !t.date){ t.date = auj(); t.liste = 'jour'; } // une tâche répétée a besoin d'une date
  if(t === brouillonTache){ fermerEdition(); enregistrerNouvelle(t); return; }
  sauvegarder(); rendre(); fermerEdition();
});
$('editPlusTard').addEventListener('click', ()=>{
  const t = taches.find(x=>x.id === tacheEnEdition);
  fermerEdition();
  if(t) deplacer(t, t.liste === 'plustard' ? 'semaine' : 'plustard');
});
$('editSuppr').addEventListener('click', ()=>{
  const id = tacheEnEdition;
  fermerEdition();
  if(id) supprimerTache(id);
});
// --- Sous-tâches dans la modale ---
function dessinerSousEdition(){
  $('editSous').innerHTML = sousEdition.map((s,i)=>`<div class="sous-edit">
    <button type="button" class="sous-coche-edit${s.fait ? ' fait' : ''}" data-sact="fait" data-i="${i}" aria-label="Basculer la sous-tâche"></button>
    <input type="text" maxlength="140" value="${echapper(s.titre)}" data-i="${i}" aria-label="Sous-tâche">
    <button type="button" class="icone suppr" data-sact="suppr" data-i="${i}" aria-label="Supprimer la sous-tâche">✕</button>
  </div>`).join('');
}
function ajouterSousEdition(){
  const champ = $('editSousNouvelle'), titre = champ.value.trim();
  if(!titre) return;
  if(sousEdition.length >= MAX_SOUS){ toast(`${MAX_SOUS} sous-tâches maximum`, 'alerte'); return; }
  sousEdition.push({ id:nouvelId(), titre:titre.slice(0,140), fait:false });
  champ.value = '';
  dessinerSousEdition();
  champ.focus();
}
$('editSousNouvelle').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); ajouterSousEdition(); } });
$('editSous').addEventListener('input', e=>{
  const i = e.target.dataset.i;
  if(i !== undefined && sousEdition[i]) sousEdition[i].titre = e.target.value;
});
$('editSous').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); $('editSousNouvelle').focus(); } });
$('editSous').addEventListener('click', e=>{
  const b = e.target.closest('[data-sact]');
  if(!b) return;
  const i = Number(b.dataset.i);
  if(b.dataset.sact === 'fait') sousEdition[i].fait = !sousEdition[i].fait;
  else sousEdition.splice(i, 1);
  dessinerSousEdition();
});

$('editTitre').addEventListener('keydown', e=>{ if(e.key === 'Enter') $('editValider').click(); });

// --- Fermeture des feuilles (clic à côté, Échap) ---
// (Réglages et saisie secrète gèrent la leur : voir reglages.js et securite.js)
document.querySelectorAll('#overlayEdit, #overlayObjectif').forEach(o=>{
  o.addEventListener('click', e=>{ if(e.target === o){ fermerEdition(); fermerObjectif(); } });
});
document.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ fermerEdition(); fermerObjectif(); } });

// --- Journal : filtres ; groupes : replier et « Voir les autres » ---
$('liste').addEventListener('click', e=>{
  const g = e.target.closest('[data-gtoggle]'), p = e.target.closest('[data-gplus]'), b = e.target.closest('[data-jfiltre]');
  if(g){
    basculerGroupe(g.dataset.gtoggle); rendre();
  } else if(p){
    const k = p.dataset.gplus;
    if(groupesEtendus.has(k)) groupesEtendus.delete(k); else groupesEtendus.add(k);
    rendre();
  } else if(b){
    filtreJournal = b.dataset.jfiltre;
    rendre();
  }
});


// Le bouton flottant n'apparaît que lorsque le formulaire d'ajout n'est plus visible
if('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>$('fab').classList.toggle('visible', !e.isIntersecting)).observe($('formAjout'));
} else $('fab').classList.add('visible');

// Bouton flottant « + » : ramène en haut et ouvre la saisie d'une nouvelle tâche
$('fab').addEventListener('click', ()=>{
  ouvrirEdition(construireBrouillon($('inputTitre').value.trim()), true); // ouvre la fiche d'ajout complète
});
