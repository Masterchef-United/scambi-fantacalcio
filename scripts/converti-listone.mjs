// File: scripts/converti-listone.mjs
// Converte un file Excel del listone (scaricato manualmente da loggato su Fantacalcio.it)
// in DUE file: public/listone.json (schema classico) e public/listone-mantra.json (schema Mantra).
// Il file Excel di Fantacalcio.it contiene di norma entrambi gli schemi nello stesso foglio
// (colonne R/RM per i ruoli, Qt.A/Qt.A M per le quotazioni).
//
// USO:
//   1. Vai su fantacalcio.it/quotazioni-fantacalcio da loggato
//   2. Clicca su "Scarica" per ottenere il file Excel
//   3. Sposta il file scaricato nella cartella principale del progetto
//   4. Esegui: node scripts/converti-listone.mjs nome-del-file-scaricato.xlsx
//   5. Fai commit + push di public/listone.json e public/listone-mantra.json su GitHub

import * as XLSX from "xlsx";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";

function normalizza(h) {
  return String(h).trim().toLowerCase().replace(/[.\s]/g, "");
}

function trovaColonne(headerRow) {
  const norm = headerRow.map(normalizza);
  const trova = (candidati) => {
    for (const cand of candidati) {
      const idx = norm.indexOf(cand);
      if (idx !== -1) return idx;
    }
    return undefined;
  };
  return {
    nome: trova(["nome", "calciatore", "giocatore"]),
    squadra: trova(["squadra"]),
    ruoloClassico: trova(["r", "ruolo"]),
    ruoloMantra: trova(["rm", "ruolomantra"]),
    quotClassica: trova(["qta", "quotazione", "quotazioneattuale", "qti"]),
    quotMantra: trova(["qtam", "quotazionemantra", "qtim"]),
  };
}

function estraiGiocatori(rows, headerIdx, cols, campoRuolo, campoQuot) {
  const players = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const nome = String(r[cols.nome] ?? "").trim();
    const quot = Number(r[cols[campoQuot]]);
    if (!nome || Number.isNaN(quot)) continue;
    players.push({
      id: `${nome}-${i}`,
      nome,
      squadra: cols.squadra !== undefined ? String(r[cols.squadra] ?? "").trim() : "",
      ruolo: cols[campoRuolo] !== undefined ? String(r[cols[campoRuolo]] ?? "").trim().toUpperCase() : "",
      quot,
    });
  }
  return players;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("❌ Devi indicare il file Excel da convertire.");
    console.error("   Esempio: node scripts/converti-listone.mjs Quotazioni_Fantacalcio.xlsx");
    process.exit(1);
  }
  if (!existsSync(inputPath)) {
    console.error(`❌ File non trovato: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Leggo ${inputPath} ...`);
  const buffer = await readFile(inputPath);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  let headerIdx = -1;
  let cols = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const candidateCols = trovaColonne(rows[i]);
    if (candidateCols.nome !== undefined) {
      headerIdx = i;
      cols = candidateCols;
      break;
    }
  }

  if (headerIdx === -1 || !cols || cols.nome === undefined) {
    throw new Error("Formato del listone non riconosciuto: colonna 'Nome' non trovata.");
  }

  if (!existsSync("public")) await mkdir("public", { recursive: true });

  // ---- Listone classico ----
  if (cols.quotClassica === undefined) {
    console.warn("⚠️  Colonna quotazione classica (Qt.A) non trovata: salto la generazione di listone.json");
  } else {
    const players = estraiGiocatori(rows, headerIdx, cols, "ruoloClassico", "quotClassica");
    if (players.length === 0) {
      console.warn("⚠️  Nessun calciatore valido trovato per lo schema classico.");
    } else {
      await writeFile(
        "public/listone.json",
        JSON.stringify({ players, fetchedAt: new Date().toISOString(), source: "aggiornamento manuale", count: players.length }, null, 2),
        "utf-8"
      );
      console.log(`✅ Salvati ${players.length} calciatori in public/listone.json (classico)`);
    }
  }

  // ---- Listone Mantra ----
  if (cols.quotMantra === undefined || cols.ruoloMantra === undefined) {
    console.warn("⚠️  Colonne Mantra (RM / Qt.A M) non trovate nel file: salto la generazione di listone-mantra.json");
    console.warn("    Se il tuo listone Mantra è in un file Excel separato, esegui di nuovo lo script su quel file");
    console.warn("    aggiungendo il flag --mantra, es:");
    console.warn("    node scripts/converti-listone.mjs FileMantra.xlsx --mantra");
  } else {
    const players = estraiGiocatori(rows, headerIdx, cols, "ruoloMantra", "quotMantra");
    if (players.length === 0) {
      console.warn("⚠️  Nessun calciatore valido trovato per lo schema Mantra.");
    } else {
      await writeFile(
        "public/listone-mantra.json",
        JSON.stringify({ players, fetchedAt: new Date().toISOString(), source: "aggiornamento manuale", count: players.length }, null, 2),
        "utf-8"
      );
      console.log(`✅ Salvati ${players.length} calciatori in public/listone-mantra.json (Mantra)`);
    }
  }

  // ---- Caso file separato dedicato solo al Mantra (flag --mantra) ----
  if (process.argv.includes("--mantra") && cols.quotClassica !== undefined && cols.quotMantra === undefined) {
    const players = estraiGiocatori(rows, headerIdx, cols, "ruoloClassico", "quotClassica");
    await writeFile(
      "public/listone-mantra.json",
      JSON.stringify({ players, fetchedAt: new Date().toISOString(), source: "aggiornamento manuale (file dedicato)", count: players.length }, null, 2),
      "utf-8"
    );
    console.log(`✅ Salvati ${players.length} calciatori in public/listone-mantra.json (da file dedicato)`);
  }
}

main().catch((err) => {
  console.error("❌ Errore:", err.message);
  process.exit(1);
});
