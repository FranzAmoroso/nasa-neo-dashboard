"use client";
import { useEffect, useRef, useState } from "react";
import { dDM } from "@/lib/neo";
import { downloadPdf } from "@/lib/pdf";

/** Anteprima del PDF a pagina intera: si chiude con la X, scarica con il pulsante. */
export default function PdfPreview({ report, onClose }) {
  const closeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  if (!report) return null;

  const download = async () => {
    setBusy(true);
    try {
      await downloadPdf(report);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="pdf" role="dialog" aria-modal="true" aria-labelledby="pdfTitle">
      <button ref={closeRef} type="button" className="close-x" onClick={onClose} aria-label="Close the PDF preview">
        <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
      <div className="sheet">
        <header>
          <span>NASA NEO Dashboard</span>
          <span>Generated on {dDM.format(Date.now())}</span>
        </header>
        {report.stamp && (
          <div
            className={`stamp ${report.stamp === "DANGEROUS" ? "danger" : "safe"}`}
            role="img"
            aria-label={`Classification: ${report.stamp.toLowerCase()}`}
          >
            {report.stamp}
            <small>NEO CLASSIFICATION</small>
          </div>
        )}
        <h3 id="pdfTitle" className={report.stamp ? "with-stamp" : undefined}>
          {report.title}
        </h3>
        <p>{report.desc}</p>
        <table>
          {report.head && (
            <thead>
              <tr>
                {report.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {report.rows.map((row, i) => (
              <tr key={i}>
                {report.head
                  ? row.map((c, j) => (
                      <td key={j} className={j === 3 ? (c === "DANGEROUS" ? "st-danger" : "st-safe") : undefined}>
                        {c}
                      </td>
                    ))
                  : [
                      <td key="k">{row[0]}</td>,
                      <td key="v" className="val">
                        {row[1]}
                      </td>,
                    ]}
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="download" onClick={download} disabled={busy}>
          {busy ? "Preparing the PDF…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
