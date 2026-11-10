"""Accesso a NASA NeoWs con cache Redis per singolo giorno.

Flusso di get_feed(start, end):
1. elenca i giorni del range e li cerca in Redis (una MGET);
2. raggruppa i giorni mancanti in blocchi contigui di max 7 giorni
   (il limite NASA per chiamata) e li scarica in parallelo;
3. salva ogni giorno scaricato con la sua chiave, così qualsiasi range
   futuro che lo contiene lo riusa;
4. restituisce un payload con la stessa forma di NeoWs
   (element_count + near_earth_objects per data).

Se Redis non è configurato o non risponde, il servizio continua a
funzionare senza cache.
"""

import asyncio
import json
import logging
import os
from datetime import date, timedelta

import httpx
import redis.asyncio as redis
from fastapi import HTTPException

from control import split_range

log = logging.getLogger("neo")

API_URL = os.getenv("API_URL", "https://api.nasa.gov/neo/rest/v1/feed")
API_KEY = os.getenv("API_KEY", "DEMO_KEY")
REDIS_URL = os.getenv("REDIS_PUBLIC_URL") or os.getenv("REDIS_URL")

PAST_TTL = 60 * 60 * 24 * 7   # i giorni passati non cambiano: 7 giorni
FUTURE_TTL = 60 * 60 * 6      # oggi e futuro possono essere aggiornati: 6 ore

r = redis.Redis.from_url(REDIS_URL) if REDIS_URL else None

# Richieste NASA rimaste nell'ora, lette dall'header X-RateLimit-Remaining
# dell'ultima risposta. None finché non abbiamo ancora chiamato la NASA.
RATE = {"remaining": None}


def note_rate_limit(response) -> None:
    value = response.headers.get("X-RateLimit-Remaining")
    if value is not None and value.isdigit():
        RATE["remaining"] = int(value)


def _day_key(day: date) -> str:
    return f"nasa:day:{day.isoformat()}"


def _days(start: date, end: date):
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _contiguous_runs(days):
    """[1,2,3,5,6] -> [(1,3),(5,6)] per date ordinate."""
    runs = []
    for d in days:
        if runs and d == runs[-1][1] + timedelta(days=1):
            runs[-1] = (runs[-1][0], d)
        else:
            runs.append((d, d))
    return runs


async def _cache_get_many(days):
    if r is None:
        return {}
    try:
        values = await r.mget([_day_key(d) for d in days])
    except Exception as exc:  # Redis giù: si va avanti senza cache
        log.warning("Redis non raggiungibile in lettura: %s", exc)
        return {}
    return {d: json.loads(v) for d, v in zip(days, values) if v is not None}


async def _cache_set_many(day_data):
    if r is None or not day_data:
        return
    today = date.today()
    try:
        async with r.pipeline(transaction=False) as pipe:
            for d, objects in day_data.items():
                ttl = PAST_TTL if d < today else FUTURE_TTL
                pipe.set(_day_key(d), json.dumps(objects), ex=ttl)
            await pipe.execute()
    except Exception as exc:
        log.warning("Redis non raggiungibile in scrittura: %s", exc)


async def _fetch_chunk(client: httpx.AsyncClient, start: date, end: date):
    params = {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "api_key": API_KEY,
    }
    try:
        response = await client.get(API_URL, params=params)
    except httpx.HTTPError as exc:
        log.error("NASA non raggiungibile: %s", exc)
        raise HTTPException(status_code=502, detail="NASA NeoWs is unreachable")

    note_rate_limit(response)
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="NASA API quota exceeded, try again later")
    if response.status_code != 200:
        log.error("NASA %s: %s", response.status_code, response.text[:300])
        raise HTTPException(status_code=502, detail=f"NASA error ({response.status_code})")

    neo = response.json().get("near_earth_objects", {})
    # Ogni giorno del blocco viene registrato, anche se vuoto,
    # così un giorno senza asteroidi non viene richiesto di nuovo.
    return {d: neo.get(d.isoformat(), []) for d in _days(start, end)}


async def get_feed(start: date, end: date):
    days = _days(start, end)
    cached = await _cache_get_many(days)
    missing = [d for d in days if d not in cached]

    fetched = {}
    if missing:
        chunks = [
            chunk
            for run_start, run_end in _contiguous_runs(missing)
            for chunk in split_range(run_start, run_end)
        ]
        log.info("Cache miss su %d giorni -> %d chiamate NASA", len(missing), len(chunks))
        async with httpx.AsyncClient(timeout=30.0) as client:
            results = await asyncio.gather(*(_fetch_chunk(client, s, e) for s, e in chunks))
        for part in results:
            fetched.update(part)
        await _cache_set_many(fetched)

    by_day = {**cached, **fetched}
    near_earth_objects = {d.isoformat(): by_day.get(d, []) for d in days}
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "element_count": sum(len(v) for v in near_earth_objects.values()),
        "cached_days": len(cached),
        "fetched_days": len(fetched),
        "near_earth_objects": near_earth_objects,
    }


# ---------- cache JSON generica (schede asteroidi, risultati per pianeta) ----------

async def cache_get_json(key: str):
    if r is None:
        return None
    try:
        value = await r.get(key)
    except Exception as exc:
        log.warning("Redis non raggiungibile in lettura: %s", exc)
        return None
    return json.loads(value) if value else None


async def cache_set_json(key: str, value, ttl: int):
    if r is None:
        return
    try:
        await r.set(key, json.dumps(value), ex=ttl)
    except Exception as exc:
        log.warning("Redis non raggiungibile in scrittura: %s", exc)
