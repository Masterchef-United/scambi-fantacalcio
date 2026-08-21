import { useState, useMemo, useRef, useEffect } from "react";
import { X, Search, CheckCircle2, XCircle, ArrowLeftRight, FileSpreadsheet } from "lucide-react";

// ---------- Design tokens ----------
// Palette ispirata al cartellino dell'arbitro + tabellone da stadio
const C = {
  pitch: "#0F3D2E",      // verde campo profondo
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
          borderRadius: 10,
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
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
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
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: C.chalk,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(246,243,234,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</span>
                <span style={{ fontSize: 11.5, color: "rgba(246,243,234,0.55)" }}>
                  {[p.ruolo, p.squadra].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <span
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  color: accent,
                  minWidth: 30,
                  textAlign: "right",
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
        background: "rgba(246,243,234,0.05)",
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "9px 10px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13.5, color: C.chalk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {player.nome}
        </span>
        <span style={{ fontSize: 11, color: "rgba(246,243,234,0.5)" }}>
          {[player.ruolo, player.squadra].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: accent }}>
          {player.quot}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(246,243,234,0.45)",
            display: "flex",
            padding: 2,
          }}
          aria-label={`Rimuovi ${player.nome}`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function Colonna({ titolo, accent, listone, players, setPlayers, otherIds }) {
  const total = players.reduce((s, p) => s + p.quot, 0);
  const usedIds = useMemo(() => new Set([...players.map((p) => p.id), ...otherIds]), [players, otherIds]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h3
          style={{
            fontFamily: "'Oswald', sans-serif",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            margin: 0,
          }}
        >
          {titolo}
        </h3>
        <span style={{ fontSize: 11.5, color: "rgba(246,243,234,0.5)" }}>{players.length} giocatori</span>
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
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 28, color: accent }}>
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
        padding: "32px 16px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(246,243,234,0.35); }
        button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(246,243,234,0.08)",
              border: `1px solid ${C.line}`,
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 11.5,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: C.yellow,
              marginBottom: 14,
            }}
          >
            <ArrowLeftRight size={13} /> Validatore scambi
          </div>
          <h1
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 42px)",
              margin: 0,
              letterSpacing: 0.5,
            }}
          >
            Scambio Fantacalcio
          </h1>
          <p style={{ color: "rgba(246,243,234,0.6)", fontSize: 14.5, marginTop: 8 }}>
            Carica il listone, scegli chi cedi e chi ricevi: il verdetto è automatico.
          </p>
        </div>

        {/* Stato listone (caricato automaticamente da public/listone.json) */}
        <div
          style={{
            background: "rgba(11,31,23,0.55)",
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: 18,
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background:
                autoStatus === "ok" ? "rgba(76,174,107,0.12)" : "rgba(242,194,48,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileSpreadsheet size={20} color={autoStatus === "ok" ? C.green : C.yellow} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>
              {autoStatus === "checking" && "Caricamento listone..."}
              {autoStatus === "ok" && "Listone ufficiale caricato"}
              {autoStatus === "unavailable" && "Listone non disponibile"}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(246,243,234,0.55)" }}>
              {autoStatus === "ok" && autoFetchedAt
                ? `${listone.length} calciatori · aggiornato il ${new Date(autoFetchedAt).toLocaleString("it-IT")}`
                : autoStatus === "unavailable"
                ? "Il file public/listone.json non è stato trovato. Contatta chi gestisce l'app."
                : "Un attimo..."}
            </div>
          </div>
        </div>

        {/* Colonne scambio */}
        <div
          style={{
            background: "rgba(11,31,23,0.4)",
            border: `1px solid ${C.line}`,
            borderRadius: 18,
            padding: 22,
            opacity: listone.length === 0 ? 0.45 : 1,
            pointerEvents: listone.length === 0 ? "none" : "auto",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Colonna
              titolo="Cedi"
              accent={C.red}
              listone={listone}
              players={cedi}
              setPlayers={setCedi}
              otherIds={ricevi.map((p) => p.id)}
            />
            <div
              style={{
                width: 1,
                background: C.line,
                alignSelf: "stretch",
                display: "none",
              }}
              className="divider"
            />
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
            style={{
              marginTop: 24,
              borderRadius: 18,
              overflow: "hidden",
              border: `1px solid ${valido ? "rgba(76,174,107,0.5)" : "rgba(214,72,63,0.5)"}`,
              background: valido ? "rgba(76,174,107,0.08)" : "rgba(214,72,63,0.08)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              {valido ? (
                <CheckCircle2 size={30} color={C.green} strokeWidth={2} />
              ) : (
                <XCircle size={30} color={C.red} strokeWidth={2} />
              )}
              <div>
                <div
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: 22,
                    color: valido ? C.green : C.red,
                    letterSpacing: 0.5,
                  }}
                >
                  {valido ? "Scambio valido" : "Scambio non valido"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(246,243,234,0.6)", lineHeight: 1.5 }}>
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
              style={{
                padding: "16px 24px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 16,
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
                <div key={s.label}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "rgba(246,243,234,0.5)" }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: s.small ? 17 : 24,
                      color: s.color,
                      marginTop: 2,
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, color: "rgba(246,243,234,0.35)", marginTop: 28 }}>
          Regola: RG massimo = 3 (media 0–20) · 4 (21–40) · 5 (41–60) · 6 (60+). Valido se |ceduto − ricevuto| ≤ RG.
        </p>
      </div>

      <style>{`
        @media (min-width: 560px) {
          .divider { display: block !important; }
        }
      `}</style>
    </div>
  );
}
