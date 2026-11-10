# NASA NEO Dashboard

A 3D view of the solar system that tracks near-Earth asteroids: the ones that are about to pass, the ones that just passed, and a full history in the charts page. Data comes from NASA NeoWs through a small FastAPI proxy.

## How it works

```
NASA NeoWs ──► FastAPI (server/) ──► Next.js (frontend/)
               · splits ranges into 7-day calls      · Three.js scene: planets, moons, asteroids
               · Redis cache, one key per day        · charts page, SAFE / DANGEROUS stamps
               · /asteroids/window, ready to use     · PDF reports with jsPDF
```

- **3D view**: only asteroids that are still coming, plus the ones that passed in the last 12 hours. Tap a planet to zoom in; its moons are drawn on the same scale as the asteroid fly-bys, so you can see whether one passes inside the Moon's orbit.
- **Charts and classification**: opened from the small chart button. Distance/date timeline, distance × size grid, watch list, already-passed list and the site footer.
- **Other planets**: Earth data loads at start; asteroids near Mercury, Venus, Mars and Jupiter load only when you open that planet. When the NASA hourly quota runs low, the backend serves cached data only, so Earth keeps working.
- **Time** is always real time: the clock decides what is upcoming and what has passed.

## Backend (`server/`)

| Endpoint | What it returns |
| --- | --- |
| `GET /asteroids/window?back=7&ahead=7` | Normalised asteroids from `back` days ago to `ahead` days ahead (max 15 each) |
| `GET /asteroids/body/{planet}?back=7&ahead=7&limit=60` | Close approaches to Mercury, Venus, Mars or Jupiter, requested only when that planet is opened. Each asteroid sheet is cached for 30 days, each result for 6 hours |
| `GET /asteroids/feed?start_date=dd-mm-yyyy&end_date=dd-mm-yyyy` | Raw NeoWs feed for any range up to 31 days |
| `GET /home` | Health check |

```bash
cd server
pip install -r requirements.txt
export API_KEY=your_nasa_key REDIS_URL=redis://localhost:6379   # Redis is optional
# optional: LOOKUP_LIMIT=60 (sheets checked per planet), QUOTA_RESERVE=150 (stop new lookups below this many NASA calls left this hour)
uvicorn main:app --reload
```

## Frontend (`frontend/`)

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

| File | Role |
| --- | --- |
| `src/components/Dashboard.jsx` | Page state: data loading, clock, open card, charts, PDF |
| `src/lib/scene.js` | Three.js scene: planets, moons, asteroid fly-bys, camera, labels |
| `src/lib/textures.js` | Procedural planet surfaces (no image downloads) |
| `src/lib/neo.js` | API call, data model, classification, formats |
| `src/lib/planets.js` | Planets and main moons |
| `src/lib/pdf.js` | Report content and PDF download |
| `src/components/Charts.jsx` | Charts page and the chart button |
| `src/components/InfoCard.jsx` | Planet, moon and asteroid cards |

Built by Franz Amoroso. Data provided by NASA's NeoWs API.
