// Scarica la scheda in PDF con jsPDF (caricato solo al clic).
import { PLANET_BY_ID } from "./planets";
import { dDM, dDMT, dShort, distClass, fmt0, fmt1, isPast, moonCompare, sizeClass } from "./neo";

/** Contenuto comune ad anteprima e PDF: titolo, descrizione, timbro, righe. */
export function reportFor(card, asteroids, now) {
  if (card.type === "ast") {
    const a = asteroids.find((x) => x.id === card.id);
    if (!a) return null;
    const p = PLANET_BY_ID[a.body];
    return {
      title: a.name,
      desc: `${isPast(a, now) ? "Passed" : "Will pass"} near ${p.name}. ${moonCompare(a) || ""}`.trim(),
      stamp: a.hazardous ? "DANGEROUS" : "SAFE",
      head: null,
      rows: [
        ["Close approach", dDMT.format(a.t)],
        ["Closest distance", `${fmt0(a.km)} km (${fmt1(a.ld)} LD)`],
        ["Estimated diameter", `${fmt0(a.Dmin)}–${fmt0(a.D)} m`],
        ["Relative speed", `${fmt1(a.v)} km/s`],
        ["Classification", `${distClass(a)}, ${sizeClass(a)}`],
      ],
    };
  }
  if (card.type === "moon") {
    const p = PLANET_BY_ID[card.id],
      m = p.moons[card.index];
    return {
      title: m.name,
      desc: `Moon of ${p.name}.`,
      stamp: null,
      head: null,
      rows: [
        ["Diameter", `${fmt0(m.D)} km`],
        [`Distance from ${p.name}`, `${fmt0(m.a)} km`],
        ["One orbit", `${fmt1(Math.abs(m.P))} days`],
      ],
    };
  }
  const p = PLANET_BY_ID[card.id];
  const list = asteroids.filter((a) => a.body === p.id).sort((a, b) => a.t - b.t);
  return {
    title: `Close approaches to ${p.name}`,
    desc: list.length
      ? `From ${dDM.format(list[0].t)} to ${dDM.format(list[list.length - 1].t)}.`
      : "No close approaches recorded.",
    stamp: null,
    head: ["Asteroid", "Date", "Distance", "Status"],
    rows: list.map((a) => [a.name, dShort.format(a.t), `${fmt1(a.ld)} LD`, a.hazardous ? "DANGEROUS" : "SAFE"]),
  };
}

export async function downloadPdf(report) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(93, 102, 118);
  doc.text("NASA NEO Dashboard", 15, 14);
  doc.text(`Generated on ${dDM.format(Date.now())}`, W - 15, 14, { align: "right" });
  doc.setDrawColor(217, 220, 226).line(15, 17, W - 15, 17);

  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(27, 34, 48);
  doc.text(report.title, 15, 32, { maxWidth: report.stamp ? W - 85 : W - 30 });

  if (report.stamp) {
    const danger = report.stamp === "DANGEROUS";
    const [r, g, b] = danger ? [207, 43, 58] : [19, 138, 87];
    const bw = danger ? 52 : 34,
      x = W - 15 - bw,
      y = 22;
    doc
      .setDrawColor(r, g, b)
      .setLineWidth(0.8)
      .rect(x, y, bw, 15)
      .setLineWidth(0.3)
      .rect(x + 1.4, y + 1.4, bw - 2.8, 12.2);
    doc
      .setTextColor(r, g, b)
      .setFontSize(14)
      .text(report.stamp, x + bw / 2, y + 8.5, { align: "center" });
    doc.setFontSize(5.5).text("NEO CLASSIFICATION", x + bw / 2, y + 12, { align: "center" });
  }

  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(63, 71, 87);
  const desc = doc.splitTextToSize(report.desc, W - 30);
  doc.text(desc, 15, 46);
  let y = 50 + desc.length * 5;

  doc.setFontSize(10.5);
  if (report.head) {
    doc.setFont("helvetica", "bold").setTextColor(93, 102, 118);
    report.head.forEach((h, i) => doc.text(h, 15 + i * 45, y));
    y += 3;
  }
  report.rows.forEach((row) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(227, 229, 234).line(15, y, W - 15, y);
    y += 6;
    doc.setFont("helvetica", "normal").setTextColor(27, 34, 48);
    if (report.head)
      row.forEach((c, i) => {
        if (i === 3)
          doc.setTextColor(...(c === "DANGEROUS" ? [207, 43, 58] : [19, 138, 87])).setFont("helvetica", "bold");
        doc.text(String(c), 15 + i * 45, y);
      });
    else {
      doc.setTextColor(93, 102, 118).text(row[0], 15, y);
      doc
        .setTextColor(27, 34, 48)
        .setFont("helvetica", "bold")
        .text(String(row[1]), W - 15, y, { align: "right" });
    }
    y += 2;
  });

  doc.save(`NEO_${report.title.replace(/[^\w]+/g, "_")}.pdf`);
}
