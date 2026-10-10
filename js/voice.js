/* English Arena — micro anti-bruit (Web Audio, 100 % dans le navigateur, aucun serveur).
 * Chaîne : micro (suppression de bruit/écho du navigateur) → filtre passe-haut 110 Hz (supprime ventilos, vent, vibrations)
 *          → filtre passe-bas 7 kHz (supprime les sifflements) → porte de bruit adaptative (calibrée sur le silence de la pièce)
 *          → compresseur (voix régulière) → enregistrement / piste propre.
 * Limite honnête : la reconnaissance vocale du navigateur (Chrome) choisit parfois elle-même le micro ; le nettoyage
 * est garanti pour le niveau, les conseils et l'enregistrement « Réécouter ». */
(function () {
  let ctx = null, stream = null, timer = null, dest = null, gate = null, an = null, buf = null;
  let cb = {}, opened = false, calibrating = false, calSamples = [], calStart = 0;
  let floor = 0.01, thr = 0.02, lastVoice = 0, recorder = null, chunks = [], recTimeout = null, lastUrl = null;

  const rms = () => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };
  const say = t => cb.onStatus && cb.onStatus(t);

  function advice(r) {
    if (calibrating) return 'Calibrage… reste silencieux 1 seconde 🤫';
    if (r > 0.4) return '⚠️ Trop fort : éloigne un peu le micro.';
    if (floor > 0.05) return '🔊 Très bruyant autour de toi : va dans un coin calme ou parle à 10 cm du micro.';
    if (floor > 0.02) return '🟠 Un peu de bruit de fond (filtré). Parle près du micro.';
    return '🟢 Environnement calme. Tu peux parler.';
  }

  async function open(callbacks) {
    if (callbacks) cb = callbacks;
    if (opened) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Micro non disponible sur ce navigateur.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC(); if (ctx.resume) await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110; hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    an = ctx.createAnalyser(); an.fftSize = 1024; buf = new Float32Array(an.fftSize);
    gate = ctx.createGain(); gate.gain.value = 0.12;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    const makeup = ctx.createGain(); makeup.gain.value = 1.6;
    dest = ctx.createMediaStreamDestination();
    src.connect(hp); hp.connect(lp); lp.connect(an); lp.connect(gate); gate.connect(comp); comp.connect(makeup); makeup.connect(dest); // jamais vers les haut-parleurs : pas de larsen
    opened = true; calibrating = true; calSamples = []; calStart = Date.now();
    timer = setInterval(tick, 40);
  }

  function tick() {
    const r = rms(), now = Date.now();
    if (calibrating) {
      calSamples.push(r);
      if (now - calStart > 1200) {
        calSamples.sort((a, b) => a - b);
        floor = calSamples[Math.floor(calSamples.length * 0.8)] || 0.005; // 80e percentile du silence
        thr = Math.max(floor * 2.4, 0.01); calibrating = false;
      }
    } else if (r > thr) {
      lastVoice = now; gate.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
    } else if (now - lastVoice > 300) {
      gate.gain.setTargetAtTime(0.12, ctx.currentTime, 0.08);
    }
    if (cb.onLevel) cb.onLevel(Math.min(100, Math.round(Math.sqrt(r) * 140)), r > thr && !calibrating);
    say(advice(r));
  }

  function recalibrate() { if (opened) { calibrating = true; calSamples = []; calStart = Date.now(); } }
  function cleanTrack() { return opened && dest ? dest.stream.getAudioTracks()[0] : null; }

  function startRecording() {
    if (!opened) throw new Error('Active d’abord le micro.');
    if (typeof MediaRecorder === 'undefined') throw new Error('Enregistrement non supporté ici.');
    chunks = [];
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(dest.stream, type ? { mimeType: type } : undefined);
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
    recTimeout = setTimeout(() => { if (recorder && recorder.state === 'recording') recorder.stop(); }, 60000); // 60 s max
  }
  function stopRecording() {
    return new Promise(resolve => {
      if (!recorder || recorder.state !== 'recording') return resolve(lastUrl);
      recorder.onstop = () => {
        clearTimeout(recTimeout);
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        resolve(lastUrl);
      };
      recorder.stop();
    });
  }
  const isRecording = () => !!recorder && recorder.state === 'recording';
  const isOpen = () => opened;

  function close() {
    clearInterval(timer); clearTimeout(recTimeout);
    try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (_) {}
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    ctx = stream = dest = gate = an = recorder = null; opened = false; calibrating = false;
  }
  window.EAVoice = { open, close, recalibrate, cleanTrack, startRecording, stopRecording, isRecording, isOpen };
})();
