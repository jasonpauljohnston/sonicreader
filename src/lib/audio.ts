export interface VoiceOption {
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

class AudioService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    this.voices = this.synth.getVoices();
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(text: string, options: { 
    voice?: SpeechSynthesisVoice; 
    rate?: number; 
    onEnd?: () => void;
    onBoundary?: (event: SpeechSynthesisEvent) => void;
  }) {
    this.stop();
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    if (options.voice) this.currentUtterance.voice = options.voice;
    if (options.rate) this.currentUtterance.rate = options.rate;
    if (options.onEnd) this.currentUtterance.onend = options.onEnd;
    if (options.onBoundary) this.currentUtterance.onboundary = options.onBoundary;
    
    this.synth.speak(this.currentUtterance);
  }

  pause() {
    this.synth.pause();
  }

  resume() {
    this.synth.resume();
  }

  stop() {
    this.synth.cancel();
    this.currentUtterance = null;
  }

  get isSpeaking() {
    return this.synth.speaking;
  }

  get isPaused() {
    return this.synth.paused;
  }
}

export const audioService = new AudioService();
