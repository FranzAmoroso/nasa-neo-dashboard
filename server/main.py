from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

import redis.asyncio as redis
import json
import httpx
import os

app = FastAPI()

API_URL = os.getenv("API_URL")
API_KEY = os.getenv("API_KEY")
REDIS_PUBLIC_URL = os.getenv("REDIS_PUBLIC_URL")

print("DEBUG REDIS URL:", REDIS_PUBLIC_URL)

r = redis.Redis.from_url(
    REDIS_PUBLIC_URL,
    decode_responses=True
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/home")
async def health():
    return {"server": "online"}

def convert_date(start_date: str, end_date: str):
    start = datetime.strptime(start_date, "%d-%m-%Y").strftime("%Y-%m-%d")
    end = datetime.strptime(end_date, "%d-%m-%Y").strftime("%Y-%m-%d")
    return start, end

@app.get("/asteroids/feed")
async def get_asteroids(
    start_date: str = Query(...),
    end_date: str = Query(None)
):

    if end_date is None:
        end_date = start_date

    s_date, e_date = convert_date(start_date, end_date)

    data = await get_cache(s_date, e_date)

    if not data:
        raise HTTPException(status_code=500, detail="Errore recupero cache")

    return data

async def get_cache(start_date: str, end_date: str):

    cache_key = f"nasa:{start_date}:{end_date}"

    try:

        json_data = await r.get(cache_key)

        if json_data:
            print("CACHE HIT:", cache_key)
            return json.loads(json_data)

        print("CACHE MISS → NASA API")

        async with httpx.AsyncClient() as client:

            params = {
                "start_date": start_date,
                "end_date": end_date,
                "api_key": API_KEY
            }

            response = await client.get(
                API_URL,
                params=params,
                timeout=50.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="NASA API Error"
                )

            data = response.json()

        await r.set(
            cache_key,
            json.dumps(data),
            ex=604800
        )

        print("CACHE SALVATA:", cache_key)

        return data

    except Exception as e:
        print("ERRORE:", e)
        raise HTTPException(status_code=500, detail=str(e))