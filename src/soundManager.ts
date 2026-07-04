// Web Audio API Synthesized Sound Effects for Spyfall Custom
// Expertly engineered to sound like iconic immersive space-mystery games (Among Us style).
// Synthesizes raw waveforms, noise generators, FM modulators, and biquad filters dynamically.
// Zero external asset downloads - fully client-side, zero-latency.

class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxVolume: number = 0.55;
  private isMuted: boolean = false;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying: boolean = false;

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
    if (muted) {
      this.stopAmbientHum();
    } else if (this.isAmbientPlaying) {
      this.playAmbientHum();
    }
  }

  setVolume(volume: number) {
    this.sfxVolume = volume;
    if (this.ambientGain) {
      // Keep ambient hum very subtle (15% of regular volume)
      this.ambientGain.gain.setValueAtTime(this.sfxVolume * 0.15, this.ctx?.currentTime || 0);
    }
  }

  getMuted() {
    return this.isMuted;
  }

  getVolume() {
    return this.sfxVolume;
  }

  getIsAmbientPlaying() {
    return this.isAmbientPlaying;
  }

  /**
   * Generates a brief burst of audio-rate white noise
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.ctx) return new AudioBuffer({ length: 1, sampleRate: 44100 });
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Premium Short digital tick / tactile plastic tap (Among Us UI click)
   */
  playClick() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.035);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.Q.setValueAtTime(1.5, now);

      gain.gain.setValueAtTime(this.sfxVolume * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Uplifting arpeggiated vacuum/hatch door chime (Among Us Lobby Join)
   */
  playJoin() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      // Beautiful retro-futuristic rapid ascending bubbles
      const pitches = [329.63, 392.00, 523.25, 659.25, 783.99]; // E4, G4, C5, E5, G5
      pitches.forEach((freq, idx) => {
        const timeOffset = idx * 0.045;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + timeOffset + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now + timeOffset);
        filter.frequency.exponentialRampToValueAtTime(300, now + timeOffset + 0.15);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.28, now + timeOffset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.2);
      });
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * High-tension submarine warning radar ping (Among Us Countdown ping)
   */
  playCountdown() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;

      // 1. Bass Heartbeat Thud
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(55, now);
      bassOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
      bassGain.gain.setValueAtTime(this.sfxVolume * 0.75, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.13);

      // 2. High Cyber Resonant Ping
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      const pingFilter = this.ctx.createBiquadFilter();

      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(1800, now);
      pingOsc.frequency.exponentialRampToValueAtTime(900, now + 0.25);

      pingFilter.type = 'bandpass';
      pingFilter.frequency.setValueAtTime(1600, now);
      pingFilter.frequency.exponentialRampToValueAtTime(600, now + 0.25);
      pingFilter.Q.setValueAtTime(12.0, now); // Extremely high resonance for metallic ring

      pingGain.gain.setValueAtTime(this.sfxVolume * 0.14, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      pingOsc.connect(pingFilter);
      pingFilter.connect(pingGain);
      pingGain.connect(this.ctx.destination);

      pingOsc.start(now);
      pingOsc.stop(now + 0.26);
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Premium Card Flip / Dossier swipe / pneumatic whoosh
   */
  playCardFlip() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      const duration = 0.25;

      // Noise source
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = this.createNoiseBuffer(duration);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      // Quick pneumatic sliding sound sweep
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(2200, now + duration);
      filter.Q.setValueAtTime(2.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.35, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Layer a quick smooth triangle tone to mimic cardboard sliding friction
      const sweepOsc = this.ctx.createOscillator();
      const sweepGain = this.ctx.createGain();
      sweepOsc.type = 'triangle';
      sweepOsc.frequency.setValueAtTime(140, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(450, now + duration);
      sweepGain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      sweepOsc.connect(sweepGain);
      sweepGain.connect(this.ctx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + duration);
      sweepOsc.start(now);
      sweepOsc.stop(now + duration);
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Iconic Among Us "Emergency Meeting Alert" - Double Pulsing Saw Horn
   */
  playWarning() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      
      // We will play TWO rhythmic, raspy detuned low horn sweeps: "WRAAMP... WRAAMP..."
      const triggerPulse = (startTime: number) => {
        if (!this.ctx) return;
        
        // Detuned massive saw teeth
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(130.81, startTime); // Low C3
        osc1.frequency.linearRampToValueAtTime(146.83, startTime + 0.25); // Slams up to D3
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(131.81, startTime); // Detuned for fat chorus effect
        osc2.frequency.linearRampToValueAtTime(147.83, startTime + 0.25);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, startTime);
        filter.frequency.exponentialRampToValueAtTime(1400, startTime + 0.08); // Quick sweep opening
        filter.frequency.exponentialRampToValueAtTime(350, startTime + 0.25); // Sweeps back down
        filter.Q.setValueAtTime(7.0, startTime); // Resonant screech

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.72, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.55, startTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + 0.26);
        osc2.stop(startTime + 0.26);
      };

      triggerPulse(now);
      triggerPulse(now + 0.32); // Second emergency alert stomp
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Ballot Locked-In / Task Complete (Pneumatic Lock + Steel Clank)
   */
  playVoteReveal() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;

      // 1. Pneumatic air pressure hiss (Task done / ballot lock)
      const hissSource = this.ctx.createBufferSource();
      hissSource.buffer = this.createNoiseBuffer(0.12);
      const hissFilter = this.ctx.createBiquadFilter();
      const hissGain = this.ctx.createGain();

      hissFilter.type = 'highpass';
      hissFilter.frequency.setValueAtTime(3500, now);
      hissGain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
      hissGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      hissSource.connect(hissFilter);
      hissFilter.connect(hissGain);
      hissGain.connect(this.ctx.destination);
      hissSource.start(now);
      hissSource.stop(now + 0.13);

      // 2. Heavy steel industrial latch / lock-in clank
      const pitches = [135, 182, 230]; // Dissonant metallic frequencies
      pitches.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + 0.04);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.35, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + 0.04);
        osc.stop(now + 0.19);
      });
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Absolute Masterpiece: Authentic Among Us "IMPOSTOR REVEAL STAB" 🔪
   * Recreates the terrifying dissonant screaming screech, sub-bass slam,
   * and the bone-chilling slow lingering cosmic horror tension drone.
   */
  playSpyReveal() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;

      // 1. High Screeching Metal Stab (Screaming, clashing, descending frequencies)
      // Clashing intervals: Minor Second and Tritone (F#5, G5, C6) for intense stress
      const stabPitches = [739.99, 783.99, 1046.50]; 
      stabPitches.forEach((freq, idx) => {
        const stabOsc = this.ctx!.createOscillator();
        const stabGain = this.ctx!.createGain();
        const stabFilter = this.ctx!.createBiquadFilter();
        
        // Alternate waves to get a super dirty, screaming texture
        stabOsc.type = idx === 1 ? 'sawtooth' : 'square';
        stabOsc.frequency.setValueAtTime(freq, now);
        // Instant terrifying pitch plunge
        stabOsc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.38);
        
        stabFilter.type = 'bandpass';
        stabFilter.frequency.setValueAtTime(freq * 1.2, now);
        stabFilter.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.38);
        stabFilter.Q.setValueAtTime(5.0, now);
        
        stabGain.gain.setValueAtTime(0, now);
        stabGain.gain.linearRampToValueAtTime(this.sfxVolume * 0.65, now + 0.015);
        stabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        
        stabOsc.connect(stabFilter);
        stabFilter.connect(stabGain);
        stabGain.connect(this.ctx!.destination);
        
        stabOsc.start(now);
        stabOsc.stop(now + 0.43);
      });

      // 2. Heavy Sub Bass Slam (Low frequency physical impact)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.55);
      
      subGain.gain.setValueAtTime(this.sfxVolume * 0.95, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.56);

      // 3. Modulated Eerie Space Tension Drone (Lingering eerie space hum)
      // Slow pulsing LFO modulates the drone filter to make it crawl!
      const drone1 = this.ctx.createOscillator();
      const drone2 = this.ctx.createOscillator();
      const droneGain = this.ctx.createGain();
      const droneFilter = this.ctx.createBiquadFilter();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      
      drone1.type = 'sawtooth';
      drone1.frequency.setValueAtTime(65.41, now); // Low C2 cosmic rumble
      drone1.frequency.linearRampToValueAtTime(62.00, now + 2.5); // Slow slide
      
      drone2.type = 'sawtooth';
      drone2.frequency.setValueAtTime(66.41, now); // Detuned for heavy beating
      drone2.frequency.linearRampToValueAtTime(63.00, now + 2.5);
      
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(110, now);
      droneFilter.Q.setValueAtTime(2.0, now);

      // LFO makes the drone "throb" with anxiety at 6Hz
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(6.0, now); 
      lfoGain.gain.setValueAtTime(25, now); // Modulates filter cut-off by 25Hz

      droneGain.gain.setValueAtTime(0, now);
      droneGain.gain.linearRampToValueAtTime(this.sfxVolume * 0.85, now + 0.15);
      droneGain.gain.linearRampToValueAtTime(this.sfxVolume * 0.50, now + 0.85);
      droneGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      
      // Connect LFO modulation to filter frequency
      lfo.connect(lfoGain);
      lfoGain.connect(droneFilter.frequency);

      drone1.connect(droneFilter);
      drone2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(this.ctx.destination);
      
      lfo.start(now);
      drone1.start(now);
      drone2.start(now);
      
      lfo.stop(now + 2.5);
      drone1.stop(now + 2.5);
      drone2.stop(now + 2.5);
      
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Retro-futuristic 8-bit celebratory space theme (Among Us Victory theme)
   */
  playVictory() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      
      // Rapid upward digital space melody: C4 -> E4 -> G4 -> C5 -> E5 -> G5 -> C6 -> E6
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.085;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.38, noteStart + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(noteStart);
        osc.stop(noteStart + 0.5);
      });

      // Warm retro futuristic Major-7 synth pad holding the chord underneath
      const pads = [130.81, 164.81, 196.00, 246.94]; // C3, E3, G3, B3
      pads.forEach((freq) => {
        const padOsc = this.ctx!.createOscillator();
        const padGain = this.ctx!.createGain();
        const padFilter = this.ctx!.createBiquadFilter();

        padOsc.type = 'triangle';
        padOsc.frequency.setValueAtTime(freq, now + 0.25);
        
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(400, now);
        padFilter.frequency.exponentialRampToValueAtTime(1000, now + 1.2);

        padGain.gain.setValueAtTime(0, now + 0.25);
        padGain.gain.linearRampToValueAtTime(this.sfxVolume * 0.42, now + 0.6);
        padGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        padOsc.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(this.ctx!.destination);

        padOsc.start(now + 0.25);
        padOsc.stop(now + 2.2);
      });
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Sinister sliding horror arpeggio & hollow cosmic winds (Among Us Defeat / Kill Screen)
   */
  playDefeat() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;

      // 1. Spooky empty void of space winds
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = this.createNoiseBuffer(2.2);
      const windFilter = this.ctx.createBiquadFilter();
      const windGain = this.ctx.createGain();

      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(250, now);
      // Wind gust filter sweep
      windFilter.frequency.exponentialRampToValueAtTime(120, now + 2.2);
      windFilter.Q.setValueAtTime(3.0, now);

      windGain.gain.setValueAtTime(0, now);
      windGain.gain.linearRampToValueAtTime(this.sfxVolume * 0.48, now + 0.3);
      windGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.ctx.destination);
      windSource.start(now);
      windSource.stop(now + 2.2);

      // 2. Grim minor/diminished arpeggio that slides downwards into the abyss
      const doomNotes = [196.00, 155.56, 130.81, 116.54, 98.00]; // G3, Eb3, C3, Bb2, G2
      doomNotes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.16;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);
        // Melancholic slide down
        osc.frequency.linearRampToValueAtTime(freq * 0.88, noteStart + 0.95);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.36, noteStart + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.95);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 1.0);
      });
    } catch (e) {
      console.warn("Audio Synthesis Error", e);
    }
  }

  /**
   * Loops an authentic, low-frequency spaceship background rumble.
   * Leverages a 52Hz sine hum layered with lowpass-filtered white noise.
   */
  playAmbientHum() {
    this.init();
    if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') {
      this.isAmbientPlaying = true; // Flag intent to play when unmuted
      return;
    }

    try {
      this.stopAmbientHum(); // Avoid duplicate loops
      this.isAmbientPlaying = true;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      // Subtle atmospheric level
      this.ambientGain.gain.setValueAtTime(this.sfxVolume * 0.18, now);

      // 1. Reactor/Engine 52Hz low sine wave rumble
      this.ambientOsc = this.ctx.createOscillator();
      this.ambientOsc.type = 'sine';
      this.ambientOsc.frequency.setValueAtTime(52.0, now); // low G#1 engine hum

      // 2. Spaceship air vents ventilation static (filtered noise)
      const noiseBuffer = this.createNoiseBuffer(2.0);
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(75, now); // Deep muffled hum
      noiseFilter.Q.setValueAtTime(1.0, now);

      // Connections
      this.ambientOsc.connect(this.ambientGain);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(this.ambientGain);

      this.ambientGain.connect(this.ctx.destination);

      this.ambientOsc.start(now);
      noiseSource.start(now);

      // Keep references to clean up
      this.ambientNoise = noiseSource;
    } catch (e) {
      console.warn("Failed to play Ambient Atmosphere Drone", e);
    }
  }

  /**
   * Terminate the looping background spaceship engine rumble.
   */
  stopAmbientHum() {
    try {
      if (this.ambientOsc) {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
        this.ambientOsc = null;
      }
      if (this.ambientNoise) {
        (this.ambientNoise as any).stop();
        this.ambientNoise.disconnect();
        this.ambientNoise = null;
      }
      if (this.ambientGain) {
        this.ambientGain.disconnect();
        this.ambientGain = null;
      }
    } catch (e) {
      // Ignored
    }
  }
}

export const soundManager = new SoundManager();
