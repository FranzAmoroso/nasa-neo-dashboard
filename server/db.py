import redis
import json
import httpx
import os
from fastapi import HTTPException
from dotenv import load_dotenv

API_URL = os.getenv("API_URL")
API_KEY = os.getenv("API_KEY")
REDIS_URL = os.getenv("REDIS_URL")


r = redis.Redis.from_url(REDIS_URL)
async def get_cache(start_date: str, end_date: str):
    cache_key = f"nasa:{start_date}:{end_date}"

    try:
        json_data = await r.get(cache_key)
        if json_data:
            return json_data
        #print(f"DEBUG: Chiamo NASA con URL: {API_URL}")
        async with httpx.AsyncClient() as client:
            params = {
            "start_date": start_date,
            "end_date": end_date,
            "api_key":API_KEY
            }  
            #print(f"DEBUG: Parametri: {params}")
        
            response = await client.get(API_URL, params= params, timeout = 50.0)

            if response.status_code != 200:
                #print(f"NASA REJECTED: {response.status_code} - {response.text}")
                raise HTTPException(status_code= response.status_code, detail= "Error API" )
        
            data = response.json()
        
        await r.set(cache_key, data, ex=604800)
        return data
    except Exception as e:
        print(f"ERRORE SERVER: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=str(e))