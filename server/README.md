# Backend NASA NEO (FastAPI)

Proxy tra il frontend e NASA NeoWs. Il browser non chiama mai `api.nasa.gov`.

## Endpoint

`GET /asteroids/feed?start_date=gg-mm-aaaa&end_date=gg-mm-aaaa`

- `end_date` è facoltativa (default: uguale a `start_date`).
- Intervallo massimo: 31 giorni. Errori di validazione → `422`.
- Risposta: stessa forma di NeoWs (`element_count`, `near_earth_objects` per data)
  più `start_date`, `end_date`, `cached_days`, `fetched_days`.

`GET /home` → `{"server": "online"}` (health check).

## Come gestisce il limite NASA dei 7 giorni

1. Il range viene diviso in giorni e cercato in Redis con una sola `MGET`
   (chiave `nasa:day:aaaa-mm-gg`).
2. I giorni mancanti vengono raggruppati in blocchi contigui di massimo 7 giorni
   e scaricati in parallelo.
3. Ogni giorno scaricato viene salvato da solo: un range che si sovrappone a uno
   già visto scarica solo i giorni nuovi.
4. Scadenza: 7 giorni per le date passate, 6 ore per oggi e il futuro.

Se Redis non è configurato o non risponde il servizio funziona lo stesso, senza cache.

## Variabili d'ambiente

```env
API_KEY=tua_chiave_nasa          # https://api.nasa.gov (default: DEMO_KEY)
API_URL=https://api.nasa.gov/neo/rest/v1/feed   # facoltativa
REDIS_PUBLIC_URL=redis://...     # oppure REDIS_URL; facoltativa
```

## Avvio in locale

```bash
pip install -r requirements.txt
sudo service redis-server start   # facoltativo
uvicorn main:app --reload
```
