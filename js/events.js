let nouvelleDate = '';
let nouvelImportant = false;
let nouvelleRepet = '';
let sousEdition = []; // brouillon des sous-tâches pendant que la modale est ouverte
let nouvelleCat = '';
let ignorerAuto = false; // l'utilisateur refuse la détection automatique pour cette saisie
let tacheEnEdition = null;

// --- Ajout rapide ---
function majOptionsAjout(){
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

$('formAjout').addEventListener('submit', e=>{
  e.preventDefault();
  const saisie = $('inputTitre').value.trim();
  if(!saisie){ $('inputTitre').focus(); return; }
  // Les puces choisies à la main passent avant ce qui est détecté dans le texte
  const auto = ignorerAuto ? null : analyserSaisie(saisie);
  const detecte = !!(auto && auto.trouve);
  const titre = detecte ? auto.titre : saisie;
  const important = nouvelImportant || (detecte && auto.important);
  const repeter = nouvelleRepet || (detecte ? auto.repeter : '');
  const cat = nouvelleCat || (detecte && auto.cat ? canoniqueCat(auto.cat) : '');
  let date = nouvelleDate || (detecte ? auto.date : '');
  if(repeter && !date) date = auj();
  const heure = (detecte && auto.heure && date) ? auto.heure : '';
  taches.push({ id:nouvelId(), titre, fait:false, important, date, heure, avance:null, notifie:false, vu:false, repeter, cat, suiteId:'', sous:[], creeLe:Date.now(), faitLe:null });
  noter('ajout', titre, date ? libelleDate(date) : '');
  sauvegarder();
  $('inputTitre').value = '';
  reinitialiserOptions();
  if(requete) fermerRecherche(); // la nouvelle tâche doit rester visible
  if(filtre !== 'afaire') basculerFiltre('afaire'); else rendre();
  $('inputTitre').focus(); // garde le clavier ouvert pour enchaîner
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

// --- Actions sur la liste ---
$('liste').addEventListener('click', e=>{
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const act = el.dataset.act;

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
    reporterTaches(taches.filter(t=>!t.fait && t.date && t.date < aujourdhui && (!filtreCat || memeCat(t, filtreCat))), 0);
    return;
  }

  if(act === 'objectif'){ ouvrirObjectif(); return; }
  if(act === 'vider-journal'){
    if(!journal.length || !confirm('Effacer tout le journal ? Tes tâches ne sont pas touchées.')) return;
    viderJournal(); rendre(); toast('Journal effacé');
    return;
  }
  if(act === 'rec-edit' || act === 'rec-stop'){
    const rt = taches.find(x=>x.id === el.closest('.rec-ligne').dataset.id);
    if(!rt) return;
    if(act === 'rec-edit'){ ouvrirEdition(rt); return; }
    const ancienne = rt.repeter;
    rt.repeter = '';
    sauvegarder(); rendre();
    toast('Répétition arrêtée', '', { label:'Annuler', fn:()=>{ rt.repeter = ancienne; sauvegarder(); rendre(); } });
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
      suivante = { id:nouvelId(), titre:t.titre, fait:false, important:t.important,
        date:prochaineDate(t.date, t.repeter), heure:t.heure || '', avance:t.avance, notifie:false, vu:false, repeter:t.repeter, suiteId:'', creeLe:Date.now(), faitLe:null,
        cat:t.cat || '', note:t.note || '', sous:(t.sous || []).map(s=>({ id:nouvelId(), titre:s.titre, fait:false })) }; // checklist remise à zéro
      taches.push(suivante);
      t.suiteId = suivante.id;
    }
    noter('fait', t.titre);
    vibrer(10);
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

// --- Modifier une tâche ---
function ouvrirEdition(t){
  tacheEnEdition = t.id;
  $('editTitre').value = t.titre;
  $('editDate').value = t.date;
  $('editHeure').value = t.heure || '';
  $('editAvance').value = t.avance === null || t.avance === undefined ? avanceDefaut : t.avance;
  majChampHeure();
  $('editImportant').value = t.important ? '1' : '0';
  $('editRepeter').value = t.repeter || '';
  $('editCat').value = t.cat || '';
  $('editNote').value = t.note || '';
  $('listeCats').innerHTML = toutesCategories().map(c=>`<option value="${echapper(c)}">`).join('');
  sousEdition = (t.sous || []).map(s=>({ ...s }));
  dessinerSousEdition();
  $('editSousNouvelle').value = '';
  $('overlayEdit').classList.add('actif');
}
function fermerEdition(){ $('overlayEdit').classList.remove('actif'); tacheEnEdition = null; }

$('editAnnuler').addEventListener('click', fermerEdition);

// --- Rappels : champ heure + minutes d'avance ---
function majChampHeure(){
  const date = $('editDate').value;
  $('editHeure').disabled = !date;
  if(!date) $('editHeure').value = '';
  $('blocAvance').hidden = !$('editHeure').value;
  $('aideRappel').textContent = $('editHeure').value ? aideNotification() : '';
}
$('editDate').addEventListener('change', majChampHeure);
$('editHeure').addEventListener('input', majChampHeure);

$('editValider').addEventListener('click', ()=>{
  const t = taches.find(x=>x.id === tacheEnEdition);
  const titre = $('editTitre').value.trim();
  if(!t) return fermerEdition();
  if(!titre){ toast('Le texte ne peut pas être vide', 'alerte'); return; }
  t.titre = titre;
  const avantRappel = [t.date, t.heure, t.avance].join('|');
  t.date = $('editDate').value;
  t.heure = t.date ? $('editHeure').value : '';
  if(t.heure){
    const av = parseInt($('editAvance').value, 10);
    t.avance = av >= 0 && av <= 1440 ? av : null;
    if(t.avance !== null) enregistrerAvanceDefaut(t.avance); // sert de valeur proposée la prochaine fois
    demanderNotifications();
  } else t.avance = null;
  if([t.date, t.heure, t.avance].join('|') !== avantRappel){ t.notifie = false; t.vu = false; }
  t.important = $('editImportant').value === '1';
  const nouvelle = $('editSousNouvelle').value.trim();
  if(nouvelle && sousEdition.length < MAX_SOUS) sousEdition.push({ id:nouvelId(), titre:nouvelle.slice(0,140), fait:false });
  t.sous = nettoyerSous(sousEdition);
  t.cat = canoniqueCat($('editCat').value);
  t.note = $('editNote').value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE);
  t.repeter = $('editRepeter').value;
  if(t.repeter && !t.date) t.date = auj();
  sauvegarder(); rendre(); fermerEdition();
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

// --- Journal : filtres ---
$('liste').addEventListener('click', e=>{
  const b = e.target.closest('[data-jfiltre]');
  if(!b) return;
  filtreJournal = b.dataset.jfiltre;
  rendre();
});


// Le bouton flottant n'apparaît que lorsque le formulaire d'ajout n'est plus visible
if('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>$('fab').classList.toggle('visible', !e.isIntersecting)).observe($('formAjout'));
} else $('fab').classList.add('visible');

// Bouton flottant « + » : ramène en haut et ouvre la saisie d'une nouvelle tâche
$('fab').addEventListener('click', ()=>{
  window.scrollTo({ top:0, behavior:'smooth' });
  setTimeout(()=> $('inputTitre').focus(), 250);
});
