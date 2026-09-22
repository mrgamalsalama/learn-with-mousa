// محاكي الأصوات الحماسية والمؤثرات الصوتية لتحدي موسى باستخدام Web Audio API
class ChallengeSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  setEnabled(val: boolean) {
    this.enabled = val;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private initCtx() {
    if (!this.enabled) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // صوت تكتكة المؤقت التنازلي الحماسي (Tick)
  playTick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // ignore
    }
  }

  // صوت الثواني الأخيرة العاجلة (Urgent Warning Beep)
  playUrgent() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.setValueAtTime(980, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // ignore
    }
  }

  // صوت الإجابة الصحيحة والنجاح الساحق (Ding Fanfare)
  playCorrect() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch {
      // ignore
    }
  }

  // صوت الإجابة الخاطئة اللطيف (Soft Buzz)
  playWrong() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {
      // ignore
    }
  }

  // صوت التتويج والمنصة (Victory / Podium Fanfare)
  playPodium() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const fanfare = [
        { f: 523.25, d: 0.12, t: 0 },
        { f: 523.25, d: 0.12, t: 0.14 },
        { f: 523.25, d: 0.12, t: 0.28 },
        { f: 659.25, d: 0.25, t: 0.42 },
        { f: 587.33, d: 0.15, t: 0.70 },
        { f: 783.99, d: 0.45, t: 0.90 }
      ];

      fanfare.forEach(item => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(item.f, this.ctx.currentTime + item.t);

        gain.gain.setValueAtTime(0, this.ctx.currentTime + item.t);
        gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + item.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + item.t + item.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + item.t);
        osc.stop(this.ctx.currentTime + item.t + item.d);
      });
    } catch {
      // ignore
    }
  }
}

export const challengeAudio = new ChallengeSoundEngine();
