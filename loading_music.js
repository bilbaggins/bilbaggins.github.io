globalThis.GTALoadingMusic = {
  mount(loading) {
    // Loading media is automatic UI, not a keyboard/media-session player.
    const mediaKeys=new Set(['MediaPlayPause','MediaPlay','MediaPause','MediaStop','MediaTrackNext','MediaTrackPrevious','MediaFastForward','MediaRewind']);
    const blockMediaKey=event=>{if(mediaKeys.has(event.key)||mediaKeys.has(event.code)){event.preventDefault();event.stopImmediatePropagation();}};
    addEventListener('keydown',blockMediaKey,{capture:true});
    const mediaSession=globalThis.navigator?.mediaSession,blockedActions=[];
    if(mediaSession)for(const action of ['play','pause','stop','seekbackward','seekforward','seekto','previoustrack','nexttrack']){
      try{mediaSession.setActionHandler(action,()=>{});blockedActions.push(action);}catch(_){}
    }
    const audio = document.createElement('audio');
    audio.src = '/branding/loading-music-full.m4a?v=full-426-v1'; audio.loop = true; audio.preload = 'none'; audio.volume = 1;
    const button = globalThis.GTAGameUI?GTAGameUI.button({id:'loading-sound',label:'Loading sound: on'}):document.createElement('button');
    if(!globalThis.GTAGameUI){button.style.cssText='color:#fff;background:#000b;border:1px solid #777;border-radius:4px;padding:7px 12px;cursor:pointer';(document.getElementById('game-page-actions')||loading).append(button);}
    button.textContent = 'Loading sound: on';
    let requested = false, muted = false, finishing = false, stopped = false, prepared = false, fadeTimer, intro = null, introBlocked = false;
    const unlockIntro = () => {
      if (!intro || muted || stopped || finishing) return;
      const video = intro;
      video.muted = false; introBlocked = false; button.textContent = 'Loading sound: on';
      video.play().catch(() => {
        if (intro !== video || stopped || finishing) return;
        introBlocked = true; button.textContent = 'Loading sound: on';
      });
    };
    const play = () => {
      if (!requested || muted || finishing || stopped) return;
      audio.play().then(() => { if (finishing || stopped || muted) audio.pause(); else button.textContent = 'Loading sound: on'; })
        .catch(() => { if (!stopped && !muted) button.textContent = 'Loading sound: on'; });
    };
    // Prepare unmuted music within the SAME gesture as the video, at zero gain.
    // Muted autoplay alone is not proof that later audible playback is allowed.
    const prepareMusic = () => {
      if (prepared || requested || stopped || finishing || muted) return;
      prepared = true; audio.muted = false; audio.volume = 0;
      audio.play().then(() => {
        if (!requested || stopped || finishing || muted) { audio.pause(); if (!stopped) audio.currentTime = 0; }
        if (!finishing && !stopped) audio.volume = 1;
      }).catch(() => { prepared = false; if (!finishing && !stopped) audio.volume = 1; });
    };
    const gesture = event => {
      if (stopped || finishing || muted || event?.target === button) return;
      prepareMusic();
      if (introBlocked) unlockIntro();
      if (requested) play();
    };
    addEventListener('pointerdown', gesture, {capture:true});
    addEventListener('keydown', gesture, {capture:true});
    button.onclick = event => {
      event.stopPropagation();
      if (muted || introBlocked || (intro && (intro.muted || intro.paused)) || (requested && audio.paused)) muted = false;
      else muted = !muted;
      button.textContent = 'Loading sound: ' + (muted ? 'off' : 'on');
      if (intro) intro.muted = muted;
      if (muted) { introBlocked = false; audio.pause(); }
      else { prepareMusic(); if (intro) unlockIntro(); play(); }
    };
    const stop = () => {
      if (stopped) return;
      stopped = true; intro = null; clearInterval(fadeTimer); audio.pause(); audio.removeAttribute('src'); audio.load(); button.remove();
      removeEventListener('keydown',blockMediaKey,{capture:true});
      for(const action of blockedActions)try{mediaSession.setActionHandler(action,null);}catch(_){}
      removeEventListener('pointerdown', gesture, {capture:true});
      removeEventListener('keydown', gesture, {capture:true});
    };
    return {
      bindIntro(video) { intro = video; introBlocked = false; if (video) video.muted = muted; },
      blockedIntro(video) { if (intro === video && !muted && !stopped) { introBlocked = true; button.textContent = 'Loading sound: on'; } },
      start() { if (finishing || stopped) return; requested = true; play(); },
      fadeOut(duration = 1200) {
        if (finishing || stopped) return;
        finishing = true; button.disabled = true;
        const begin = performance.now(), volume = audio.volume;
        fadeTimer = setInterval(() => {
          const fraction = Math.min(1, (performance.now() - begin) / duration);
          audio.volume = volume * (1 - fraction);
          if (fraction >= 1) stop();
        }, 50);
      },
      stop
    };
  }
};
