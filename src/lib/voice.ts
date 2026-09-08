type RecCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function Ctor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  return Ctor() !== null;
}

export function startVoice(onText: (text: string) => void): () => void {
  const Rec = Ctor();
  if (!Rec) return () => undefined;
  const rec = new Rec();
  rec.lang = "pt-BR";
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1];
    const text = last?.[0]?.transcript?.trim();
    if (text) onText(text);
  };
  rec.onerror = () => undefined;
  rec.onend = () => {
    try {
      rec.start();
    } catch {
      /* stopped */
    }
  };
  try {
    rec.start();
  } catch {
    /* already started */
  }
  return () => {
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}
