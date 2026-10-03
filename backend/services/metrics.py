from backend.services.load_postcodes import get_postcode_data


def postcode_to_coordinates(postcode: str) -> tuple[float, float]:
    postcode_data = get_postcode_data([postcode])[0][1]
    return (postcode_data["latitude"], postcode_data["longitude"])
def get_carbon_intensity(postcode: str) -> float:
    return 0.0

def get_air_quality(postcode: str) -> float:
    return 0.0

# use this to test your code!
if __name__ == "__main__":
    print(postcode_to_coordinates("EH9 1AB"))