import { diagnose } from "./slide-optimize.ts";
import type { HealthItem, Playlist, Settings, Song, Theme } from "./types.ts";

export function runCheckup(input: {
  songs: Song[];
  playlists: Playlist[];
  activePlaylistId: string;
  themes: Theme[];
  songThemeId: string;
  settings: Settings;
  projectorOpen: boolean;
  palcoOpen: boolean;
  bibleReady: boolean;
  online: boolean;
  appInstalled?: boolean;
}): { items: HealthItem[]; ready: boolean; score: number } {
  const items: HealthItem[] = [];
  const pl = input.playlists.find((p) => p.id === input.activePlaylistId);

  items.push({
    id: "playlist",
    label: "Programação do culto",
    level: pl && pl.items.length >= 3 ? "ok" : pl && pl.items.length > 0 ? "warn" : "fail",
    detail: pl
      ? `${pl.name} · ${pl.items.length} itens`
      : "Nenhuma playlist ativa",
    fix: pl && pl.items.length < 3 ? "Inclua abertura, louvor e palavra." : undefined,
    action: "playlist",
  });

  items.push({
    id: "bible",
    label: "Bíblia",
    level: input.bibleReady ? "ok" : "warn",
    detail: input.bibleReady ? "Almeida 1819 carregada" : "Ainda carregando o texto bíblico",
    action: "bible",
  });

  items.push({
    id: "projector",
    label: "Projetor / telão",
    level: input.projectorOpen ? "ok" : "warn",
    detail: input.projectorOpen
      ? "Janela do projetor aberta nesta sessão"
      : "Abra o projetor antes de começar (Tela → Abrir projetor)",
    action: "projector",
  });

  items.push({
    id: "palco",
    label: "Retorno de palco",
    level: input.palcoOpen ? "ok" : "warn",
    detail: input.palcoOpen ? "Palco aberto" : "Opcional — líder de louvor e pastor usam /palco e /pedido",
    action: "palco",
  });

  items.push({
    id: "windows",
    label: "App no Windows",
    level: input.appInstalled ? "ok" : "warn",
    detail: input.appInstalled
      ? "Lúmen instalado — abre pelo Menu Iniciar"
      : "Ainda no navegador. Instale no Edge/Chrome para a cabine (Ajuda → Instalar no Windows).",
    action: "windows",
  });

  items.push({
    id: "net",
    label: "Internet",
    level: input.online ? "ok" : "warn",
    detail: input.online
      ? "Online — copiloto IA e busca na web disponíveis"
      : "Offline — comandos locais e Bíblia continuam funcionando",
  });

  let storageLevel: HealthItem["level"] = "ok";
  let storageDetail = "Armazenamento local ok";
  try {
    const raw = typeof localStorage !== "undefined" ? JSON.stringify(localStorage).length : 0;
    if (raw > 4_000_000) {
      storageLevel = "warn";
      storageDetail = "Biblioteca local grande — exporte um backup";
    } else {
      storageDetail = "Autosave ativo · sessão do culto gravada a cada passo";
    }
  } catch {
    storageLevel = "warn";
    storageDetail = "Armazenamento restrito neste navegador";
  }
  items.push({
    id: "disk",
    label: "Disco / sessão",
    level: storageLevel,
    detail: storageDetail,
  });

  const theme = input.themes.find((t) => t.id === input.songThemeId) ?? input.themes[0];
  if (theme) {
    const overlayOk = theme.overlayOpacity >= 0.35;
    const marginOk = theme.margin >= 8;
    items.push({
      id: "theme",
      label: "Tema do louvor",
      level: overlayOk && marginOk ? "ok" : "warn",
      detail: overlayOk && marginOk
        ? `${theme.name} · contraste adequado`
        : `${theme.name} · fundo pode competir com a letra`,
      fix: overlayOk ? undefined : "Aumente o véu do fundo ou rode Otimizar.",
      action: "display",
    });
  }

  const walls: string[] = [];
  const diagTheme = theme ?? input.themes[0];
  if (diagTheme) {
    for (const song of input.songs) {
      const issues = diagnose({
        kind: "song",
        title: song.title,
        slides: song.slides,
        raw: song.lyricsRaw,
        theme: diagTheme,
        settings: input.settings,
      });
      if (issues.some((i) => i.kind === "wall" || i.kind === "overflow")) {
        walls.push(song.title);
      }
    }
  }
  items.push({
    id: "slides",
    label: "Slides do repertório",
    level: walls.length === 0 ? "ok" : walls.length < 3 ? "warn" : "fail",
    detail:
      walls.length === 0
        ? "Nenhum bloco corrido no repertório carregado"
        : `Texto ruim no telão: ${walls.slice(0, 3).join(", ")}`,
    fix: walls.length ? "Selecione a música e toque Otimizar apresentação." : undefined,
    action: "optimize",
  });

  const typos: string[] = [];
  for (const song of input.songs) {
    if (/\bes tu\b/i.test(song.lyricsRaw)) typos.push(`${song.title} (és Tu?)`);
  }
  items.push({
    id: "lyrics",
    label: "Letras",
    level: typos.length ? "warn" : "ok",
    detail: typos.length ? typos.slice(0, 3).join(" · ") : "Nenhum erro óbvio de acento no repertório",
  });

  items.push({
    id: "obs",
    label: "OBS / NDI",
    level: "warn",
    detail: "Integração de captura fica no computador da igreja — aqui o telão é a janela Projetor",
  });

  const fail = items.filter((i) => i.level === "fail").length;
  const warn = items.filter((i) => i.level === "warn").length;
  const ready = fail === 0;
  const score = Math.max(0, 100 - fail * 25 - warn * 6);
  return { items, ready, score };
}
