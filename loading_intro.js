/* The loading movie is independent of the engine and never gates startup. */
globalThis.GTALoadingIntro = {
  mount(loading, enabled = true, onEnded = () => {}, soundControl = null) {
    if (!enabled) return { stop() {}, hold() {} };
    const style = document.createElement('style');
    style.textContent = `
      #loading.intro-playing #ls-screens, #loading.intro-playing #ls-logo { visibility:hidden; }
      #loading.intro-playing #ls-stage { z-index:2; pointer-events:none; }
      #loading.intro-playing #ls-bars { pointer-events:auto; }
      #loading.intro-playing #ls-log, #loading.intro-playing #bar { z-index:3; }
      #loading-intro { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:1;pointer-events:none; }
      #intro-controls { position:absolute;top:16px;left:16px;z-index:3;display:flex;gap:8px; }
      #intro-controls button { color:#fff;background:#000b;border:1px solid #777;border-radius:4px;padding:7px 12px;cursor:pointer; }
      #intro-start { position:fixed;left:50%;top:50%;transform:translate(-50%,-50%); }
    `;
    document.head.append(style);
    const video = document.createElement('video');
    video.controls = false; video.id = 'loading-intro'; video.muted = false; video.volume = 0.5; video.playsInline = true;
    soundControl?.bindIntro(video);
    video.preload = 'metadata'; video.src = '/branding/rockstar-logos-av1.mp4';
    const controls = document.createElement('div'); controls.id = 'intro-controls';
    const skip = document.createElement('button'); skip.textContent = 'Skip intro';
    const start = document.createElement('button'); start.id = 'intro-start'; start.textContent = 'Play intro with sound'; start.hidden = true;
    controls.append(start, skip); loading.append(video, controls);
    let stopped = false, holding = false;
    const stop = () => {
      if (stopped) return;
      stopped = true; soundControl?.bindIntro(null); video.pause(); video.removeAttribute('src'); video.load();
      loading.classList.remove('intro-playing'); video.remove(); controls.remove(); style.remove();
    };
    skip.onclick = event => { event.stopPropagation(); stop(); onEnded(); };
    video.addEventListener('playing', () => { start.hidden = true; if (!stopped) loading.classList.add('intro-playing'); });
    const finish = () => { stop(); onEnded(); };
    video.addEventListener('ended', finish);
    video.addEventListener('error', finish);
    const rejected = error => {
      if (stopped || holding) return;
      if (error?.name !== 'NotAllowedError') { finish(); return; }
      start.hidden = false; soundControl?.blockedIntro(video);
    };
    start.onclick = event => { event.stopPropagation(); if (!stopped && !holding) video.play().catch(rejected); };
    try { video.play().catch(rejected); } catch (error) { rejected(error); }
    return { stop, hold() { holding = true; start.hidden = true; soundControl?.bindIntro(null); if (!stopped) video.pause(); } };
  }
};
