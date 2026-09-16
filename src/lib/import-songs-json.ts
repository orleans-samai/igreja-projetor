import { toast } from "sonner";
import {
  lerMusicasJson,
  prepararImportacao,
  type FalhaDeMusica,
  type MusicaLida,
} from "@/lib/songs-json";
import { useLumenStore } from "@/store/lumen-store";

/**
 * O caminho do arquivo .json até o repertório.
 *
 * Fica fora dos componentes porque dois lugares chamam a mesma coisa — o menu
 * Arquivo e o botão na aba Letras — e porque a parte interessante (validar,
 * normalizar, não duplicar) é de songs-json.ts, não de tela.
 */
export function importarMusicasJsonDoDisco(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.multiple = true;
  input.onchange = async () => {
    const arquivos = [...(input.files ?? [])];
    if (arquivos.length === 0) return;

    const st = useLumenStore.getState();
    const musicas: MusicaLida[] = [];
    const falhas: FalhaDeMusica[] = [];

    for (const file of arquivos) {
      let dado: unknown;
      try {
        dado = JSON.parse(await file.text());
      } catch {
        falhas.push({ onde: file.name, campo: "(arquivo)", motivo: "não é um JSON válido" });
        continue;
      }
      const r = lerMusicasJson(dado);
      musicas.push(...r.musicas);
      // Com vários arquivos, o nome do arquivo é o que localiza a falha.
      falhas.push(
        ...r.falhas.map((f) =>
          arquivos.length > 1 ? { ...f, onde: `${file.name} · ${f.onde}` } : f,
        ),
      );
    }

    const resultado = prepararImportacao({ musicas, falhas }, st.songs, "g-louvor");
    for (const song of resultado.novas) st.saveSong(song);

    if (resultado.novas.length > 0) {
      const n = resultado.novas.length;
      toast(
        `${n} música${n > 1 ? "s" : ""} importada${n > 1 ? "s" : ""}` +
          (resultado.duplicadas.length ? ` · ${resultado.duplicadas.length} já existia(m)` : ""),
      );
    } else if (resultado.duplicadas.length > 0) {
      toast(`Nada a importar: as ${resultado.duplicadas.length} música(s) já estão no repertório.`);
    }

    // Uma linha por música com problema, dizendo o campo: "algumas falharam"
    // não diz ao operador o que consertar no arquivo.
    for (const f of resultado.falhas.slice(0, 4)) {
      toast.error(`${f.onde}: ${f.motivo} (${f.campo})`, { duration: 10000 });
    }
    if (resultado.falhas.length > 4) {
      toast.error(`E mais ${resultado.falhas.length - 4} música(s) com problema.`, {
        duration: 10000,
      });
    }
    if (!resultado.novas.length && !resultado.duplicadas.length && !resultado.falhas.length) {
      toast.error("Nenhuma música encontrada nesse arquivo.");
    }
  };
  input.click();
}
