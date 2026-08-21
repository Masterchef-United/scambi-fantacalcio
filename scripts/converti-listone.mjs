// File: scripts/converti-listone.mjs
// Converte un file Excel del listone (scaricato manualmente da loggato su Fantacalcio.it)
// in public/listone.json, pronto per essere letto dall'app.
//
// USO:
//   1. Vai su fantacalcio.it/quotazioni-fantacalcio da loggato
//   2. Clicca su "Scarica" per ottenere il file Excel (es. Quotazioni_Fantacalcio_Stagione_2026_27.xlsx)
//   3. Sposta il file scaricato nella cartella principale del progetto
//   4. Esegui: node scripts/converti-listone.mjs nome-del-file-scaricato.xlsx
//   5. Fai commit + push di public/listone.json su GitHub

import * as XLSX from "xlsx";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";

const OUTPUT_PATH = "public/listone.json";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("❌ Devi indicare il file Excel da convertire.");
    console.error("   Esempio: node scripts/converti-listone.mjs Quotazioni_Fantacalcio.xlsx");
    process.exit(1);
  }
  if (!existsSync(inputPath)) {
    console.error(`❌ File non trovato: ${inputPath}`);
    console.error("   Controlla di aver scritto il nome esatto e che il file sia nella cartella del progetto.");
    process.exit(1);
  }

  console.log(`Leggo ${inputPath} ...`);
  const buffer = await readFile(inputPath);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  let headerIdx = -1;
  const cols = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c) => String(c).trim().toLowerCase());
    const nomeIdx = row.findIndex((c) => c === "nome" || c === "calciatore" || c === "giocatore");
    if (nomeIdx !== -1) {
      headerIdx = i;
      row.forEach((c, idx) => {
        if (c === "nome" || c === "calciatore" || c === "giocatore") cols.nome = idx;
        if (c === "squadra") cols.squadra = idx;
        if (c === "r" || c === "ruolo") cols.ruolo = idx;
        if (c === "qt.a" || c === "qta" || c === "quotazione" || c === "quotazione attuale") cols.quot = idx;
        if (cols.quot === undefined && (c === "qt.i" || c === "qti")) cols.quot = idx;
      });
      break;
    }
  }

  if (headerIdx === -1 || cols.nome === undefined || cols.quot === undefined) {
    throw new Error("Formato del listone non riconosciuto: colonne 'Nome'/'Qt.A' non trovate.");
  }

  const players = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const nome = String(r[cols.nome] ?? "").trim();
    const quot = Number(r[cols.quot]);
    if (!nome || Number.isNaN(quot)) continue;
    players.push({
      id: `${nome}-${i}`,
      nome,
      squadra: cols.squadra !== undefined ? String(r[cols.squadra] ?? "").trim() : "",
      ruolo: cols.ruolo !== undefined ? String(r[cols.ruolo] ?? "").trim().toUpperCase() : "",
      quot,
    });
  }

  if (players.length === 0) {
    throw new Error("Nessun calciatore valido trovato nel file. Controlla che sia il formato giusto.");
  }

  const payload = {
    players,
    fetchedAt: new Date().toISOString(),
    source: "aggiornamento manuale",
    count: players.length,
  };

  if (!existsSync("public")) await mkdir("public", { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`✅ Salvati ${players.length} calciatori in ${OUTPUT_PATH}`);
  console.log(`   Ora fai: git add public/listone.json && git commit -m "Aggiorna listone" && git push`);
}

main().catch((err) => {
  console.error("❌ Errore:", err.message);
  process.exit(1);
});
