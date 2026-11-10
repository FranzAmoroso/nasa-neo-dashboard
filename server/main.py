import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from control import MAX_RANGE_DAYS, parse_it_date
from db import get_feed
from neo import normalize_feed
from bodies import LOOKUP_LIMIT, get_body_window

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="NASA NEO proxy")

origins = [
    "https://nasa-neo-dashboard-franzamorosos-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://nasa-neo-dashboard-.*-franzamorosos-projects\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATE_PATTERN = r"^\d{2}-\d{2}-\d{4}$"
MAX_WINDOW_SIDE = 15  # giorni prima e dopo oggi: 15 + 1 + 15 = 31, il massimo del feed


@app.get("/home")
async def health_check():
    return {"server": "online"}


@app.get("/asteroids/window")
async def get_window(
    back: int = Query(7, ge=0, le=MAX_WINDOW_SIDE, description="giorni prima di oggi"),
    ahead: int = Query(7, ge=0, le=MAX_WINDOW_SIDE, description="giorni dopo oggi"),
):
    """Asteroidi già passati e in arrivo attorno a oggi, già normalizzati.

    È l'endpoint usato dalla dashboard 3D: il frontend decide da solo cosa è
    passato e cosa è in arrivo confrontando `approach_utc` con l'ora attuale.
    """
    today = datetime.now(timezone.utc).date()
    start, end = today - timedelta(days=back), today + timedelta(days=ahead)
    feed = await get_feed(start, end)
    return {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "asteroids": normalize_feed(feed),
    }


@app.get("/asteroids/body/{body}")
async def get_body(
    body: str,
    back: int = Query(7, ge=0, le=MAX_WINDOW_SIDE),
    ahead: int = Query(7, ge=0, le=MAX_WINDOW_SIDE),
    limit: int = Query(LOOKUP_LIMIT, ge=1, le=150, description="schede NASA controllate al massimo"),
):
    """Passaggi vicino a un altro pianeta (mercury, venus, mars, jupiter), caricati solo quando servono.

    Il risultato resta in Redis 6 ore e ogni scheda asteroide 30 giorni:
    le richieste successive non chiamano più la NASA.
    """
    today = datetime.now(timezone.utc).date()
    return await get_body_window(body.lower(), today - timedelta(days=back), today + timedelta(days=ahead), limit)


@app.get("/asteroids/feed")
async def get_asteroids(
    start_date: str = Query(..., pattern=DATE_PATTERN, description="dd-mm-yyyy"),
    end_date: Optional[str] = Query(None, pattern=DATE_PATTERN, description="dd-mm-yyyy"),
):
    """Risposta NeoWs grezza per un intervallo (compatibile con la versione precedente)."""
    try:
        start = parse_it_date(start_date)
        end = parse_it_date(end_date) if end_date else start
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date")

    if end < start:
        raise HTTPException(status_code=422, detail="The end date is before the start date")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(status_code=422, detail=f"The range can be at most {MAX_RANGE_DAYS} days")

    return await get_feed(start, end)
