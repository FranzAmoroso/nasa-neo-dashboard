from datetime import datetime

def convert_date(start_date: str, end_date: str):
    start_date = datetime.strptime(start_date, "%d-%m-%Y").strftime("%Y-%m-%d")
    end_date = datetime.strptime(end_date, "%d-%m-%Y").strftime("%Y-%m-%d") 
    return start_date, end_date
