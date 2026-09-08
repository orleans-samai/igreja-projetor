/**
 * Grava ícone e identificação no Lúmen.exe depois que o electron-builder
 * monta a pasta do app — e antes de o instalador ser gerado, então o exe
 * instalado sai igual ao portátil.
 *
 * Por que aqui e não pelo próprio electron-builder: ligar
 * `signAndEditExecutable` faz ele baixar o pacote winCodeSign, que traz
 * symlinks do macOS. Criar symlink no Windows exige Modo Desenvolvedor ou
 * conta de administrador, e sem isso a extração falha e o build inteiro
 * morre. O resedit faz a mesma edição de recursos sem esse download.
 */
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const APP_EXE = "Lúmen.exe";

module.exports = async function afterPack(context) {
  const exe = join(context.appOutDir, APP_EXE);
  const icon = join(__dirname, "..", "desktop", "build", "icon.ico");
  if (!existsSync(exe)) {
    console.warn(`  • afterPack: ${APP_EXE} não encontrado, nada a gravar`);
    return;
  }
  if (!existsSync(icon)) {
    console.warn("  • afterPack: icon.ico ausente, nada a gravar");
    return;
  }

  try {
    const ResEdit = await import("resedit");
    const data = readFileSync(exe);
    const nt = ResEdit.NtExecutable.from(data);
    const res = ResEdit.NtExecutableResource.from(nt);

    const iconFile = ResEdit.Data.IconFile.from(readFileSync(icon));
    const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    const groupId = groups[0]?.id ?? 1;
    const lang = groups[0]?.lang ?? 1033;
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      groupId,
      lang,
      iconFile.icons.map((item) => item.data),
    );

    const version = context.packager.appInfo.version;
    const [major = 1, minor = 0, patch = 0] = version.split(".").map(Number);
    const info = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
    if (info) {
      info.setFileVersion(major, minor, patch, 0);
      info.setProductVersion(major, minor, patch, 0);
      for (const l of info.getAllLanguagesForStringValues()) {
        info.setStringValues(l, {
          ProductName: "Lúmen",
          FileDescription: "Lúmen — projeção para o culto",
          CompanyName: "Igreja local",
          OriginalFilename: APP_EXE,
        });
      }
      info.outputToResourceEntries(res.entries);
    }

    res.outputResource(nt);
    writeFileSync(exe, Buffer.from(nt.generate()));
    console.log(`  • ícone e identificação gravados em ${APP_EXE}`);
  } catch (err) {
    // O app funciona sem isso; só sai com a cara padrão do Electron.
    console.warn("  • afterPack: não deu para gravar os recursos —", err && err.message);
  }
};
