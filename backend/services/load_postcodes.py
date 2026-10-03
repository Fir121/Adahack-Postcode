
import argparse
import sys

import requests
from pymongo import UpdateOne

from backend.utils import get_mongo_db

API_URL = "https://api.postcodes.io/postcodes"
BATCH_SIZE = 100  # postcodes.io bulk lookup limit
TIMEOUT = 15


def get_postcodes(path):
    seen = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            seen[line.upper()] = None
    return list(seen)


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def get_postcode_data(postcodes: list[str]) -> list[tuple]:
    resp = requests.post(API_URL, json={"postcodes": postcodes}, timeout=TIMEOUT)
    resp.raise_for_status()
    return [(item["query"], item["result"]) for item in resp.json()["result"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="?", default="postcodes.txt")
    args = parser.parse_args()

    postcodes = get_postcodes(args.file)
    if not postcodes:
        sys.exit(f"No postcodes found in {args.file}")

    client = get_mongo_db()
    coll = client.get_collection("coordinates")
    coll.create_index("postcode", unique=True)

    saved, skipped = 0, []
    for batch in chunks(postcodes, BATCH_SIZE):
        ops = []
        for query, result in get_postcode_data(batch):
            if not result or result.get("latitude") is None or result.get("longitude") is None:
                skipped.append(query)
                continue
            ops.append(
                UpdateOne(
                    {"postcode": result["postcode"]},  # canonical form, e.g. "EH9 1AB"
                    {
                        "$set": {
                            "postcode": result["postcode"],
                            "latitude": result["latitude"],
                            "longitude": result["longitude"],
                        }
                    },
                    upsert=True,
                )
            )
        if ops:
            coll.bulk_write(ops, ordered=False)
            saved += len(ops)
        print(f"Processed {saved + len(skipped)}/{len(postcodes)}", end="\r")

    print(f"\nSaved {saved} postcodes, skipped {len(skipped)}.")
    if skipped:
        print("Skipped (not found or no coordinates):", ", ".join(skipped))


if __name__ == "__main__":
    main()