import { parseLyrics } from "./lyrics";
import type { FreeText, MediaItem, Playlist, Service, Song, SongGroup, Theme } from "./types";

const now = 1_704_000_000_000;

function song(
  id: string,
  title: string,
  artist: string,
  groupId: string,
  key: string,
  copyright: string,
  lyricsRaw: string,
): Song {
  return {
    id,
    title,
    artist,
    groupId,
    key,
    copyright,
    lyricsRaw,
    slides: parseLyrics(lyricsRaw),
    createdAt: now,
    updatedAt: now,
  };
}

export const SEED_GROUPS: SongGroup[] = [
  { id: "g-louvor", name: "Louvor" },
  { id: "g-hinario", name: "Hinário" },
  { id: "g-infantil", name: "Infantil" },
  { id: "g-ceia", name: "Ceia" },
];

export const SEED_THEMES: Theme[] = [
  {
    id: "theme-louvor",
    name: "Louvor escuro",
    backgroundType: "image",
    backgroundValue: "/themes/louvor.jpg",
    overlayOpacity: 0.48,
    fontFamily: "Fraunces",
    fontSize: 68,
    fontWeight: 600,
    uppercase: false,
    textColor: "#f4f1ea",
    outlineColor: "#07080b",
    outlineWidth: 2.4,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.22,
    margin: 9,
    showTitle: false,
    showCopyright: true,
    showReference: false,
    applyTo: "songs",
  },
  {
    id: "theme-santuario",
    name: "Santuário",
    backgroundType: "image",
    backgroundValue: "/themes/santuario.jpg",
    overlayOpacity: 0.55,
    fontFamily: "Fraunces",
    fontSize: 64,
    fontWeight: 600,
    uppercase: false,
    textColor: "#f7f3ea",
    outlineColor: "#050505",
    outlineWidth: 2.2,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.24,
    margin: 9,
    showTitle: false,
    showCopyright: true,
    showReference: false,
    applyTo: "songs",
  },
  {
    id: "theme-biblia",
    name: "Bíblia clássica",
    backgroundType: "image",
    backgroundValue: "/themes/pedra.jpg",
    overlayOpacity: 0.52,
    fontFamily: "Fraunces",
    fontSize: 58,
    fontWeight: 500,
    uppercase: false,
    textColor: "#f3efe4",
    outlineColor: "#0a0a0a",
    outlineWidth: 2,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.32,
    margin: 10,
    showTitle: false,
    showCopyright: false,
    showReference: true,
    applyTo: "bible",
  },
  {
    id: "theme-alvorada",
    name: "Alvorada",
    backgroundType: "image",
    backgroundValue: "/themes/alvorada.jpg",
    overlayOpacity: 0.38,
    fontFamily: "Fraunces",
    fontSize: 64,
    fontWeight: 600,
    uppercase: false,
    textColor: "#fffaf1",
    outlineColor: "#1a140c",
    outlineWidth: 2,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.24,
    margin: 9,
    showTitle: false,
    showCopyright: true,
    showReference: false,
    applyTo: "both",
  },
  {
    id: "theme-infantil",
    name: "Infantil",
    backgroundType: "image",
    backgroundValue: "/themes/infantil.jpg",
    overlayOpacity: 0.28,
    fontFamily: "Fraunces",
    fontSize: 72,
    fontWeight: 700,
    uppercase: false,
    textColor: "#14202a",
    outlineColor: "#ffffff",
    outlineWidth: 1.4,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.2,
    margin: 9,
    showTitle: true,
    showCopyright: false,
    showReference: false,
    applyTo: "songs",
  },
  {
    id: "theme-logo",
    name: "Tela preta com logo",
    backgroundType: "image",
    backgroundValue: "/themes/logo.jpg",
    overlayOpacity: 0.2,
    fontFamily: "Fraunces",
    fontSize: 48,
    fontWeight: 500,
    uppercase: false,
    textColor: "#ece8de",
    outlineColor: "#000000",
    outlineWidth: 1.5,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.2,
    margin: 12,
    showTitle: false,
    showCopyright: false,
    showReference: false,
    applyTo: "both",
  },
  {
    id: "theme-cut",
    name: "Cor sólida",
    backgroundType: "color",
    backgroundValue: "#0c1016",
    overlayOpacity: 0,
    fontFamily: "Fraunces",
    fontSize: 66,
    fontWeight: 600,
    uppercase: false,
    textColor: "#f2f4f7",
    outlineColor: "#000000",
    outlineWidth: 2.6,
    shadow: true,
    alignH: "center",
    alignV: "center",
    lineHeight: 1.22,
    margin: 9,
    showTitle: false,
    showCopyright: false,
    showReference: true,
    applyTo: "both",
  },
];

export const SEED_SONGS: Song[] = [
  song(
    "song-vale",
    "Luz sobre o vale",
    "Coletivo Lúmen",
    "g-louvor",
    "G",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
Levantamos os olhos
Do vale até o monte
A tua luz atravessa
O que o medo esconde

[Coro]
Firme é o teu chão
Largo é o teu céu
Nada se compara
Ao Deus que nos chamou

[Verso 2]
Cada passo no escuro
Ainda encontra o teu nome
Tua voz no silêncio
É abrigo e é fome

[Ponte]
Se o vento levantar
Ainda assim
O vale vai cantar

[Coro]
Firme é o teu chão
Largo é o teu céu
Nada se compara
Ao Deus que nos chamou
`,
  ),
  song(
    "song-altar",
    "O altar está pronto",
    "Coletivo Lúmen",
    "g-louvor",
    "D",
    "© Igreja local — uso livre no culto",
    `[Intro]
Instrumental

[Verso 1]
Chegamos sem pressa
As portas estão abertas
O pão ainda quente
A casa nos espera

[Coro]
O altar está pronto
O coração também
Vem, Senhor, habitar
O que preparamos bem

[Verso 2]
Não trazemos ouro
Trazemos o que somos
Um povo que aprende
A te chamar de dono

[Ponte]
Queima o que é velho
Acende o que é teu
Faz desta reunião
Um céu

[Coro]
O altar está pronto
O coração também
Vem, Senhor, habitar
O que preparamos bem
`,
  ),
  song(
    "song-alvorada",
    "Cântico da alvorada",
    "Coletivo Lúmen",
    "g-louvor",
    "A",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
Antes do sol vencer a serra
Já havia canto na janela
A graça não espera a hora
Ela chega e acende a vela

[Coro]
É cedo, mas já é tempo
De abrir a boca e lembrar
Que a noite não ficou
Com a última palavra

[Verso 2]
Os pés cansados encontram rua
A rua encontra o templo
O templo encontra o céu
E o céu se faz dentro

[Final]
É cedo, mas já é tempo
`,
  ),
  song(
    "song-mare",
    "Maré de graça",
    "Coletivo Lúmen",
    "g-louvor",
    "E",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
Quando a culpa empurra pra areia
Tua onda volta e me alcança
Não pergunto se mereço
Só abro a mão e a esperança

[Coro]
Maré de graça
Cobre o que eu não sei
Maré de graça
Leva o que eu errei

[Ponte]
Mais fundo que o meu medo
Mais larga que o meu mar
A tua misericórdia
Não sabe recuar
`,
  ),
  song(
    "song-pao",
    "Pão partido",
    "Coletivo Lúmen",
    "g-ceia",
    "C",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
Este pão não é só pão
É memória sobre a mesa
Este vinho não é só vinho
É aliança e é beleza

[Coro]
Partido por nós
Derramado por nós
Aqui neste círculo
O céu chegou a nós

[Verso 2]
Olhamos uns aos outros
E vemos teu retrato
Um povo perdoado
Aprendendo o contrato

[Final]
Até que voltes
Guardamos esta mesa
`,
  ),
  song(
    "song-casa",
    "Casa aberta",
    "Coletivo Lúmen",
    "g-infantil",
    "C",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
A porta da casa
Não fecha pra ninguém
Jesus chama as crianças
E senta também

[Coro]
Casa aberta, coração aberto
Pode entrar, pode cantar
Casa aberta, braço aberto
Deus gosta de nos abraçar

[Verso 2]
Se eu sou pequeno
Ele é enorme
Mas fala baixinho
E o medo some
`,
  ),
  song(
    "song-castelo",
    "Castelo forte",
    "Martim Lutero · domínio público",
    "g-hinario",
    "C",
    "Domínio público",
    `[Verso 1]
Castelo forte é nosso Deus
Espada e bom escudo
Com seu poder defende os seus
Em todo transe agudo
Com fúria pertinaz
Persegue Satanás
Com artes e furor
E crueldade e horror
Não iguala a terra

[Verso 2]
A força nossa é nula fé
Estamos decadentes
Mas nosso Deus, por sua mercê
É o General das gentes
Sabeis quem é? Jesus
O que venceu na cruz
Senhor dos altos céus
E sendo o próprio Deus
Triunfa no combate
`,
  ),
  song(
    "song-santo",
    "Três vezes santo",
    "Coletivo Lúmen",
    "g-louvor",
    "G",
    "© Igreja local — uso livre no culto",
    `[Verso 1]
A terra se cala
Quando o céu se abre
Serafins não cansam
De dizer teu nome

[Coro]
Santo, santo, santo
É o Senhor
Toda a terra canta
A glória do Senhor

[Verso 2]
A glória transborda
Do templo até a rua
O povo responde
Com voz ainda crua

[Ponte]
Quem somos nós
Pra ver o Rei
E mesmo assim
Ele vem
`,
  ),
];

export const SEED_SERVICES: Service[] = [
  { id: "svc-dom", name: "Domingo 19h", recurrence: "weekly-sun-19" },
  { id: "svc-qua", name: "Quarta 20h", recurrence: "weekly-wed-20" },
];

export const SEED_PLAYLISTS: Playlist[] = [
  {
    id: "pl-temp",
    name: "Temporário",
    updatedAt: now,
    items: [],
  },
  {
    id: "pl-domingo",
    name: "Domingo 19h",
    serviceId: "svc-dom",
    updatedAt: now,
    items: [
      { id: "i0", type: "text", refId: "txt-bemvindo", notes: "", title: "Boas-vindas" },
      { id: "i1", type: "song", refId: "song-alvorada", notes: "", title: "Cântico da alvorada" },
      { id: "i2", type: "song", refId: "song-vale", notes: "", title: "Luz sobre o vale" },
      { id: "i3", type: "song", refId: "song-altar", notes: "", title: "O altar está pronto" },
      { id: "i4", type: "bible", refId: "43:3:16", notes: "João 3:16", title: "João 3:16" },
      { id: "i5", type: "text", refId: "txt-oferta", notes: "", title: "Oferta" },
      { id: "i6", type: "song", refId: "song-pao", notes: "", title: "Pão partido" },
    ],
  },
  {
    id: "pl-quarta",
    name: "Quarta 20h",
    serviceId: "svc-qua",
    updatedAt: now,
    items: [
      { id: "i7", type: "song", refId: "song-mare", notes: "", title: "Maré de graça" },
      { id: "i8", type: "song", refId: "song-santo", notes: "", title: "Três vezes santo" },
      { id: "i9", type: "bible", refId: "19:23:1", notes: "Salmos 23", title: "Salmos 23" },
    ],
  },
];

export const SEED_TEXTS: FreeText[] = [
  {
    id: "txt-joao316",
    title: "João 3.16 (bloco)",
    body: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito para que todo aquele que nele crê não pereça mas tenha a vida eterna.",
    updatedAt: now,
  },
  {
    id: "txt-oferta",
    title: "Oferta",
    body: "Este é o momento da oferta.\nDamos com alegria\no que o Senhor nos confiou.",
    updatedAt: now,
  },
  {
    id: "txt-kids",
    title: "Sala kids",
    body: "Crianças de 3 a 10 anos:\nSala kids no corredor direito\ndurante a palavra.",
    updatedAt: now,
  },
  {
    id: "txt-wifi",
    title: "Wi-Fi da igreja",
    body: "Rede: Igreja Visitantes\nSenha no verso do boletim",
    updatedAt: now,
  },
  {
    id: "txt-bemvindo",
    title: "Boas-vindas",
    body: "Bem-vindo ao Lúmen!\nWelcome to Lúmen!\n¡Bienvenido a Lúmen!",
    updatedAt: now,
  },
];

export const SEED_MEDIA: MediaItem[] = [
  {
    id: "media-santuario",
    type: "image",
    title: "Santuário (fundo)",
    path: "/themes/santuario.jpg",
  },
  {
    id: "media-alvorada",
    type: "image",
    title: "Alvorada (fundo)",
    path: "/themes/alvorada.jpg",
  },
];
