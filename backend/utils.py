from pymongo import MongoClient
from pymongo.synchronous.collection import Collection
from pymongo.synchronous.database import Database
import os


def get_mongo_db(username: str = None, password: str = None) -> Database:
    user = username or os.environ["MONGO_USER"]
    password = password or os.environ["MONGO_PW"]
    return MongoClient(f"mongodb+srv://{user}:{password}@christy-dev.yembxgr.mongodb.net/").get_database("adahack2026")


def get_collection(name: str, username: str = None, password: str = None) -> Collection:
    db = get_mongo_db(username, password)
    return db.get_collection(name)
