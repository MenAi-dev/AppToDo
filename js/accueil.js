// Écran de bienvenue au lancement de l'appli : logo animé, salutation selon l'heure, prénom lettre par lettre,
// résumé de la journée, puis transition vers l'interface. Toucher l'écran le passe.
// Sans prénom enregistré, il est demandé la première fois. Avec un code PIN, l'accueil joue après le déverrouillage.
(function(){
  const s = $('splash'), racine = document.documentElement;
  if(!s || !racine.classList.contains('avec-splash')) return;
  const rapide = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOGO = '<div class="sp-logo" aria-hidden="true"><svg viewBox="0 0 64 64"><path class="sp-coche" d="M18 33l9 9 19-21"/></svg></div>';

  function salutation(){
    const h = new Date().getHours();
    return h >= 5 && h < 12 ? 'Bonjour' : h >= 12 && h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }
  // Une phrase sur la journée qui commence : nombre de tâches et grenouille
  function resume(){
    try{
      const { jour, plan } = planDuJour();
      const n = jour.filter(t => !t.fait).length, g = plan.grande.afaire[0];
      if(!n) return 'Ta journée est libre. Choisis ta grenouille et commence.';
      return `${n} tâche${n > 1 ? 's' : ''} aujourd'hui${g ? ` · la grenouille : ${echapper(g.titre)}` : ''}`;
    }catch(_){ return ''; }
  }

  let fini = false;
  function fermer(){
    if(fini) return;
    fini = true;
    s.classList.add('sortie');
    setTimeout(() => {
      racine.classList.remove('avec-splash');
      s.remove();
      document.body.classList.remove('entree'); void document.body.offsetWidth; document.body.classList.add('entree');
    }, rapide ? 50 : 520);
  }

  function jouer(){
    const nom = reglagesTheme.prenom;
    const lettres = [...nom].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : echapper(c)}</span>`).join('');
    s.innerHTML = `<div class="sp-boite">
        ${LOGO}
        <div class="sp-salut">${salutation()}${nom ? ',' : ''}</div>
        ${nom ? `<div class="sp-nom" aria-label="${echapper(nom)}">${lettres}</div>` : ''}
        <div class="sp-sous">${resume()}</div>
        <div class="sp-barre"><i></i></div>
      </div>`;
    s.classList.add('joue');
    setTimeout(() => vibrer(10), rapide ? 0 : 900);
    setTimeout(fermer, rapide ? 900 : 2700 + Math.min(nom.length, 14) * 45);
    s.addEventListener('click', fermer);
  }

  // Première fois : on demande le prénom
  function demanderPrenom(){
    s.innerHTML = `<form class="sp-boite sp-form" id="spForm" autocomplete="off">
        ${LOGO}
        <div class="sp-salut">Bienvenue</div>
        <div class="sp-question">Comment t'appelles-tu ?</div>
        <input id="spNom" type="text" maxlength="30" placeholder="Ton prénom" autocomplete="given-name" enterkeyhint="go">
        <button class="btn-valider" type="submit">Continuer</button>
        <button class="lien-discret" type="button" id="spPasser">Plus tard</button>
      </form>`;
    setTimeout(() => { const c = $('spNom'); if(c) c.focus(); }, 700);
    $('spForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('spNom').value.trim().slice(0, 30);
      if(!v){ $('spNom').focus(); return; }
      reglagesTheme.prenom = v;
      enregistrerTheme();
      rendre(); // l'en-tête affiche « Bonjour … »
      jouer();
    });
    $('spPasser').addEventListener('click', jouer);
  }

  function lancer(){ reglagesTheme.prenom ? jouer() : demanderPrenom(); }

  // Avec un code PIN : l'accueil attend le déverrouillage
  if(racine.classList.contains('verrouille')){
    const mo = new MutationObserver(() => { if(!racine.classList.contains('verrouille')){ mo.disconnect(); lancer(); } });
    mo.observe(racine, { attributes:true, attributeFilter:['class'] });
  } else lancer();
})();
