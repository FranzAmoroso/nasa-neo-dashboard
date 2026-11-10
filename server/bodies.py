"""Asteroidi che passano vicino agli altri pianeti (Mercurio, Venere, Marte, Giove).

Il feed NeoWs riporta solo i passaggi vicino alla Terra. La scheda del singolo
asteroide (/neo/{id}) invece elenca tutti i suoi passaggi, ognuno con il corpo
celeste (`orbiting_body`). Il flusso di get_body_window():

1. se il risultato per quel pianeta e quella finestra è già in Redis, lo restituisce
   subito (chiave nasa:body:{pianeta}:{inizio}:{fine}, 6 ore);
2. altrimenti prende gli asteroidi della finestra dal feed della Terra;
3. ne controlla al massimo LOOKUP_LIMIT, prima i pericolosi e i più grandi;
4. per ognuno legge la scheda dalla cache (nasa:neo:{id}, 30 giorni) o la scarica
   da NASA, al massimo LOOKUP_CONCURRENCY alla volta, e la salva in forma ridotta;
5. tiene i passaggi vicino al pianeta richiesto che cadono nella finestra.

Limite noto: si trovano solo gli asteroidi che nella stessa finestra passano anche
vicino alla Terra, perché NeoWs non offre una ricerca per pianeta.
"""

import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from db import API_KEY, RATE, cache_get_json, cache_set_json, get_feed, note_rate_limit

log = logging.getLogger("neo.bodies")

LOOKUP_URL = os.getenv("LOOKUP_URL", "https://api.nasa.gov/neo/rest/v1/neo/{id}")
LOOKUP_LIMIT = int(os.getenv("LOOKUP_LIMIT", "60"))          # schede controllate per richiesta
LOOKUP_CONCURRENCY = int(os.getenv("LOOKUP_CONCURRENCY", "6"))
# Sotto questa soglia di richieste NASA rimaste nell'ora non si scaricano nuove
# schede: si usano solo quelle già in cache, così la Terra resta sempre servita.
QUOTA_RESERVE = int(os.getenv("QUOTA_RESERVE", "150"))
NEO_TTL = 60 * 60 * 24 * 30   # le orbite previste cambiano poco: 30 giorni
BODY_TTL = 60 * 60 * 6        # risultato per pianeta e finestra: 6 ore

# nome nell'interfaccia -> nome usato da NeoWs in orbiting_body
BODY_CODES = {"mercury": "Merc", "venus": "Venus", "mars": "Mars", "jupiter": "Juptr"}
UNTRACKED = {"saturn", "uranus", "neptune"}

LD_KM = 384400


def _f(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _reduce(raw: dict) -> dict:
    """Tiene della scheda NASA solo quello che serve: pesa pochi KB invece di centinaia."""
    meters = raw.get("estimated_diameter", {}).get("meters", {})
    return {
        "id": raw.get("id"),
        "name": (raw.get("name") or "").replace("(", "").replace(")", "").strip(),
        "diameter_min_m": _f(meters.get("estimated_diameter_min")),
        "diameter_max_m": _f(meters.get("estimated_diameter_max")),
        "hazardous": bool(raw.get("is_potentially_hazardous_asteroid")),
        "jpl_url": raw.get("nasa_jpl_url"),
        "approaches": [
            {
                "epoch_ms": a.get("epoch_date_close_approach"),
                "body": a.get("orbiting_body"),
                "km": _f(a.get("miss_distance", {}).get("kilometers")),
                "kms": _f(a.get("relative_velocity", {}).get("kilometers_per_second")),
            }
            for a in raw.get("close_approach_data", [])
            if a.get("orbiting_body") in BODY_CODES.values()
        ],
    }


def quota_low() -> bool:
    return RATE["remaining"] is not None and RATE["remaining"] < QUOTA_RESERVE


async def _lookup(client: httpx.AsyncClient, sem: asyncio.Semaphore, neo_id: str, cache_only: bool):
    key = f"nasa:neo:{neo_id}"
    cached = await cache_get_json(key)
    if cached is not None or cache_only:
        return cached
    async with sem:
        if quota_low():  # la soglia può essere superata mentre le richieste sono in corso
            return None
        try:
            res = await client.get(LOOKUP_URL.format(id=neo_id), params={"api_key": API_KEY})
        except httpx.HTTPError as exc:
            log.warning("Scheda %s non scaricata: %s", neo_id, exc)
            return None
    note_rate_limit(res)
    if res.status_code == 429:
        return None
    if res.status_code != 200:
        log.warning("Scheda %s: NASA %s", neo_id, res.status_code)
        return None
    reduced = _reduce(res.json())
    await cache_set_json(key, reduced, NEO_TTL)
    return reduced


async def get_body_window(body: str, start: date, end: date, limit: int):
    if body in UNTRACKED:
        return {"body": body, "tracked": False, "asteroids": [], "checked": 0, "candidates": 0, "limited": False}
    if body not in BODY_CODES:
        raise HTTPException(status_code=404, detail="Unknown planet")

    cache_key = f"nasa:body:{body}:{start.isoformat()}:{end.isoformat()}:{limit}"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return {**cached, "from_cache": True}

    feed = await get_feed(start, end)
    raw = [o for day in feed["near_earth_objects"].values() for o in day]
    unique = {o["id"]: o for o in raw}.values()
    # prima i pericolosi, poi i più grandi: se il limite taglia, taglia i meno interessanti
    ordered = sorted(
        unique,
        key=lambda o: (
            not o.get("is_potentially_hazardous_asteroid"),
            -(_f(o.get("estimated_diameter", {}).get("meters", {}).get("estimated_diameter_max")) or 0),
        ),
    )
    picked = ordered[:limit]

    cache_only = quota_low()
    sem = asyncio.Semaphore(LOOKUP_CONCURRENCY)
    async with httpx.AsyncClient(timeout=30.0) as client:
        sheets = await asyncio.gather(*(_lookup(client, sem, o["id"], cache_only) for o in picked))
    missing = sum(1 for sh in sheets if sh is None)

    code = BODY_CODES[body]
    lo = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc).timestamp() * 1000
    hi = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc).timestamp() * 1000
    asteroids = []
    for sheet in filter(None, sheets):
        for a in sheet["approaches"]:
            if a["body"] != code or a["epoch_ms"] is None or a["km"] is None or not lo <= a["epoch_ms"] < hi:
                continue
            asteroids.append(
                {
                    "id": sheet["id"],
                    "approach_id": f"{sheet['id']}-{body}-{a['epoch_ms']}",
                    "name": sheet["name"],
                    "body": body,
                    "approach_utc": datetime.fromtimestamp(a["epoch_ms"] / 1000, tz=timezone.utc).isoformat(),
                    "distance_km": a["km"],
                    "distance_ld": a["km"] / LD_KM,
                    "diameter_min_m": sheet["diameter_min_m"],
                    "diameter_max_m": sheet["diameter_max_m"],
                    "speed_kms": a["kms"],
                    "hazardous": sheet["hazardous"],
                    "jpl_url": sheet["jpl_url"],
                }
            )
    asteroids.sort(key=lambda x: x["approach_utc"])

    result = {
        "body": body,
        "tracked": True,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "checked": len(picked),
        "candidates": len(ordered),
        "limited": len(ordered) > len(picked),
        "quota_low": missing > 0 and quota_low(),
        "asteroids": asteroids,
    }
    # un risultato incompleto per la quota resta in cache poco, così si completa appena possibile
    await cache_set_json(cache_key, result, 600 if result["quota_low"] else BODY_TTL)
    return {**result, "from_cache": False}
