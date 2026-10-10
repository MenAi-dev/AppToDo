// Onglet « Répétées » : toutes les tâches qui se répètent, regroupées par rythme.
// Chaque ligne permet de modifier la tâche ou d'arrêter sa répétition.
function htmlRecurrentes(){
  const liste = taches.filter(t => !t.archive && !t.fait && t.repeter);
  if(!liste.length){
    return '<div class="vide"><b>Aucune tâche répétée</b>Touche « 🔁 Répéter » en ajoutant une tâche : elle se recrée toute seule après chaque fois (chaque jour, semaine ou mois).</div>';
  }
  const ordre = ['jour', 'semaine', 'mois'];
  return ordre.map(r => {
    const l = liste.filter(t => t.repeter === r).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if(!l.length) return '';
    return `<div class="groupe"><div class="groupe-titre"><span>${LIBELLES_REPET[r]}</span><span>${l.length}</span></div>
      <div class="groupe-liste">${l.map(t => {
        const enRetard = t.date && t.date < auj();
        const quand = t.date ? `${enRetard ? 'En retard · ' : 'Prochaine : '}${libelleDate(t.date).toLowerCase()}${t.heure ? ' · 🔔 ' + t.heure : ''}` : 'Sans date';
        const tag = t.cat ? ` · <span class="cat-tag" style="--c:${couleurCat(t.cat)}"><i></i>${echapper(t.cat)}</span>` : '';
        return `<div class="rec-ligne" data-id="${echapper(t.id)}">
          <button class="rec-corps" type="button" data-act="rec-edit">
            <span class="rec-titre">${echapper(t.titre)}</span>
            <span class="rec-meta${enRetard ? ' retard' : ''}">${quand}${tag}</span>
          </button>
          <button class="pill-report" type="button" data-act="rec-stop">Arrêter</button>
        </div>`;
      }).join('')}</div></div>`;
  }).join('') + '<div class="aide aide-centre">« Arrêter » garde la tâche mais elle ne se recrée plus.</div>';
}
