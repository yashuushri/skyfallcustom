// Web Audio API Synthesized Sound Effects for Spyfall Custom
// Inspired by immersive space-mystery games (Among Us style alerts, stabs, and sweeps).
// Zero-latency, fully dynamic Web Audio API synthesis. No external assets required.

class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxVolume: number = 0.55;
  private isMuted: boolean = false;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setVolume(volume: number) {
    this.sfxVolume = volume;
  }

  /**
   * Universal synth sound helper with pitch & volume envelopes
   */
  private createOscillator(
    type: OscillatorType,
    freq: number,
    duration: number,
    gainValues: number[],
    freqValues?: number[]
  ) {
    if (this.isMuted) return null;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return null;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Pitch sweep / glide
      if (freqValues && freqValues.length > 0) {
        const step = duration / (freqValues.length - 1);
        freqValues.forEach((f, i) => {
          osc.frequency.exponentialRampToValueAtTime(f, this.ctx!.currentTime + i * step);
        });
      }

      // Volume envelope
      gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      const stepGain = duration / (gainValues.length - 1);
      gainValues.forEach((g, i) => {
        gainNode.gain.linearRampToValueAtTime(g * this.sfxVolume, this.ctx!.currentTime + i * stepGain);
      });
      gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Premium Short digital tick / click
   */
  playClick() {
    this.init();
    // High frequency short blip
    this.createOscillator('sine', 1600, 0.05, [0, 0.35, 0]);
  }

  /**
   * Sweet spatial upward double chime (Lobby join)
   */
  playJoin() {
    this.init();
    const now = this.ctx ? this.ctx.currentTime : 0;
    // Layered chord for deep sci-fi atmosphere
    this.createOscillator('triangle', 330, 0.25, [0, 0.4, 0]); // E4
    setTimeout(() => {
      this.createOscillator('sine', 440, 0.3, [0, 0.45, 0]); // A4
    }, 60);
    setTimeout(() => {
      this.createOscillator('sine', 659.25, 0.45, [0, 0.5, 0]); // E5
    }, 120);
  }

  /**
   * Futuristic warning countdown pulse
   */
  playCountdown() {
    this.init();
    // Warm synth pulse with slight downward decay
    this.createOscillator('triangle', 480, 0.18, [0, 0.5, 0], [480, 440]);
  }

  /**
   * Card Flip - Interactive dossier reveal swoop
   */
  playCardFlip() {
    this.init();
    // Fast frequency sweep mimicking card swooshing open
    this.createOscillator('sine', 180, 0.25, [0, 0.5, 0], [180, 800]);
  }

  /**
   * Classic Emergency Meeting / Warning buzz
   */
  playWarning() {
    this.init();
    if (!this.ctx) return;
    // Dissonant dual saw frequencies representing threat/alarm
    const baseFreq = 196.00; // G3
    this.createOscillator('sawtooth', baseFreq, 0.3, [0, 0.45, 0]);
    this.createOscillator('sawtooth', baseFreq * 1.05, 0.3, [0, 0.4, 0]); // Clashing interval
  }

  /**
   * High-tech cyber lock-in for votes
   */
  playVoteReveal() {
    this.init();
    // Cyber sweep
    this.createOscillator('sine', 440, 0.25, [0, 0.4, 0], [440, 880]);
  }

  /**
   * Shhh! / Alien Spy Reveal stab (Suspenseful dissonant clash)
   */
  playSpyReveal() {
    this.init();
    if (!this.ctx) return;
    
    // Eerie high dissonant chord + low impact sub
    const lowFreq = 87.31; // F2 Sub-impact
    const chord1 = 293.66; // D4
    const chord2 = 311.13; // D#4 (Highly clashing minor second!)
    const chord3 = 415.30; // G#4 (Tritone!)

    // Sub rumble
    this.createOscillator('sawtooth', lowFreq, 0.9, [0, 0.7, 0.3, 0], [lowFreq, lowFreq * 0.9]);
    
    // Clashing mids
    setTimeout(() => {
      this.createOscillator('sawtooth', chord1, 0.8, [0, 0.5, 0.2, 0]);
      this.createOscillator('sine', chord2, 0.8, [0, 0.45, 0.15, 0]);
      this.createOscillator('triangle', chord3, 0.8, [0, 0.5, 0.2, 0]);
    }, 20);

    // Dynamic warning ping sequence
    setTimeout(() => {
      this.createOscillator('sawtooth', 220, 0.4, [0, 0.4, 0], [220, 110]);
    }, 400);
  }

  /**
   * Uplifting victorious sci-fi fanfare (Major chord sweep)
   */
  playVictory() {
    this.init();
    // High speed rising notes ending in major chord
    const scale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major scale up to G5
    scale.forEach((freq, idx) => {
      setTimeout(() => {
        this.createOscillator('triangle', freq, 0.35, [0, 0.4, 0]);
      }, idx * 100);
    });
  }

  /**
   * Dark eerie cosmic defeat (Sub-octave drop + heavy tension)
   */
  playDefeat() {
    this.init();
    if (!this.ctx) return;

    // Dark descending doom chords
    const notes = [146.83, 110.00, 73.42]; // D3 -> A2 -> D2
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        // Heavy saw synth for classic failure buzz
        this.createOscillator('sawtooth', freq, 0.6, [0, 0.5, 0.1, 0], [freq, freq * 0.85]);
        this.createOscillator('sine', freq * 1.5, 0.5, [0, 0.3, 0]);
      }, idx * 180);
    });
  }
}

export const soundManager = new SoundManager();
