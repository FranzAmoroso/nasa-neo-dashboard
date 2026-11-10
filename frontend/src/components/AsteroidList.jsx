import { Chip } from "./Stamp";
import { dDay, distClass, fmt0, fmt1, isRecent, sizeClass } from "@/lib/neo";

/** Lista di asteroidi raggruppati per giorno, con timbro SAFE / DANGEROUS. */
export default function AsteroidList({ items, now, onPick, emptyText }) {
  if (!items.length) return <p className="empty">{emptyText}</p>;
  const groups = [];
  items.forEach((a) => {
    const key = new Date(a.t).toDateString();
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, t: a.t, items: [] });
    groups[groups.length - 1].items.push(a);
  });
  return groups.map((g) => (
    <div key={g.key}>
      <h3 className="day">{dDay.format(g.t)}</h3>
      <ul className="ledger">
        {g.items.map((a) => (
          <li key={a.id}>
            <button type="button" className={a.hazardous ? "is-hazard" : undefined} onClick={() => onPick(a.id)}>
              <span>
                <span className="n">{a.name}</span>
                <Chip hazardous={a.hazardous} />
                <span className="c">
                  {isRecent(a, now) ? "just passed, " : ""}
                  {distClass(a)}, {sizeClass(a)}
                </span>
              </span>
              <span className="v">
                {fmt1(a.ld)} <small>LD</small>
                <br />
                <small>{fmt0(a.D)} m</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  ));
}
