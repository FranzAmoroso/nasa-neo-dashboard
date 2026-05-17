from fastapi import FastAPI, Query, HTTPException
from db import get_cache
from control import convert_date
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "https://nasa-neo-dashboard-franzamorosos-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins="https://nasa-neo-dashboard-franzamorosos-projects.vercel.app", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/home")

async def healt_check_path():
    return {'server':'online'}

@app.get("/asteroids/feed")


async def get_asteroids(
    start_date: str = Query(..., pattern=r"^\d{2}-\d{2}-\d{2}$"),
    end_date: str = Query(None, pattern=r"^\d{2}-\d{2}-\d{2}$")
):
    if end_date is None:
        end_date = start_date
    s_date, e_date = convert_date(start_date, end_date) #se dal front passo data italiana
    data = await get_cache(s_date, s_date)
    

    if not data:
        raise HTTPException(status_code=500, detail= "Errore recupero cache")
    return data
