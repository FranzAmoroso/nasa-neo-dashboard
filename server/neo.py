from datetime import datetime, timezone


def _f(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_feed(payload: dict) -> list:
    asteroids = []
    for day_objects in payload.get("near_earth_objects", {}).values():
        for raw in day_objects:
            approach = (raw.get("close_approach_data") or [{}])[0]
            epoch_ms = approach.get("epoch_date_close_approach")
            if epoch_ms is None:
                continue
            meters = raw.get("estimated_diameter", {}).get("meters", {})
            miss = approach.get("miss_distance", {})
            speed = approach.get("relative_velocity", {})
            asteroids.append(
                {
                    "id": raw.get("id"),
                    "approach_id": f"{raw.get('id')}-earth-{epoch_ms}",
                    "name": (raw.get("name") or "").replace("(", "").replace(")", "").strip(),
                    "body": "earth",  # il feed NeoWs riporta solo i passaggi vicino alla Terra
                    "approach_utc": datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).isoformat(),
                    "distance_km": _f(miss.get("kilometers")),
                    "distance_ld": _f(miss.get("lunar")),
                    "diameter_min_m": _f(meters.get("estimated_diameter_min")),
                    "diameter_max_m": _f(meters.get("estimated_diameter_max")),
                    "speed_kms": _f(speed.get("kilometers_per_second")),
                    "hazardous": bool(raw.get("is_potentially_hazardous_asteroid")),
                    "sentry": bool(raw.get("is_sentry_object")),
                    "absolute_magnitude": _f(raw.get("absolute_magnitude_h")),
                    "jpl_url": raw.get("nasa_jpl_url"),
                }
            )
    asteroids.sort(key=lambda a: a["approach_utc"])
    return asteroids
