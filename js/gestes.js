// Gestes tactiles sur une tâche : glisser vers la droite = terminer / rouvrir, vers la gauche = supprimer
(function(){
  const liste = $('liste');
  let g = null;              // geste en cours
  let blocageClic = 0;       // horodatage de la fin du dernier glissement (pour ignorer le « clic » fantôme)

  const seuil = largeur => Math.min(110, largeur * 0.3);

  function appliquer(dx){
    const max = g.largeur;
    dx = Math.max(-max, Math.min(max, dx));
    g.dx = dx;
    const l = g.ligne;
    l.style.setProperty('--dx', dx + 'px');
    l.classList.toggle('glisse-d', dx > 0);
    l.classList.toggle('glisse-g', dx < 0);
    const arme = Math.abs(dx) >= seuil(max);
    if(arme && !g.arme) vibrer(8);
    g.arme = arme;
    l.classList.toggle('arme', arme);
  }

  function nettoyer(l){
    l.classList.remove('glisse','glisse-d','glisse-g','arme','rebond','part');
    l.style.removeProperty('--dx');
  }

  function terminer(valider){
    const { ligne, id, dx, largeur } = g;
    g = null;
    blocageClic = Date.now();
    if(valider){
      ligne.classList.add('part');
      ligne.style.setProperty('--dx', (dx > 0 ? largeur : -largeur) + 'px');
      setTimeout(()=>{
        const t = taches.find(x => x.id === id);
        nettoyer(ligne);
        if(!t) return;
        if(dx > 0) basculerFait(t); else supprimerTache(id);
      }, 190);
    } else {
      ligne.classList.add('rebond');
      ligne.style.setProperty('--dx', '0px');
      setTimeout(()=>nettoyer(ligne), 230);
    }
  }

  liste.addEventListener('pointerdown', e=>{
    if(e.pointerType === 'mouse') return;            // sur ordinateur : les boutons suffisent
    const ligne = e.target.closest('.tache');
    if(!ligne || g) return;
    g = { ligne, id:ligne.dataset.id, x0:e.clientX, y0:e.clientY, dx:0, actif:false, arme:false, largeur:ligne.offsetWidth, pid:e.pointerId };
  });

  liste.addEventListener('pointermove', e=>{
    if(!g || e.pointerId !== g.pid) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if(!g.actif){
      if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5){
        g.actif = true;
        g.ligne.classList.add('glisse');
        try{ g.ligne.setPointerCapture(e.pointerId); }catch(_){}
      } else if(Math.abs(dy) > 10){ g = null; return; } // défilement vertical : on laisse faire
      else return;
    }
    appliquer(dx);
  });

  liste.addEventListener('pointerup', e=>{
    if(!g || e.pointerId !== g.pid) return;
    if(!g.actif){ g = null; return; }
    terminer(g.arme);
  });
  liste.addEventListener('pointercancel', e=>{
    if(!g || e.pointerId !== g.pid) return;
    if(!g.actif){ g = null; return; }
    terminer(false);
  });

  // Après un glissement, le navigateur envoie un clic : on l'ignore (sinon il ouvre la tâche ou la coche)
  liste.addEventListener('click', e=>{
    if(Date.now() - blocageClic < 400){ e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
