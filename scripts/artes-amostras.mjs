#!/usr/bin/env node
/**
 * Amostras das artes, renderizadas de verdade, para olhar.
 *
 *   npm run dev                      (noutro terminal)
 *   node scripts/artes-amostras.mjs [http://localhost:8080] [cenario]
 *
 * Abre o gerador no Edge sem janela, pelo servidor de desenvolvimento,
 * gera o lote de cada cenário em cada formato com as fontes reais medidas
 * no canvas, e salva em artifacts/artes-amostras/:
 *
 *   <cenario>-<formato>.png        folha de contato do lote
 *   <cenario>-<formato>-<n>.png    cada opção, no tamanho do formato
 *   relatorio.json                 variante, paleta, assinatura, avisos
 *
 * Validação automática não substitui olhar a composição — é para isso que
 * este script existe. As fotos dos cenários são as imagens de tema que já
 * vêm no app (public/themes), usadas aqui só como foto de teste.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const base = process.argv[2] || "http://localhost:8080";
const so = process.argv[3] || "";
const destino = path.join(raiz, "artifacts", "artes-amostras");
await mkdir(destino, { recursive: true });

const FORMATOS = ["quadrado", "retrato", "story", "projecao"];

const navegador = await chromium.launch({ channel: "msedge", headless: true });
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
pagina.on("pageerror", (e) => console.error("erro na página:", e.message));
await pagina.goto(base, { waitUntil: "load" });
await pagina.waitForTimeout(2500);

await pagina.evaluate(async () => {
  const Rc = await import("/src/features/artes/konva/recursos.ts");
  const T = await import("/src/features/artes/catalogo/tipografia.ts");
  await Rc.garantirFontesDoCatalogo(T.CONJUNTOS.flatMap((c) => [c.titulo, c.apoio, c.info, c.destaque, c.sobretitulo]));
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  window.__fotoDe = async (src, nome, foco) => {
    const img = await Rc.carregarImagem(src);
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    const mapa = [];
    for (let i = 0; i < 64; i++) mapa.push(0.2126 * lin(d[i * 4] / 255) + 0.7152 * lin(d[i * 4 + 1] / 255) + 0.0722 * lin(d[i * 4 + 2] / 255));
    return { src, nome, largura: img.naturalWidth, altura: img.naturalHeight, tipo: "foto", pontoFocal: foco ?? { x: 0.5, y: 0.5 }, mapaDeLuz: mapa, transparente: false };
  };
  // Logos de teste: uma clara, uma escura — é o caso que pede placa.
  window.__logo = (clara) => {
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = clara ? "#ffffff" : "#1b2a4a";
    x.beginPath();
    x.arc(80, 80, 60, 0, Math.PI * 2);
    x.fill();
    x.font = "700 64px 'Instrument Sans Variable'";
    x.fillText("IBC", 160, 104);
    return { src: c.toDataURL("image/png"), largura: 480, altura: 160, luz: clara ? 0.95 : 0.05, transparente: true };
  };
  window.__medidor = Rc.medidorDeCanvas();
});

const CENARIOS = {
  "ebd-adultos": `({ categoria: "escola-biblica", publico: "adultos", titulo: "Escola Bíblica Dominical", subtitulo: "Estudo no livro de Romanos", data: "12 de outubro", horario: "9h", local: "Salão de estudos", organizacao: "Igreja Batista Central", logo: window.__logo(false) })`,
  "ebd-infantil": `({ categoria: "escola-biblica", publico: "criancas", titulo: "EBD Kids", mensagem: "Traga sua Bíblia e um amigo", data: "19 de outubro", horario: "9h30", local: "Sala 3" })`,
  "jovens-titulo-longo": `({ categoria: "encontro-jovens", publico: "jovens", titulo: "Encontro de Jovens: Raízes que Sustentam a Nossa Fé", data: "8 de novembro", horario: "19h", local: "Ginásio municipal", endereco: "Rua das Flores, 120", organizacao: "Juventude IBC", logo: window.__logo(true), fotos: [await window.__fotoDe("/themes/louvor.jpg", "Louvor", { x: 0.5, y: 0.4 }), await window.__fotoDe("/themes/alvorada.jpg", "Alvorada")] })`,
  "gratidao-uma-foto": `({ categoria: "gratidao", titulo: "Culto de Gratidão", mensagem: "Até aqui nos ajudou o Senhor", referencia: "1 Samuel 7:12", data: "30/11", horario: "18h", fotos: [await window.__fotoDe("/themes/alvorada.jpg", "Alvorada", { x: 0.55, y: 0.45 })] })`,
  "institucional-vazios": `({ categoria: "institucional", titulo: "Assembleia Geral Ordinária", data: "15 de dezembro", horario: "20h", organizacao: "Igreja Presbiteriana do Bairro", logo: window.__logo(false) })`,
};

const relatorio = [];
for (const [nome, expressao] of Object.entries(CENARIOS)) {
  if (so && nome !== so) continue;
  for (const formato of FORMATOS) {
    const r = await pagina.evaluate(
      async ({ expressao, formato }) => {
        const L = await import("/src/features/artes/gerador/lote.ts");
        const B = await import("/src/features/artes/briefing.ts");
        const E = await import("/src/features/artes/konva/exportar.tsx");
        const briefing = { ...B.briefingVazio(), ...(await eval(`(async () => ${expressao})()`)) };
        const t0 = performance.now();
        const lote = L.gerarLote({ briefing, formatoId: formato, semente: 20260926, medidor: window.__medidor });
        const ms = Math.round(performance.now() - t0);
        const canvases = [];
        for (const o of lote.opcoes) canvases.push(await E.rasterizar(o, 1));
        // Folha de contato: 4 por linha, cada uma com 360px de largura.
        const larg = 360;
        const alt = Math.round((larg * lote.opcoes[0].altura) / lote.opcoes[0].largura);
        const cols = 4;
        const linhas = Math.ceil(canvases.length / cols);
        const folha = document.createElement("canvas");
        folha.width = cols * (larg + 16) + 16;
        folha.height = linhas * (alt + 40) + 16;
        const fx = folha.getContext("2d");
        fx.fillStyle = "#26262a";
        fx.fillRect(0, 0, folha.width, folha.height);
        canvases.forEach((cv, i) => {
          const x = 16 + (i % cols) * (larg + 16);
          const y = 16 + Math.floor(i / cols) * (alt + 40);
          fx.drawImage(cv, x, y, larg, alt);
          fx.fillStyle = "#e8e8ea";
          fx.font = "600 14px 'Instrument Sans Variable'";
          fx.fillText(`${i + 1}. ${lote.opcoes[i].rotulo}`, x, y + alt + 18);
          fx.fillStyle = "#9a9aa2";
          fx.font = "12px 'IBM Plex Mono'";
          fx.fillText(lote.opcoes[i].variante, x, y + alt + 33);
        });
        return {
          ms,
          limitacoes: lote.limitacoes,
          folha: folha.toDataURL("image/png"),
          opcoes: lote.opcoes.map((o, i) => ({
            png: canvases[i].toDataURL("image/png"),
            largura: canvases[i].width,
            altura: canvases[i].height,
            rotulo: o.rotulo,
            variante: o.variante,
            paleta: o.direcao.paletaId,
            tipografia: o.direcao.tipografiaId,
            avisos: o.avisos,
            assinatura: o.assinatura,
          })),
        };
      },
      { expressao, formato },
    );
    const salvar = (arquivo, url) => writeFile(path.join(destino, arquivo), Buffer.from(url.split(",")[1], "base64"));
    await salvar(`${nome}-${formato}.png`, r.folha);
    for (const [i, o] of r.opcoes.entries()) await salvar(`${nome}-${formato}-${i + 1}.png`, o.png);
    relatorio.push({ cenario: nome, formato, ms: r.ms, limitacoes: r.limitacoes, opcoes: r.opcoes.map(({ png: _png, ...resto }) => resto) });
    console.log(`${nome} ${formato}: ${r.opcoes.length} opções em ${r.ms} ms${r.limitacoes.length ? " — " + r.limitacoes[0] : ""}`);
  }
}
await writeFile(path.join(destino, "relatorio.json"), JSON.stringify(relatorio, null, 2));
await navegador.close();
console.log(`Amostras em ${destino}`);
