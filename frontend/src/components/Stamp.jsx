/** Timbro grande SAFE / DANGEROUS per la scheda dell'asteroide. */
export function Stamp({ hazardous }) {
  return hazardous ? (
    <div className="stamp danger" role="img" aria-label="Classification: dangerous">
      DANGEROUS<small>NEO CLASSIFICATION</small>
    </div>
  ) : (
    <div className="stamp safe" role="img" aria-label="Classification: safe">
      SAFE<small>NEO CLASSIFICATION</small>
    </div>
  );
}

/** Timbro piccolo da mettere accanto al nome nelle liste. */
export function Chip({ hazardous }) {
  return hazardous ? <span className="chip-st danger">DANGEROUS</span> : <span className="chip-st safe">SAFE</span>;
}
