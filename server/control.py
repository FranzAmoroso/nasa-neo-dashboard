from datetime import date, datetime, timedelta

NASA_MAX_DAYS = 7      # limite NeoWs per singola chiamata
MAX_RANGE_DAYS = 31    # limite che ci diamo noi per non esaurire la quota NASA


def parse_it_date(value: str) -> date:
    """Converte 'gg-mm-aaaa' (formato inviato dal frontend) in date."""
    return datetime.strptime(value, "%d-%m-%Y").date()


def split_range(start: date, end: date, size: int = NASA_MAX_DAYS):
    """Spezza [start, end] in blocchi contigui di al massimo `size` giorni.

    Esempio con size=7: 01→15 diventa 01→07, 08→14, 15→15.
    I blocchi sono allineati a partire da `start`, quindi due richieste
    con lo stesso inizio riusano gli stessi blocchi in cache.
    """
    chunks = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=size - 1), end)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks
