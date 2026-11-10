"use client";
// Pagina principale: scena 3D a tutto schermo + rettangolo dei grafici + scheda.
//
// Flusso dei dati:
//  Terra: backend /asteroids/window -> fetchWindow(), sempre all'avvio.
//  Altri pianeti: backend /asteroids/body/{id} -> fetchBody(), solo quando
//  l'utente apre quel pianeta (il backend tiene il risultato in Redis).
//  Le due liste si uniscono in `asteroids` -> scena 3D + grafici + liste.
// L'ora è quella reale: `now` si aggiorna ogni 15 secondi e decide
// cosa è in arrivo, cosa è appena passato e cosa è già passato.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InfoCard from "./InfoCard";
import PdfPreview from "./PdfPreview";
import { ChartsButton, ChartsPage } from "./Charts";
import { createScene } from "@/lib/scene";
import { TRACKED_BODIES, dClock, fetchBody, fetchWindow, isTracked } from "@/lib/neo";
import { reportFor } from "@/lib/pdf";

const REFRESH_MS = 30 * 60 * 1000; // nuovi dati dal backend ogni 30 minuti

export default function Dashboard() {
  const canvasRef = useRef(null),
    labelsRef = useRef(null),
    panelRef = useRef(null),
    sceneRef = useRef(null);
  const [earthList, setEarthList] = useState([]);
  /** { mars: { status: "loading" | "ready" | "error", list, limited, error } } */
  const [bodies, setBodies] = useState({});
  const asteroids = useMemo(
    () => [...earthList, ...Object.values(bodies).flatMap((b) => b.list || [])],
    [earthList, bodies],
  );
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [loadStep, setLoadStep] = useState("Sun");
  const [webgl, setWebgl] = useState(true);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [card, setCard] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  // ---------- dati ----------
  const load = useCallback(async (signal) => {
    try {
      setError(null);
      const list = await fetchWindow(signal);
      setEarthList(list);
      setStatus("ready");
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(
        e.message === "Failed to fetch" ? "The server is unreachable. Check your connection and try again." : e.message,
      );
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = setInterval(() => load(ctrl.signal), REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // ---------- azioni (anche dalla scena 3D) ----------
  const actions = useRef({});
  const bodiesRef = useRef(bodies);
  bodiesRef.current = bodies;
  const loadBody = async (id) => {
    const cur = bodiesRef.current[id];
    if (!TRACKED_BODIES.includes(id) || (cur && cur.status !== "error")) return;
    setBodies((b) => ({ ...b, [id]: { status: "loading", list: [] } }));
    try {
      const res = await fetchBody(id);
      setBodies((b) => ({ ...b, [id]: { status: "ready", ...res } }));
    } catch (e) {
      setBodies((b) => ({ ...b, [id]: { status: "error", list: [], error: e.message } }));
    }
  };
  actions.current.openPlanet = (id, tab = "up") => {
    loadBody(id);
    sceneRef.current?.focus(id);
    sceneRef.current?.select(null);
    setCard({ type: "planet", id, tab });
    setChartsOpen(false);
  };
  actions.current.openMoon = (id, index) => {
    sceneRef.current?.focus(id);
    sceneRef.current?.select("moon", { planetId: id, index });
    setCard({ type: "moon", id, index });
    setChartsOpen(false);
  };
  actions.current.openAsteroid = (id) => {
    const a = asteroids.find((x) => x.id === id);
    if (!a) return;
    const t = Date.now();
    if (isTracked(a, t)) {
      sceneRef.current?.focus(a.body);
      sceneRef.current?.select("ast", id);
    } else sceneRef.current?.select(null);
    setCard({ type: "ast", id });
    setChartsOpen(false);
  };
  const closeCard = () => {
    setCard(null);
    setPdfOpen(false);
    sceneRef.current?.home();
  };

  // ---------- scena 3D ----------
  useEffect(() => {
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 720;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      sceneRef.current = createScene({
        canvas: canvasRef.current,
        labels: labelsRef.current,
        mobile,
        reduced,
        onPlanet: (id) => actions.current.openPlanet(id),
        onMoon: (id, i) => actions.current.openMoon(id, i),
        onAsteroid: (id) => actions.current.openAsteroid(id),
        getPanelRect: () => panelRef.current?.getBoundingClientRect() || null,
        onProgress: (step) => setLoadStep(step),
      });
    } catch (e) {
      console.error(e);
      setWebgl(false);
      setLoadStep(null);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    sceneRef.current?.setAsteroids(asteroids);
  }, [asteroids]);

  // ---------- tastiera ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (pdfOpen) setPdfOpen(false);
      else if (chartsOpen) setChartsOpen(false);
      else if (card) closeCard();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const body = card?.type === "ast" ? asteroids.find((a) => a.id === card.id)?.body || "earth" : card?.id || "earth";
  const report = useMemo(
    () => (pdfOpen && card ? reportFor(card, asteroids, now) : null),
    [pdfOpen, card, asteroids, now],
  );
  const showCharts = chartsOpen || !webgl;

  return (
    <main className="app">
      <canvas
        ref={canvasRef}
        id="scene"
        aria-label="3D view of the solar system with upcoming asteroids. Use the names to open their cards."
      />
      <div id="ui">
        <div id="labels" ref={labelsRef} />

        {!card && status === "ready" && (
          <div id="side">
            <ChartsButton
              asteroids={asteroids}
              now={now}
              today={today}
              body={body}
              onOpen={() => setChartsOpen(true)}
            />
          </div>
        )}

        {!card && webgl && (
          <div className="legend" aria-hidden="true">
            <span>
              <i style={{ background: "var(--upcoming)" }} />
              Upcoming asteroid
            </span>
            <span>
              <i style={{ background: "var(--hazard)" }} />
              Potentially hazardous
            </span>
            <span>
              <i style={{ background: "var(--past)" }} />
              Just passed, last 12 hours
            </span>
          </div>
        )}

        {card && (
          <InfoCard
            ref={panelRef}
            card={card}
            asteroids={asteroids}
            bodyState={card.id && card.id !== "earth" ? bodies[card.id] : null}
            onRetryBody={(id) => loadBody(id)}
            now={now}
            onClose={closeCard}
            onPlanet={(id, tab) => actions.current.openPlanet(id, tab)}
            onMoon={(id, i) => actions.current.openMoon(id, i)}
            onAsteroid={(id) => actions.current.openAsteroid(id)}
            onTab={(tab) => setCard((c) => ({ ...c, tab }))}
            onPdf={() => setPdfOpen(true)}
          />
        )}

        <p className="clock">
          <span className="sr">Current date and time: </span>
          {dClock.format(now)}
        </p>

        {showCharts && status === "ready" && (
          <ChartsPage
            asteroids={asteroids}
            now={now}
            today={today}
            body={body}
            onClose={() => setChartsOpen(false)}
            onPick={(id) => actions.current.openAsteroid(id)}
          />
        )}

        {(loadStep || status === "loading") && webgl && (
          <div id="loading" role="status">
            <strong>{status === "loading" ? "Loading asteroids from NASA" : "Preparing planet surfaces"}</strong>
            <br />
            <span>{status === "loading" ? "NeoWs, last 7 days and next 7 days" : loadStep}</span>
          </div>
        )}

        {status === "error" && (
          <div id="loading" role="alert">
            <strong>Could not load the asteroids</strong>
            <br />
            <span>{error}</span>
            <br />
            <button
              type="button"
              className="primary"
              style={{ marginTop: 10 }}
              onClick={() => {
                setStatus("loading");
                load();
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!webgl && (
          <p className="note" style={{ position: "absolute", left: 16, bottom: 60 }}>
            This browser cannot show the 3D view: WebGL is required.
          </p>
        )}

        {report && <PdfPreview report={report} onClose={() => setPdfOpen(false)} />}
      </div>
    </main>
  );
}
