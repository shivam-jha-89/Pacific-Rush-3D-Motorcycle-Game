export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineOscillators = [];
    this.started = false;
    this.muted = false;
  }

  start() {
    if (this.started) {
      this.context?.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.46;
    this.master.connect(this.context.destination);

    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;
    this.engineFilter.Q.value = 2.2;

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.0001;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    const layers = [
      { type: 'sawtooth', ratio: 1, gain: 0.48 },
      { type: 'square', ratio: 0.5, gain: 0.13 },
      { type: 'sine', ratio: 2, gain: 0.08 },
    ];

    layers.forEach(({ type, ratio, gain }) => {
      const osc = this.context.createOscillator();
      const layerGain = this.context.createGain();
      osc.type = type;
      osc.frequency.value = 50 * ratio;
      layerGain.gain.value = gain;
      osc.connect(layerGain);
      layerGain.connect(this.engineFilter);
      osc.start();
      this.engineOscillators.push({ osc, ratio });
    });

    this.started = true;
  }

  update(speed, throttle, boosting, paused) {
    if (!this.context || !this.started) return;
    const now = this.context.currentTime;
    const normalized = Math.min(1, speed / 285);
    const baseFrequency = 48 + normalized * 158 + throttle * 26 + (boosting ? 32 : 0);

    this.engineOscillators.forEach(({ osc, ratio }) => {
      osc.frequency.setTargetAtTime(baseFrequency * ratio, now, 0.035);
    });
    this.engineFilter.frequency.setTargetAtTime(500 + normalized * 2100 + (boosting ? 1100 : 0), now, 0.06);
    const targetGain = paused || this.muted ? 0.0001 : 0.065 + normalized * 0.1 + throttle * 0.035;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.06);
  }

  countdown(tone = 0) {
    this.beep(tone === 3 ? 620 : 390, tone === 3 ? 0.25 : 0.14, tone === 3 ? 0.22 : 0.13);
  }

  impact(strength = 1) {
    if (!this.context || !this.master) return;
    const duration = 0.18;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const decay = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 130 + strength * 190;
    filter.Q.value = 0.7;
    gain.gain.value = Math.min(0.42, 0.17 * strength);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  strike() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  boost() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.32);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  beep(frequency, duration, volume) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
  }
}

