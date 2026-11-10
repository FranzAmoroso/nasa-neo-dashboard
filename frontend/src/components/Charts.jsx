"use client";
import { useEffect, useRef, useState } from "react";
import { Chip } from "./Stamp";
import {
  DAY,
  DIST_COLUMNS,
  SIZE_ROWS,
  WINDOW_AHEAD,
  WINDOW_BACK,
  dDM,
  dDMT,
  dShort,
  distClass,
  fmt0,
  fmt1,
  isPast,
  isRecent,
  sizeClass,
} from "@/lib/neo";
import { PLANET_BY_ID } from "@/lib/planets";

const COLORS = {
  past: "#6b7686",
  up: "#8fb8ff",
  haz: "#f2a541",
  muted: "#939eae",
  line: "rgba(231,236,242,.13)",
  fg: "#e7ecf2",
};
const logY = (ld, top, h) => top + h - ((Math.log10(Math.max(0.1, Math.min(100, ld))) + 1) / 3) * h;

/** Larghezza del contenitore, per disegnare gli SVG alla misura giusta. */
function useWidth(ref, fallback) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Grafico distanza / data: a sinistra della linea "now" i passati, a destra quelli in arrivo. */
export function Timeline({ items, now, today, onPick }) {
  const wrap = useRef(null);
  const W = Math.max(320, Math.min(1100, useWidth(wrap, 900)));
  const H = Math.round(Math.max(240, Math.min(380, W * 0.42)));
  const m = { l: 56, r: 16, t: 16, b: 34 },
    iw = W - m.l - m.r,
    ih = H - m.t - m.b;
  const x = (t) => m.l + (((t - today) / DAY + WINDOW_BACK) / (WINDOW_BACK + WINDOW_AHEAD)) * iw;
  const y = (ld) => logY(ld, m.t, ih);
  const step = W < 600 ? 2 : 1;
  const days = [];
  for (let d = -WINDOW_BACK; d <= WINDOW_AHEAD; d += step) days.push(d);
  return (
    <div className="chart-wrap" ref={wrap}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Closest distance and date of each close approach"
      >
        {[0.1, 1, 10, 100].map((v) => (
          <g key={v}>
            <line
              x1={m.l}
              x2={W - m.r}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 1 ? COLORS.muted : COLORS.line}
              strokeDasharray={v === 1 ? "4 4" : undefined}
            />
            <text x={m.l - 8} y={y(v) + 4} fill={COLORS.muted} fontSize="11.5" textAnchor="end">
              {v === 1 ? "Moon" : v}
            </text>
          </g>
        ))}
        <text
          x="12"
          y={m.t + ih / 2}
          fill={COLORS.muted}
          fontSize="11.5"
          textAnchor="middle"
          transform={`rotate(-90 12 ${m.t + ih / 2})`}
        >
          distance in LD
        </text>
        {days.map((d) => (
          <g key={d}>
            <line
              x1={x(today + d * DAY)}
              x2={x(today + d * DAY)}
              y1={m.t + ih}
              y2={m.t + ih + 4}
              stroke={COLORS.muted}
            />
            <text x={x(today + d * DAY)} y={H - 12} fill={COLORS.muted} fontSize="11.5" textAnchor="middle">
              {d === 0 ? "today" : dShort.format(today + d * DAY)}
            </text>
          </g>
        ))}
        <line x1={x(now)} x2={x(now)} y1={m.t} y2={m.t + ih} stroke={COLORS.fg} strokeWidth="1.5" />
        <text x={x(now) + 6} y={m.t + 12} fill={COLORS.fg} fontSize="11.5">
          now
        </text>
        {[...items]
          .sort((a, b) => b.D - a.D)
          .map((a) => {
            const past = isPast(a, now),
              r = Math.max(3.5, Math.min(16, 2.5 + Math.sqrt(a.D) * 0.5));
            return (
              <g
                key={a.id}
                className="dotbtn"
                tabIndex={0}
                role="button"
                aria-label={`${a.name}, ${dDM.format(a.t)}, ${fmt1(a.ld)} lunar distances, ${fmt0(a.D)} metres, ${a.hazardous ? "dangerous" : "safe"}, ${past ? "passed" : "upcoming"}`}
                onClick={() => onPick(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(a.id);
                  }
                }}
              >
                <title>{`${a.name}: ${fmt1(a.ld)} LD, ${fmt0(a.D)} m`}</title>
                <circle
                  cx={x(a.t)}
                  cy={y(a.ld)}
                  r={r}
                  fill={past ? COLORS.past : a.hazardous ? COLORS.haz : COLORS.up}
                  fillOpacity={past ? 0.7 : 0.95}
                  stroke={a.hazardous ? COLORS.haz : "none"}
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/** Asteroidi in arrivo per distanza e dimensione. */
export function SizeMatrix({ upcoming }) {
  const cells = SIZE_ROWS.map((r) => DIST_COLUMNS.map((c) => upcoming.filter((a) => r[2](a) && c[1](a))));
  const max = Math.max(1, ...cells.flat().map((l) => l.length));
  return (
    <div className="matrix" role="table" aria-label="Upcoming asteroids by closest distance and size">
      <span className="h" />
      {DIST_COLUMNS.map(([label]) => (
        <span className="h" key={label}>
          {label}
        </span>
      ))}
      {SIZE_ROWS.map((r, i) => [
        <span className="r" key={r[0]}>
          {r[0]}
          <small>{r[1]}</small>
        </span>,
        ...cells[i].map((list, j) => {
          const n = list.length,
            haz = list.some((a) => a.hazardous);
          return (
            <div
              key={`${i}-${j}`}
              className={`cell${n ? "" : " zero"}${haz ? " has-haz" : ""}`}
              style={{
                background: n ? `rgba(143,184,255,${(0.08 + (0.3 * n) / max).toFixed(2)})` : "rgba(231,236,242,.03)",
              }}
            >
              <b>{n}</b>
              {haz && <span className="hz">includes DANGEROUS</span>}
            </div>
          );
        }),
      ])}
    </div>
  );
}

/** In arrivo e più vicini della Luna, oppure pericolosi. */
export function WatchList({ upcoming, onPick }) {
  const list = upcoming.filter((a) => a.ld < 1 || a.hazardous).sort((a, b) => a.t - b.t);
  if (!list.length) return <p className="empty">No upcoming asteroids to watch.</p>;
  const bx = (ld) => 4 + ((Math.log10(Math.max(0.1, Math.min(100, ld))) + 1) / 3) * 120;
  return (
    <ul className="watch">
      {list.map((a) => (
        <li key={a.id}>
          <button type="button" className={a.hazardous ? "haz" : undefined} onClick={() => onPick(a.id)}>
            <span>
              <span className="n">{a.name}</span>
              <Chip hazardous={a.hazardous} />
              <span className="c">
                {a.ld < 1 ? "closer than the Moon" : "beyond the Moon"}, {dShort.format(a.t)}, {fmt0(a.D)} m
              </span>
            </span>
            <svg width="128" height="22" viewBox="0 0 128 22" aria-hidden="true">
              <line
                x1="4"
                x2="124"
                y1="11"
                y2="11"
                stroke="rgba(231,236,242,.18)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <line x1={bx(1)} x2={bx(1)} y1="4" y2="18" stroke={COLORS.fg} />
              <circle cx={bx(a.ld)} cy="11" r="5" fill={a.hazardous ? COLORS.haz : COLORS.up} />
            </svg>
            <span className="ld">{fmt1(a.ld)} LD</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Riga per le liste in riquadro (già passati). */
function Row({ a, now, onPick }) {
  return (
    <button type="button" className={`row past${a.hazardous ? " haz" : ""}`} onClick={() => onPick(a.id)}>
      <span>
        <span className="n">{a.name}</span>
        <Chip hazardous={a.hazardous} />
        <span className="c">
          {isRecent(a, now) ? "just passed" : "passed"}, {distClass(a)}, {sizeClass(a)}
        </span>
      </span>
      <span className="v">{dShort.format(a.t)}</span>
      <span className="v">{fmt1(a.ld)} LD</span>
      <span className="v">{fmt0(a.D)} m</span>
    </button>
  );
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <p>
        <strong>Built by Franz Amoroso © 2026</strong>Data provided by NASA&apos;s NeoWs API
      </p>
      <a
        className="gh"
        href="https://github.com/FranzAmoroso/nasa-neo-dashboard"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        View on GitHub
      </a>
    </footer>
  );
}

/** Pagina intera dei grafici, si chiude con la X. */
export function ChartsPage({ asteroids, now, today, body, onClose, onPick }) {
  const p = PLANET_BY_ID[body];
  const all = asteroids.filter((a) => a.body === body);
  const up = all.filter((a) => !isPast(a, now)),
    past = all.filter((a) => isPast(a, now)).sort((a, b) => b.t - a.t);
  const closest = [...up].sort((a, b) => a.ld - b.ld)[0];
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <section id="charts" role="dialog" aria-modal="true" aria-labelledby="chTitle">
      <button
        ref={closeRef}
        type="button"
        className="close-x"
        onClick={onClose}
        aria-label="Close the charts and return to the 3D view"
      >
        <CloseIcon />
      </button>
      <div className="charts-inner">
        <div>
          <p className="kicker">
            {dDM.format(today - WINDOW_BACK * DAY)} to {dDM.format(today + WINDOW_AHEAD * DAY)}
          </p>
          <h2 id="chTitle">Close approaches to {p.name}</h2>
          <p className="lead">
            {up.length} upcoming as of {dDMT.format(now)}.
            {closest
              ? ` The closest upcoming one is ${closest.name}, at ${fmt1(closest.ld)} lunar distances on ${dDM.format(closest.t)}.`
              : ""}
          </p>
        </div>
        <div className="chart-card">
          <h3>When they pass and how close</h3>
          <p>
            Each dot is an asteroid, sized by its estimated diameter. The vertical line is now: passed asteroids on the
            left, upcoming ones on the right. Tap a dot to open its card.
          </p>
          <div className="keys">
            <span>
              <i style={{ background: COLORS.past }} />
              Passed
            </span>
            <span>
              <i style={{ background: COLORS.up }} />
              Upcoming
            </span>
            <span>
              <i style={{ background: COLORS.haz }} />
              Potentially hazardous
            </span>
          </div>
          <Timeline items={all} now={now} today={today} onPick={onPick} />
        </div>
        <div className="class-grid">
          <div className="chart-card">
            <h3>Distance and size</h3>
            <p>
              Upcoming asteroids by closest distance and size. The fuller the cell, the more there are. An orange border
              marks cells with dangerous asteroids.
            </p>
            <SizeMatrix upcoming={up} />
          </div>
          <div className="chart-card">
            <h3>Watch list</h3>
            <p>
              Upcoming asteroids that pass closer than the Moon or are potentially hazardous. The bar shows the closest
              distance; the light tick is the Moon.
            </p>
            <WatchList upcoming={up} onPick={onPick} />
          </div>
        </div>
        <div className="chart-card">
          <h3>Already passed</h3>
          <p>
            Every asteroid that has already made its close approach, most recent first. They leave the 3D view 12 hours
            after passing.
          </p>
          <div className="list-cols" aria-hidden="true">
            <span>Asteroid</span>
            <span>Date</span>
            <span>Distance</span>
            <span>Diam.</span>
          </div>
          <div className="past-box" tabIndex={0} aria-label="Already passed asteroids">
            {past.length ? (
              past.map((a) => <Row key={a.id} a={a} now={now} onPick={onPick} />)
            ) : (
              <p className="empty" style={{ padding: 12 }}>
                No close approaches have happened yet in this period.
              </p>
            )}
          </div>
        </div>
        <SiteFooter />
      </div>
    </section>
  );
}

/** Rettangolo con il grafico in miniatura: apre la pagina dei grafici. */
export function ChartsButton({ asteroids, now, today, body, onOpen }) {
  const p = PLANET_BY_ID[body];
  const all = asteroids.filter((a) => a.body === body),
    up = all.filter((a) => !isPast(a, now));
  const tw = 240,
    th = 44;
  const X = (t) => 4 + (((t - today) / DAY + WINDOW_BACK) / (WINDOW_BACK + WINDOW_AHEAD)) * (tw - 8);
  const Y = (ld) => logY(ld, 4, th - 8);
  return (
    <button type="button" className="charts-btn" onClick={onOpen} aria-haspopup="dialog">
      <span className="cb-title">Charts and classification</span>
      <svg className="cb-arrow" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <svg className="cb-thumb" width={tw} height={th} viewBox={`0 0 ${tw} ${th}`} aria-hidden="true">
        <line x1="0" x2={tw} y1={Y(1)} y2={Y(1)} stroke="rgba(231,236,242,.25)" strokeDasharray="3 3" />
        <line x1={X(now)} x2={X(now)} y1="0" y2={th} stroke={COLORS.fg} />
        {all.map((a) => (
          <circle
            key={a.id}
            cx={X(a.t)}
            cy={Y(a.ld)}
            r={Math.max(1.6, Math.min(5.5, 1 + Math.sqrt(a.D) * 0.18))}
            fill={isPast(a, now) ? COLORS.past : a.hazardous ? COLORS.haz : COLORS.up}
          />
        ))}
      </svg>
      <span className="cb-sub">
        {up.length} upcoming near {p.name}
      </span>
    </button>
  );
}
