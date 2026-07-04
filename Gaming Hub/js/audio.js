/* -------------------------------------------------------------
   GAMING HUB - WEB AUDIO SYNTHESIZER
------------------------------------------------------------- */

(function() {
  let audioCtx = null;
  let soundEnabled = true;

  function initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!audioCtx) {
          audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }
    } catch (e) {
      console.warn("Failed to initialize AudioContext:", e);
    }
  }

  // Helper to trigger a synthesizer sound
  function playSound(type) {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      
      switch (type) {
        case 'deal':
          playDealSound();
          break;
        case 'chip':
          playChipSound();
          break;
        case 'check':
          playCheckSound();
          break;
        case 'fold':
          playFoldSound();
          break;
        case 'win':
          playWinSound();
          break;
      }
    } catch (e) {
      console.warn("Web Audio API not supported or context block active:", e);
    }
  }

  // Synthesizes a soft friction card sweep
  function playDealSound() {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.16);
  }

  // Synthesizes a high-frequency plastic chip clink
  function playChipSound() {
    // We combine two short high-pitch triangle oscillators to sound like chip clinking
    const now = audioCtx.currentTime;
    
    // First click
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2500, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start();
    osc1.stop(now + 0.05);

    // Second slightly delayed clink to simulate rattle
    setTimeout(() => {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      const now2 = audioCtx.currentTime;
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2200, now2);
      gain2.gain.setValueAtTime(0.08, now2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.03);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc2.start();
      osc2.stop(now2 + 0.04);
    }, 20);
  }

  // Synthesizes a wood-like double tap for check
  function playCheckSound() {
    const tap = (delay) => {
      const now = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.09);
    };

    tap(0);
    tap(0.12);
  }

  // Synthesizes a soft rustle for fold
  function playFoldSound() {
    const bufferSize = audioCtx.sampleRate * 0.15; // 0.15s duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
    filter.Q.setValueAtTime(1.5, audioCtx.currentTime);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noiseNode.start();
    noiseNode.stop(audioCtx.currentTime + 0.16);
  }

  // Plays a short triumphant fanfare (C4 -> E4 -> G4 -> C5)
  function playWinSound() {
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const durations = [0.12, 0.12, 0.12, 0.4];
    let startOffset = 0;

    notes.forEach((freq, idx) => {
      const now = audioCtx.currentTime + startOffset;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durations[idx]);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + durations[idx] + 0.05);
      
      startOffset += 0.12;
    });
  }

  // Export audio library to global window object
  window.GamingHubAudio = {
    play: playSound,
    init: initAudioContext,
    toggle: () => {
      soundEnabled = !soundEnabled;
      return soundEnabled;
    },
    isEnabled: () => soundEnabled
  };
})();
