export class RideSoundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private rumble: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rhythmTimer: number | null = null;
  private speed: 1 | 4 | 16 = 1;
  private moving = false;

  async enable() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = .38;
      this.master.connect(this.context.destination);
      this.rumbleGain = this.context.createGain();
      this.rumbleGain.gain.value = .018;
      this.rumble = this.context.createOscillator();
      this.rumble.type = 'triangle';
      this.rumble.frequency.value = 47;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 130;
      this.rumble.connect(filter).connect(this.rumbleGain).connect(this.master);
      this.rumble.start();
    }
    await this.context.resume();
    this.startRhythm();
  }

  setMotion(moving: boolean, speed: 1 | 4 | 16) {
    this.moving = moving;
    this.speed = speed;
    if (!this.context || !this.rumbleGain) return;
    const now = this.context.currentTime;
    this.rumbleGain.gain.cancelScheduledValues(now);
    this.rumbleGain.gain.linearRampToValueAtTime(moving ? .06 : .018, now + .35);
    this.startRhythm();
  }

  private startRhythm() {
    if (this.rhythmTimer !== null) window.clearInterval(this.rhythmTimer);
    const interval = this.speed === 16 ? 160 : this.speed === 4 ? 280 : 520;
    this.rhythmTimer = window.setInterval(() => this.clack(), interval);
  }

  private clack() {
    if (!this.moving || !this.context || !this.master || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.value = 105 + Math.random() * 18;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.055, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .075);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now); oscillator.stop(now + .09);
  }

  chime() {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    [0, .16].forEach((delay, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const now = this.context!.currentTime + delay;
      oscillator.type = 'sine'; oscillator.frequency.value = index ? 880 : 660;
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.13, now + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .55);
      oscillator.connect(gain).connect(this.master!);
      oscillator.start(now); oscillator.stop(now + .6);
    });
  }

  announce(place: string, line: string) {
    if (!('speechSynthesis' in window) || !this.context || this.context.state !== 'running') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Now arriving at ${place}. ${line}`);
    utterance.rate = .92; utterance.pitch = .95; utterance.volume = .72;
    window.speechSynthesis.speak(utterance);
  }

  mute() {
    if (this.rhythmTimer !== null) window.clearInterval(this.rhythmTimer);
    this.rhythmTimer = null;
    window.speechSynthesis?.cancel();
    void this.context?.suspend();
  }

  destroy() {
    this.mute();
    this.rumble?.stop();
    void this.context?.close();
    this.context = null;
  }
}
