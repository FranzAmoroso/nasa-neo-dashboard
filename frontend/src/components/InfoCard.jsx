"use client";
import { forwardRef } from "react";
import AsteroidList from "./AsteroidList";
import { Stamp } from "./Stamp";
import { PLANET_BY_ID } from "@/lib/planets";
import { TRACKED_BODIES } from "@/lib/neo";
import { LD_KM, dDMT, distClass, fmt0, fmt1, fmt2, isPast, isRecent, moonCompare, sizeClass } from "@/lib/neo";

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

function Head({ kicker, title, onClose }) {
  return (
    <div className="panel-head">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the card">
        <CloseIcon />
      </button>
    </div>
  );
}
function Facts({ rows, small }) {
  return (
    <dl className={`facts${small ? " small" : ""}`}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Scheda a destra (computer) o dal basso (telefono).
 * card: { type: "planet", id, tab } | { type: "moon", id, index } | { type: "ast", id }
 */
const InfoCard = forwardRef(function InfoCard(
  { card, asteroids, bodyState, onRetryBody, now, onClose, onPlanet, onMoon, onAsteroid, onTab, onPdf },
  ref,
) {
  let content = null;

  if (card.type === "planet") {
    const p = PLANET_BY_ID[card.id];
    const all = asteroids.filter((a) => a.body === p.id);
    const up = all.filter((a) => !isPast(a, now)).sort((a, b) => a.t - b.t);
    const past = all.filter((a) => isPast(a, now)).sort((a, b) => b.t - a.t);
    const tab = card.tab || "up";
    content = (
      <>
        <Head kicker={p.moons.length ? "Moons shown for reference" : "No moons"} title={p.name} onClose={onClose} />
        <p className="desc">
          {up.length
            ? `${up.length} ${up.length === 1 ? "asteroid" : "asteroids"} approaching ${p.name}.`
            : "No upcoming close approaches."}
          {p.moons.length ? " The moon orbits show how close they get." : ""}
        </p>
        {p.id !== "earth" && !TRACKED_BODIES.includes(p.id) && (
          <p className="note">NASA NeoWs does not record asteroid close approaches to {p.name}.</p>
        )}
        {bodyState?.status === "loading" && (
          <p className="note" role="status">
            Checking NASA data for close approaches to {p.name}…
          </p>
        )}
        {bodyState?.status === "error" && (
          <p className="note" role="alert">
            {bodyState.error}{" "}
            <button type="button" className="link" onClick={() => onRetryBody(p.id)}>
              Try again
            </button>
          </p>
        )}
        {bodyState?.status === "ready" && bodyState.limited && (
          <p className="note">
            Checked the {bodyState.checked} largest and hazardous asteroids passing near Earth in these days.
          </p>
        )}
        {bodyState?.status === "ready" && bodyState.quotaLow && (
          <p className="note">
            Some data is still missing: the NASA hourly limit is almost reached. It completes on its own within minutes.
          </p>
        )}
        <div className="tabs" role="tablist" aria-label="Close approaches">
          <button type="button" role="tab" aria-selected={tab === "up"} onClick={() => onTab("up")}>
            Upcoming ({up.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "past"} onClick={() => onTab("past")}>
            Passed
          </button>
          <button type="button" role="tab" aria-selected={tab === "moons"} onClick={() => onTab("moons")}>
            Moons
          </button>
        </div>
        {tab === "up" && <AsteroidList items={up} now={now} onPick={onAsteroid} emptyText="No upcoming asteroids." />}
        {tab === "past" && (
          <AsteroidList items={past} now={now} onPick={onAsteroid} emptyText="No close approaches yet." />
        )}
        {tab === "moons" &&
          (p.moons.length ? (
            <>
              <ul className="ledger">
                {p.moons.map((m, i) => (
                  <li key={m.name}>
                    <button type="button" onClick={() => onMoon(p.id, i)}>
                      <span>
                        <span className="n">{m.name}</span>
                        <span className="c">
                          {fmt0(m.a)} km from {p.name}
                        </span>
                      </span>
                      <span className="v">
                        {fmt0(m.D)} <small>km</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="empty">Showing the main moons only.</p>
            </>
          ) : (
            <p className="empty">No moons.</p>
          ))}
        <Facts rows={p.facts} small />
        <button type="button" className="primary" onClick={onPdf}>
          Preview PDF report
        </button>
      </>
    );
  }

  if (card.type === "moon") {
    const p = PLANET_BY_ID[card.id],
      m = p.moons[card.index];
    const inside = asteroids.filter((a) => a.body === p.id && !isPast(a, now) && a.km < m.a).sort((a, b) => a.t - b.t);
    content = (
      <>
        <button type="button" className="back" onClick={() => onPlanet(p.id, "moons")}>
          <BackIcon /> {p.name}
        </button>
        <Head kicker={`Moon of ${p.name}`} title={m.name} onClose={onClose} />
        <Facts
          rows={[
            ["Diameter", `${fmt0(m.D)} km`],
            [`Distance from ${p.name}`, `${fmt0(m.a)} km`],
            ["One orbit", `${fmt1(Math.abs(m.P))} days${m.P < 0 ? ", retrograde" : ""}`],
            ["In lunar distances", fmt2(m.a / LD_KM)],
          ]}
        />
        <p className="desc">
          {inside.length
            ? `${inside.length === 1 ? "One upcoming asteroid passes" : `${inside.length} upcoming asteroids pass`} closer to ${p.name} than ${m.name}:`
            : `No upcoming asteroid passes inside the orbit of ${m.name}.`}
        </p>
        <AsteroidList items={inside} now={now} onPick={onAsteroid} emptyText="" />
        <button type="button" className="primary" onClick={onPdf}>
          Preview PDF report
        </button>
      </>
    );
  }

  if (card.type === "ast") {
    const a = asteroids.find((x) => x.id === card.id);
    if (a) {
      const p = PLANET_BY_ID[a.body],
        past = isPast(a, now),
        mc = moonCompare(a);
      content = (
        <>
          <button type="button" className="back" onClick={() => onPlanet(p.id, past ? "past" : "up")}>
            <BackIcon /> {p.name}
          </button>
          <Head kicker={past ? `Passed near ${p.name}` : `Approaching ${p.name}`} title={a.name} onClose={onClose} />
          <div className="badges">
            <span className="badge">{distClass(a)}</span>
            <span className="badge">{sizeClass(a)}</span>
            <span className="badge">{past ? "passed" : "upcoming"}</span>
          </div>
          <Stamp hazardous={a.hazardous} />
          {mc && <p className="callout">{mc}</p>}
          <Facts
            rows={[
              ["Close approach", dDMT.format(a.t)],
              ["Closest distance", `${fmt0(a.km)} km`],
              ["In lunar distances", fmt1(a.ld)],
              ["Estimated diameter", `${fmt0(a.Dmin)}–${fmt0(a.D)} m`],
              ["Relative speed", `${fmt1(a.v)} km/s`],
              ["Speed in km/h", fmt0(a.v * 3600)],
            ]}
          />
          {past && (
            <p className="note">
              {isRecent(a, now)
                ? "Just passed: it stays visible in 3D for 12 hours after its close approach."
                : "Already passed: it no longer appears in 3D. You can find it in the charts, under Already passed."}
            </p>
          )}
          {a.jplUrl && (
            <a className="link" href={a.jplUrl} target="_blank" rel="noopener noreferrer">
              Open the orbit on NASA JPL
            </a>
          )}
          <button type="button" className="primary" onClick={onPdf}>
            Preview PDF report
          </button>
        </>
      );
    }
  }

  return (
    <aside ref={ref} id="panel" className="sheet-panel" aria-live="polite">
      <div className="panel-body">{content}</div>
    </aside>
  );
});

export default InfoCard;
