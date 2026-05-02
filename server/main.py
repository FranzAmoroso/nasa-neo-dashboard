from fastapi import FastAPI, Query, HTTPException
from db import get_cache
from control import convert_date
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")

async def healt_check_path():
    return {'server':'online'}

@app.get("/asteroids/feed")

async def get_asteroids(
    start_date: str = Query(..., pattern=r"^\d{2}-\d{2}-\d{4}$"),
    end_date: str = Query(None, pattern=r"^\d{2}-\d{2}-\d{4}$")
):
    s_date, e_date = convert_date(start_date, end_date)

    data = await get_cache(s_date, e_date)

    if not data:
        raise HTTPException(status_code=500, detail= "Errore recupero cache")
    return data
