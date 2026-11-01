// Page « Stock » : tout ce qui n'est pas pour aujourd'hui ni demain.
//  - AUTOMATIQUE : les tâches datées après demain. Elles passent seules dans « À faire » la veille de leur jour.
//  - À la main : les tâches mises de côté (idées, « un jour »…), jusqu'à ce qu'on les remette à faire.
// Rien n'est supprimé : le stock sert à garder l'écran « À faire » léger.
function htmlStock(tous, liste, demain){
  if(!tous.length){
    return `<div class="vide"><b>Le stock est vide</b>Les tâches datées après demain arrivent ici toutes seules, et passent dans « À faire » la veille de leur jour. Tu peux aussi y ranger une tâche à la main : ouvre-la, puis « Mettre en stock ».</div>`;
  }
  if(!liste.length){
    return `<div class="vide"><b>Rien en stock dans « ${echapper(filtreCat)} »</b>Choisis « Toutes » pour tout revoir.</div>`;
  }
  const auto = liste.filter(t => !t.stock).sort(trier);
  const main = liste.filter(t => t.stock);
  let html = `<div class="stock-info">Tout ce qui n'est pas pour aujourd'hui est rangé ici automatiquement. Chaque tâche revient dans « À faire » le jour venu.</div>`;

  // 1. Jours suivants (automatique) : un groupe par jour (repliés au-delà de demain), puis les tâches sans date
  const datees = auto.filter(t => t.date), sansDate = auto.filter(t => !t.date);
  const jours = [...new Set(datees.map(t => t.date))].sort();
  if(auto.length){
    html += `<div class="stock-titre">À venir · ${auto.length}</div>`;
    html += jours.map(j => htmlGroupe(titreJour(j), datees.filter(t => t.date === j), '', '', null, 'j-' + j)).join('');
    html += htmlGroupe('Sans date', sansDate, '', '', null, 'sansdate');
  }

  // 2. Mises de côté à la main : par catégorie, chacune repliable
  if(main.length){
    const m = new Map();
    main.sort(trier).forEach(t => { const c = t.cat ? canoniqueCat(t.cat) : ''; if(!m.has(c)) m.set(c, []); m.get(c).push(t); });
    const cles = [...m.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fr')));
    const ligne = t => {
      const quand = t.date ? libelleDate(t.date) : 'Sans date';
      const rep = t.repeter ? ` · 🔁 ${LIBELLES_REPET[t.repeter]}` : '';
      return `<div class="rec-ligne" data-id="${echapper(t.id)}">
        <button class="rec-corps" type="button" data-act="stock-edit">
          <span class="rec-titre">${echapper(t.titre)}</span>
          <span class="rec-meta">${echapper(quand)}${rep}</span>
        </button>
        <button class="pill-report pill-ok" type="button" data-act="stock-remettre">Remettre</button>
      </div>`;
    };
    html += `<div class="stock-titre">Mises de côté · ${main.length}
      <button class="lien-discret neutre" type="button" data-act="stock-tout">Tout remettre à faire</button></div>`;
    html += cles.map(c => {
      const l = m.get(c), cle = 's-' + cleCat(c || '_');
      const replie = groupeReplie(cle);
      const titre = c ? `<i class="pt" style="background:${couleurCat(c)}"></i>${echapper(c)}` : 'Sans catégorie';
      const etendu = groupesEtendus.has(cle);
      const vis = etendu ? l : l.slice(0, 8), reste = l.length - vis.length;
      return `<div class="groupe"><div class="groupe-titre"><button class="groupe-toggle" type="button" data-gtoggle="${cle}" aria-expanded="${!replie}"><span class="chevron${replie ? ' ferme' : ''}">▾</span><span>${titre}</span><span class="groupe-nb">${l.length}</span></button></div>
        ${replie ? '' : `<div class="groupe-liste">${vis.map(ligne).join('')}</div>${l.length > 8 ? `<button class="voir-plus" type="button" data-gplus="${cle}">${etendu ? 'Réduire ▴' : `Voir les ${reste} autre${reste>1?'s':''} ▾`}</button>` : ''}`}</div>`;
    }).join('');
  }
  return html;
}

// Mettre en stock / remettre à faire (avec « Annuler »)
function mettreEnStock(t){
  t.stock = true;
  noter('stock', t.titre);
  sauvegarder(); rendre();
  toast('Mise en stock', '', { label:'Annuler', fn:()=>{ t.stock = false; sauvegarder(); rendre(); } });
}
function remettreDuStock(liste){
  if(!liste.length) return;
  liste.forEach(t => { t.stock = false; t.notifie = false; t.vu = false; });
  noter('destock', liste.length > 1 ? `${liste.length} tâches` : liste[0].titre);
  sauvegarder(); rendre();
  toast(liste.length > 1 ? `${liste.length} tâches remises à faire` : 'Remise à faire', '', { label:'Annuler', fn:()=>{ liste.forEach(t => { t.stock = true; }); sauvegarder(); rendre(); } });
}
