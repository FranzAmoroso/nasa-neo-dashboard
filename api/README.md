### 1. Configurazione Variabili d'Ambiente
Crea un file `.env` nella cartella principale e aggiungi le tue credenziali NASA:
```env
API_KEY=tua_chiave_nasa_qui
API_URL=https://nasa.gov
```
*(Puoi ottenere una chiave gratuita su [api.nasa.gov](https://nasa.gov))*
### 2. Avviare Redis
senza Redis il backend darà un errore 500.
~~~bash
sudo service redis-server start
~~~

### 3. Installazione
Dopo aver attivato l'ambiente, installa le dipendenze:
```bash
pip install -r requirements.txt
```

### 5. Avviare il server con
    
1.  uvicorn
    ~~~bash
    uvicorn main:app --reload
    ~~~
2. fastapi
    ~~~bash
    python -m fastapi dev
    ~~~

### 2. stoppare Redis
senza Redis il backend darà un errore 500.
~~~bash
sudo service redis-server stop
~~~
