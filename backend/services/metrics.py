import requests

from backend.services.load_postcodes import get_postcode_data

CARBON_INTENSITY_URL = "https://api.carbonintensity.org.uk/regional/postcode/{outcode}"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
TIMEOUT = 15

# UK Daily Air Quality Index (DAQI) band thresholds in µg/m³: the lower bound of
# bands 2-10 for each pollutant. https://uk-air.defra.gov.uk/air-pollution/daqi
DAQI_THRESHOLDS = {
    "ozone": [34, 67, 101, 121, 141, 161, 188, 214, 241],  # 8-hour mean
    "nitrogen_dioxide": [68, 135, 201, 268, 335, 401, 468, 535, 601],  # hourly
    "sulphur_dioxide": [89, 178, 267, 355, 444, 533, 711, 888, 1065],  # 15-min (hourly used)
    "pm2_5": [12, 24, 36, 42, 48, 54, 59, 65, 71],  # 24-hour mean
    "pm10": [17, 34, 51, 59, 67, 76, 84, 92, 101],  # 24-hour mean
}
# How many trailing hours each pollutant is averaged over
DAQI_AVERAGING_HOURS = {
    "ozone": 8,
    "nitrogen_dioxide": 1,
    "sulphur_dioxide": 1,
    "pm2_5": 24,
    "pm10": 24,
}


def postcode_to_coordinates(postcode: str) -> tuple[float, float]:
    postcode_data = get_postcode_data([postcode])[0][1]
    return (postcode_data["latitude"], postcode_data["longitude"])


def postcode_to_outcode(postcode: str) -> str:
    # The inward code is always the last 3 characters, e.g. "EH91AB" -> "EH9"
    return postcode.replace(" ", "").upper()[:-3]

def get_carbon_intensity(postcode: str) -> tuple[float, str] | None:
    """Returns (carbon intensity in gCO2/kWh, rating) for the postcode's area,
    e.g. (130.0, "moderate"). Returns None if something goes wrong."""
    try:
        resp = requests.get(
            CARBON_INTENSITY_URL.format(outcode=postcode_to_outcode(postcode)),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()

        # Same digging as before to reach the "intensity" part
        intensity = resp.json()["data"][0]["data"][0]["intensity"]

        # NEW: return the number AND the rating together
        #   intensity["forecast"] -> the number, e.g. 130
        #   intensity["index"]    -> the rating, e.g. "moderate"
        return float(intensity["forecast"]), intensity["index"]

    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        return None
def daqi_band(pollutant: str, value: float) -> int:
    return 1 + sum(value >= t for t in DAQI_THRESHOLDS[pollutant])


def get_air_quality(postcode: str) -> int | None:
    """Current UK DAQI (1 low - 10 very high) for the postcode, computed from
    Open-Meteo air quality data. The index is the worst band across all pollutants.
    None if unavailable."""
    try:
        latitude, longitude = postcode_to_coordinates(postcode)
        resp = requests.get(
            AIR_QUALITY_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "hourly": ",".join(DAQI_THRESHOLDS),
                "past_hours": 24,
                "forecast_hours": 1,  # last entry is the current hour
                "timezone": "GMT",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        hourly = resp.json()["hourly"]
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        return None

    bands = []
    for pollutant, hours in DAQI_AVERAGING_HOURS.items():
        values = [v for v in hourly.get(pollutant, [])[-hours:] if v is not None]
        if values:
            bands.append(daqi_band(pollutant, sum(values) / len(values)))
    return max(bands) if bands else None


# use this to test your code!
if __name__ == "__main__":
    print(postcode_to_coordinates("EH9 1AB"))
    print(get_carbon_intensity("EH9 1AB"))
    print(get_air_quality("EH9 1AB"))
    print(get_carbon_intensity("SW1A 1AA"))

    print(get_carbon_intensity("EH9 1AB"))   # (0.0, 'very low')
print(get_carbon_intensity("SW1A 1AA"))  # (130.0, 'moderate')

# Or split the two values into separate variables:
value, rating = get_carbon_intensity("SW1A 1AA")
print(f"{value} g/kWh ({rating})")       # 130.0 g/kWh (moderate)