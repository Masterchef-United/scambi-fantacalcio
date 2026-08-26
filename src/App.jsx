import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Search, CheckCircle2, XCircle, ArrowLeftRight, FileSpreadsheet, RotateCcw } from "lucide-react";

// ---------- Design tokens ----------
// Palette ispirata al cartellino dell'arbitro + tabellone da stadio
const C = {
  pitch: "#0F3D2E",      // verde campo profondo 0F3D2E
  pitchDark: "#0A2A1F",
  chalk: "#F6F3EA",      // bianco gesso
  ink: "#0B1F17",
  yellow: "#F2C230",     // cartellino giallo
  red: "#D6483F",        // cartellino rosso
  green: "#4CAE6B",      // valido
  line: "rgba(246,243,234,0.14)",
};

// ---------- Regola RG ----------
function fasciaDa(media) {
  if (media <= 20) return { rg: 3, label: "0 – 20" };
  if (media <= 40) return { rg: 4, label: "21 – 40" };
  if (media <= 60) return { rg: 5, label: "41 – 60" };
  return { rg: 6, label: "60+" };
}

// ---------- Regola ruoli ----------
// Ogni ruolo ceduto deve essere compensato dallo stesso ruolo, nella stessa quantità, in ricezione.
function conteggioRuoli(players) {
  const counts = {};
  for (const p of players) {
    const r = p.ruolo || "?";
    counts[r] = (counts[r] || 0) + 1;
  }
  return counts;
}

function ruoliCompatibili(cediCounts, ricevCounts) {
  const keys = new Set([...Object.keys(cediCounts), ...Object.keys(ricevCounts)]);
  for (const k of keys) {
    if ((cediCounts[k] || 0) !== (ricevCounts[k] || 0)) return false;
  }
  return true;
}

const RUOLO_LABEL = {
  P: { s: "Portiere", p: "Portieri" },
  D: { s: "Difensore", p: "Difensori" },
  C: { s: "Centrocampista", p: "Centrocampisti" },
  A: { s: "Attaccante", p: "Attaccanti" },
};

// Colori distintivi per ruolo, usati come accento su badge e chip
const RUOLO_COLOR = {
  P: "#E8A33D", // ambra
  D: "#5AA9E6", // azzurro
  C: "#52B788", // verde turf
  A: "#D6483F", // rosso
};
function coloreRuolo(r) {
  return RUOLO_COLOR[r] || "rgba(246,243,234,0.4)";
}

function descriviConteggio(counts) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return "—";
  return entries
    .map(([r, n]) => {
      const label = RUOLO_LABEL[r] || { s: r, p: r };
      return `${n} ${n > 1 ? label.p : label.s}`;
    })
    .join(" + ");
}

// ---------- Parsing listone (per il caricamento manuale opzionale) ----------
function parseListone(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  let headerIdx = -1;
  let cols = {};
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
    throw new Error(
      "Non riesco a riconoscere le colonne del file. Assicurati che il listone abbia colonne come 'Nome' e 'Qt.A' (quotazione attuale)."
    );
  }

  const players = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const nome = String(r[cols.nome] ?? "").trim();
    const quotRaw = r[cols.quot];
    const quot = Number(quotRaw);
    if (!nome || Number.isNaN(quot)) continue;
    players.push({
      id: `${nome}-${i}`,
      nome,
      squadra: cols.squadra !== undefined ? String(r[cols.squadra] ?? "").trim() : "",
      ruolo: cols.ruolo !== undefined ? String(r[cols.ruolo] ?? "").trim().toUpperCase() : "",
      quot,
    });
  }
  if (players.length === 0) throw new Error("Il file è stato letto ma non contiene righe valide di calciatori.");
  return players;
}

// ---------- Ricerca con tendina ----------
function PlayerSearch({ listone, onAdd, disabledIds, accent }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return listone
      .filter((p) => p.nome.toLowerCase().includes(q) && !disabledIds.has(p.id))
      .slice(0, 8);
  }, [query, listone, disabledIds]);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: C.pitchDark,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: "10px 12px",
        }}
      >
        <Search size={16} color="rgba(246,243,234,0.55)" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Digita il nome del calciatore..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.chalk,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: C.pitchDark,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
          }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => {
                onAdd(p);
                setQuery("");
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "11px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: C.chalk,
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(246,243,234,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {p.ruolo && (
                <span
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: `${coloreRuolo(p.ruolo)}26`,
                    color: coloreRuolo(p.ruolo),
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: 11.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.ruolo}
                </span>
              )}
              <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.nome}
                </span>
                <span style={{ fontSize: 11.5, color: "rgba(246,243,234,0.5)" }}>{p.squadra || "—"}</span>
              </span>
              <span
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: accent,
                  minWidth: 28,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {p.quot}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerChip({ player, onRemove, accent }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: "rgba(246,243,234,0.045)",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "9px 10px",
        transition: "background 0.15s ease, transform 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {player.ruolo && (
          <span
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: 8,
              background: `${coloreRuolo(player.ruolo)}26`,
              color: coloreRuolo(player.ruolo),
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {player.ruolo}
          </span>
        )}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: C.chalk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {player.nome}
          </span>
          <span style={{ fontSize: 11, color: "rgba(246,243,234,0.5)" }}>{player.squadra || "—"}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: accent }}>
          {player.quot}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: "rgba(246,243,234,0.06)",
            border: "none",
            borderRadius: 7,
            cursor: "pointer",
            color: "rgba(246,243,234,0.55)",
            display: "flex",
            padding: 5,
            transition: "background 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(214,72,63,0.18)";
            e.currentTarget.style.color = C.red;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(246,243,234,0.06)";
            e.currentTarget.style.color = "rgba(246,243,234,0.55)";
          }}
          aria-label={`Rimuovi ${player.nome}`}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function Colonna({ titolo, accent, listone, players, setPlayers, otherIds }) {
  const total = players.reduce((s, p) => s + p.quot, 0);
  const usedIds = useMemo(() => new Set([...players.map((p) => p.id), ...otherIds]), [players, otherIds]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "rgba(0,0,0,0.14)",
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, opacity: 0.85 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3
          style={{
            fontFamily: "'Oswald', sans-serif",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
          {titolo}
        </h3>
        <span
          style={{
            fontSize: 11,
            color: "rgba(246,243,234,0.55)",
            background: "rgba(246,243,234,0.06)",
            borderRadius: 999,
            padding: "3px 9px",
          }}
        >
          {players.length}
        </span>
      </div>

      <PlayerSearch listone={listone} onAdd={(p) => setPlayers((prev) => [...prev, p])} disabledIds={usedIds} accent={accent} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 8 }}>
        {players.map((p) => (
          <PlayerChip
            key={p.id}
            player={p}
            accent={accent}
            onRemove={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: `1px solid ${C.line}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ fontSize: 12, color: "rgba(246,243,234,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
          Totale
        </span>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 30, color: accent }}>
          {total}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [listone, setListone] = useState([]);
  const [autoStatus, setAutoStatus] = useState("checking"); // checking | ok | unavailable
  const [autoFetchedAt, setAutoFetchedAt] = useState(null);
  const [autoListone, setAutoListone] = useState([]); // copia del listone ufficiale, per poter tornare indietro

  const [manualActive, setManualActive] = useState(false);
  const [manualFileName, setManualFileName] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [showManualPanel, setShowManualPanel] = useState(false);
  const fileInputRef = useRef(null);

  const [cedi, setCedi] = useState([]);
  const [ricevi, setRicevi] = useState([]);

  // Caricamento del listone dal file statico public/listone.json,
  // generato periodicamente da chi gestisce la lega tramite scripts/converti-listone.mjs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/listone.json");
        if (!res.ok) throw new Error("non disponibile");
        const data = await res.json();
        if (cancelled || !data.players?.length) return;
        setListone(data.players);
        setAutoListone(data.players);
        setAutoFetchedAt(data.fetchedAt);
        setAutoStatus("ok");
      } catch {
        if (!cancelled) setAutoStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Caricamento manuale opzionale: sostituisce il listone SOLO in questa sessione/browser,
  // senza toccare il file condiviso con il resto della lega.
  const handleManualFile = async (file) => {
    if (!file) return;
    setManualLoading(true);
    setManualError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const players = parseListone(wb);
      setListone(players);
      setManualFileName(file.name);
      setManualActive(true);
      setCedi([]);
      setRicevi([]);
    } catch (e) {
      setManualError(e.message || "Errore nella lettura del file.");
    } finally {
      setManualLoading(false);
    }
  };

  const tornaAlListoneUfficiale = () => {
    setListone(autoListone);
    setManualActive(false);
    setManualFileName("");
    setManualError("");
    setCedi([]);
    setRicevi([]);
  };

  const totalCedi = cedi.reduce((s, p) => s + p.quot, 0);
  const totalRicevi = ricevi.reduce((s, p) => s + p.quot, 0);
  const media = (totalCedi + totalRicevi) / 2;
  const diff = Math.abs(totalCedi - totalRicevi);
  const hasPlayers = cedi.length > 0 && ricevi.length > 0;
  const fascia = hasPlayers ? fasciaDa(media) : null;
  const rgOk = fascia ? diff <= fascia.rg : null;

  const cediRuoli = useMemo(() => conteggioRuoli(cedi), [cedi]);
  const ricevRuoli = useMemo(() => conteggioRuoli(ricevi), [ricevi]);
  const ruoliOk = hasPlayers ? ruoliCompatibili(cediRuoli, ricevRuoli) : null;

  const valido = hasPlayers ? rgOk && ruoliOk : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 600px at 50% -10%, #144B37 0%, ${C.pitch} 45%, ${C.pitchDark} 100%)`,
        color: C.chalk,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "24px 12px 48px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(246,243,234,0.35); }
        button { font-family: inherit; }
        @keyframes verdictPop {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .verdict-pop { animation: verdictPop 0.35s ease-out; }

        /* Layout a colonne: impilate su mobile, affiancate da tablet in su */
        .trade-columns { flex-direction: column; }
        @media (min-width: 640px) {
          .trade-columns { flex-direction: row; }
          .divider { display: flex !important; }
        }

        @media (max-width: 639px) {
          .status-card { padding: 14px !important; }
          .trade-card { padding: 14px !important; }
          .verdict-header { padding: 20px 16px !important; }
          .verdict-stats { padding: 14px 14px 16px !important; grid-template-columns: repeat(2, 1fr) !important; }
          .manual-hint { display: none; }
        }

        .btn-grow {
          transition: transform 0.15s ease;
        }

        .btn-grow:hover {
          transform: scale(1.05);
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          {/*<div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(242,194,48,0.1)",
              border: `1px solid rgba(242,194,48,0.3)`,
              borderRadius: 999,
              padding: "6px 16px",
              fontSize: 11.5,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: C.yellow,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            <ArrowLeftRight size={13} /> Validatore scambi
          </div> */}
          <h1
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(30px, 5vw, 44px)",
              margin: 0,
              letterSpacing: 0.5,
              textShadow: "0 4px 24px rgba(0,0,0,0.25)",
              marginBottom: 30,
            }}
          >
            Scambio pasta con le cozze
          </h1>
          <p style={{ color: "rgba(246,243,234,0.6)", fontSize: 14.5, marginTop: 10 }}>
            Scegli chi cedi e chi ricevi: il verdetto è automatico.
          </p>
        </div>

        {/* Stato listone (automatico da public/listone.json, con opzione di override manuale) */}
        <div
          className="status-card"
          style={{
            //background: "rgba(11,31,23,0.55)",
            //border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: 18,
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/*<div
              style={{
                width: 42,
                height: 42,
                borderRadius: 100,
                background: manualActive
                  ? "rgba(242,194,48,0.12)"
                  : autoStatus === "ok"
                  ? "rgba(76,174,107,0.12)"
                  : "rgba(242,194,48,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet
                size={20}
                color={manualActive ? C.yellow : autoStatus === "ok" ? C.green : C.yellow}
              />
            </div>*/}
            <div style={{ flex: 1, minWidth: 200,  }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, textAlign: "left" }}>
                {manualActive
                  ? "Listone caricato manualmente (temporaneo)"
                  : autoStatus === "checking"
                  ? "Caricamento listone..."
                  : autoStatus === "ok"
                  ? "Listone ufficiale caricato"
                  : "Listone non disponibile"}
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(246,243,234,0.55)", textAlign: "left" }}>
                {manualActive
                  ? `${manualFileName} · ${listone.length} calciatori · valido solo su questo dispositivo`
                  : autoStatus === "ok" && autoFetchedAt
                  ? `${listone.length} calciatori · aggiornato il ${new Date(autoFetchedAt).toLocaleString("it-IT")}`
                  : autoStatus === "unavailable"
                  ? "Il file public/listone.json non è stato trovato. Puoi caricarne uno manualmente qui sotto."
                  : "Un attimo..."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {manualActive && autoListone.length > 0 && (
                <button
                  className="btn-grow"
                  onClick={tornaAlListoneUfficiale}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: `1px solid ${C.line}`,
                    color: "rgba(246,243,234,0.75)",
                    borderRadius: 20,
                    padding: "10px 14px",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={13} /> Torna a quello ufficiale
                </button>
              )}
              <button
                className="btn-grow"
                onClick={() => setShowManualPanel((v) => !v)}
                style={{
                  width: "192px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: C.yellow,
                  color: C.ink,
                  fontWeight: 700,
                  border: `1px solid ${C.line}`,
                  borderRadius: 20,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <Upload size={13} /> Aggiorna manualmente
              </button>
            </div>
          </div>

          {showManualPanel && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${C.line}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleManualFile(e.target.files?.[0])}
                style={{ display: "none" }}
              />
              <span className="manual-hint" style={{ flex: 1, minWidth: 200, fontSize: 12, color: "rgba(246,243,234,0.5)", textAlign: "left" }}>
                Utile solo se il listone ufficiale non è ancora aggiornato o non è disponibile. Vale solo per te, in
                questo momento: non viene condiviso con gli altri utenti dell'app.
              </span>
              <button
                className="btn-grow"
                onClick={() => fileInputRef.current?.click()}
                disabled={manualLoading}
                style={{
                  width: "192px",
                  display: "flex",
                  flexShrink: 0,
                  alignItems: "center",
                  gap: 8,
                  background: C.yellow,
                  color: C.ink,
                  borderRadius: 20,
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: 12.5,
                  border: `1px solid ${C.line}`,
                  cursor: manualLoading ? "default" : "pointer",
                  opacity: manualLoading ? 0.7 : 1,
                }}
              >
                <Upload size={15} />
                {manualLoading ? "Lettura..." : "Scegli file Excel/CSV"}
              </button>
              {manualError && (
                <div style={{ width: "100%", color: "#F3B3AF", fontSize: 12.5 }}>{manualError}</div>
              )}
            </div>
          )}
        </div>

        {/* Colonne scambio */}
        <div
          className="trade-card"
          style={{
            background: "rgba(11,31,23,0.4)",
            border: `1px solid ${C.line}`,
            borderRadius: 20,
            padding: 22,
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            opacity: listone.length === 0 ? 0.45 : 1,
            pointerEvents: listone.length === 0 ? "none" : "auto",
            position: "relative",
          }}
        >
          <h1>
            <span
              className="page-title"
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.3,
                letterSpacing: 1,
                textTransform: "uppercase",
                textAlign: "center",
                display: "block",
                marginBottom: 12,
              }}
            >
              Inserisci qui i giocatori da scambiare
            </span>
          </h1>
          <div
            className="trade-columns"
            style={{ display: "flex", gap: 24, alignItems: "stretch", position: "relative" }}
          >
            <Colonna
              titolo="Cedi"
              accent={C.red}
              listone={listone}
              players={cedi}
              setPlayers={setCedi}
              otherIds={ricevi.map((p) => p.id)}
            />
            <div
              className="divider"
              style={{
                display: "none",
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: C.pitchDark,
                border: `2px solid ${C.line}`,
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.5,
                color: "rgba(246,243,234,0.55)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
              }}
            >
              VS
            </div>
            <Colonna
              titolo="Ricevi"
              accent={C.green}
              listone={listone}
              players={ricevi}
              setPlayers={setRicevi}
              otherIds={cedi.map((p) => p.id)}
            />
          </div>
          {listone.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13.5,
                color: "rgba(246,243,234,0.6)",
                textAlign: "center",
                padding: 20,
              }}
            >
              Carica prima il listone per iniziare
            </div>
          )}
        </div>

        {/* Verdetto */}
        {hasPlayers && fascia && (
          <div
            className="verdict-pop"
            style={{
              marginTop: 24,
              borderRadius: 20,
              overflow: "hidden",
              border: `1px solid ${valido ? "rgba(76,174,107,0.5)" : "rgba(214,72,63,0.5)"}`,
              background: valido
                ? "linear-gradient(160deg, rgba(76,174,107,0.14), rgba(76,174,107,0.03))"
                : "linear-gradient(160deg, rgba(214,72,63,0.14), rgba(214,72,63,0.03))",
              boxShadow: valido
                ? "0 20px 50px rgba(76,174,107,0.12)"
                : "0 20px 50px rgba(214,72,63,0.12)",
            }}
          >
            <div
              className="verdict-header"
              style={{
                padding: "26px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 14,
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: valido ? "rgba(76,174,107,0.16)" : "rgba(214,72,63,0.16)",
                  border: `2px solid ${valido ? C.green : C.red}`,
                }}
              >
                {valido ? (
                  <CheckCircle2 size={32} color={C.green} strokeWidth={2.2} />
                ) : (
                  <XCircle size={32} color={C.red} strokeWidth={2.2} />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: 26,
                    color: valido ? C.green : C.red,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {valido ? "Scambio valido" : "Scambio non valido"}
                </div>
                <div style={{ fontSize: 13.5, color: "rgba(246,243,234,0.65)", lineHeight: 1.6, marginTop: 6, maxWidth: 420 }}>
                  {!ruoliOk && (
                    <div>
                      Ruoli non compensati: cedi {descriviConteggio(cediRuoli)}, ricevi {descriviConteggio(ricevRuoli)}.
                    </div>
                  )}
                  {!rgOk && (
                    <div>
                      Differenza di {diff} {diff === 1 ? "punto" : "punti"}, oltre il range massimo di {fascia.rg}.
                    </div>
                  )}
                  {valido && (
                    <div>
                      Ruoli compensati correttamente e differenza di {diff} {diff === 1 ? "punto" : "punti"} entro il range massimo di {fascia.rg}.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className="verdict-stats"
              style={{
                padding: "18px 22px 22px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 12,
              }}
            >
              {[
                { label: "Totale ceduto", value: totalCedi, color: C.red },
                { label: "Totale ricevuto", value: totalRicevi, color: C.green },
                { label: "Media", value: media, color: C.chalk },
                { label: "Fascia", value: fascia.label, color: C.yellow, small: true },
                { label: "RG massimo", value: fascia.rg, color: C.yellow },
                { label: "Differenza", value: diff, color: rgOk ? C.green : C.red },
                { label: "Ruoli cedi", value: descriviConteggio(cediRuoli), color: C.red, small: true },
                { label: "Ruoli ricevi", value: descriviConteggio(ricevRuoli), color: C.green, small: true },
                { label: "Ruoli compensati", value: ruoliOk ? "Sì" : "No", color: ruoliOk ? C.green : C.red },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "rgba(0,0,0,0.16)",
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "rgba(246,243,234,0.5)" }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: s.small ? 16 : 23,
                      color: s.color,
                      marginTop: 3,
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(246,243,234,0.35)", marginTop: 28 }}>
          Regola: RG massimo = <br />
          · 3 (Per gli scambi con media tra 0–20) <br />
          · 4 (Per gli scambi con media tra 21–40) <br />
          · 5 (Per gli scambi con media tra 41–60) <br />
          · 6 (Per gli scambi con media oltre 60+) <br />
          Valido se |ceduto − ricevuto| ≤ RG.
        </p>
      </div>

    </div>
  );
}
