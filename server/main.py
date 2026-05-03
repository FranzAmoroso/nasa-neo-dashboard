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

@app.get("/home")

async def healt_check_path():
    return {'server':'online'}

@app.get("/asteroids/feed/")


async def get_asteroids():
    data = await get_cache()
    

    if not data:
        raise HTTPException(status_code=500, detail= "Errore recupero cache")
    return data
