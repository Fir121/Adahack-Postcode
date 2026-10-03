#!/usr/bin/env python3
"""Generate synthetic users and completed activities using only local CSV files."""

import argparse
import calendar
import csv
from datetime import date, timedelta
from pathlib import Path
import random


SCRIPT_DIR = Path(__file__).resolve().parent
USER_FIELDS = ["user_id", "email", "name", "postcode"]
ACTIVITY_FIELDS = ["user_id", "postcode", "task_id", "date", "points"]
FIRST_NAMES = (
    "Ada", "Amir", "Ava", "Ben", "Chloe", "Daniel", "Ella", "Grace",
    "Hannah", "Isaac", "Isla", "Jack", "Leo", "Maya", "Noah", "Olivia",
    "Priya", "Sam", "Sofia", "Zara",
)
LAST_NAMES = (
    "Ahmed", "Brown", "Campbell", "Chen", "Davies", "Evans", "Fraser",
    "Green", "Harris", "Khan", "MacDonald", "Martin", "Patel", "Reid",
    "Scott", "Singh", "Smith", "Taylor", "Walker", "Wilson",
)


def read_rows(path, required_fields):
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        missing = set(required_fields) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path}: missing columns {', '.join(sorted(missing))}")
        rows = list(reader)
        if any(not row.get(field, "") for row in rows for field in required_fields):
            raise ValueError(f"{path}: required fields must not be empty")
        return rows


def month_before(day):
    """Subtract one calendar month, clamping to the previous month's last day."""
    year, month = (day.year, day.month - 1) if day.month > 1 else (day.year - 1, 12)
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def generate(args):
    if args.users < 0:
        raise ValueError("--users must be non-negative")
    if not 0 <= args.max_tasks <= 8:
        raise ValueError("--max-tasks must be between 0 and 8")

    tasks = read_rows(args.tasks_csv, ["task_id", "points"])
    task_ids = [task["task_id"] for task in tasks]
    if len(task_ids) != 8 or set(task_ids) != {str(i) for i in range(1, 9)}:
        raise ValueError("The tasks CSV must contain exactly one task for each ID 1–8")
    for task in tasks:
        task["points"] = int(task["points"])
        if task["points"] < 0:
            raise ValueError("Task points must be non-negative integers")

    postcodes = sorted({row["postcode"] for row in read_rows(args.postcodes_csv, ["postcode"])})
    if not postcodes:
        raise ValueError("The postcodes CSV must contain at least one postcode")
    existing_users = read_rows(args.users_csv, ["user_id", "email"])
    used_ids = {row["user_id"] for row in existing_users}
    used_emails = {row["email"] for row in existing_users}

    start = month_before(args.as_of)
    days = (args.as_of - start).days
    users_path = args.output_dir / "generated_users.csv"
    activities_path = args.output_dir / "generated_activities.csv"
    source_paths = {path.resolve() for path in (args.tasks_csv, args.postcodes_csv, args.users_csv)}
    for path in (users_path, activities_path):
        if path.resolve() in source_paths:
            raise ValueError(f"Output would overwrite a reference CSV: {path}")
        if path.exists() and not args.overwrite:
            raise ValueError(f"{path} already exists; use --overwrite to replace generated files")

    rng = random.Random(args.seed)
    activity_count = 0
    args.output_dir.mkdir(parents=True, exist_ok=True)
    mode = "w" if args.overwrite else "x"
    with users_path.open(mode, newline="", encoding="utf-8") as users_file, \
            activities_path.open(mode, newline="", encoding="utf-8") as activities_file:
        users_writer = csv.DictWriter(users_file, fieldnames=USER_FIELDS)
        activities_writer = csv.DictWriter(activities_file, fieldnames=ACTIVITY_FIELDS)
        users_writer.writeheader()
        activities_writer.writeheader()

        for _ in range(args.users):
            first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
            while True:
                email = f"{first.lower()}.{last.lower()}.{rng.getrandbits(128):032x}@example.com"
                if email not in used_ids and email not in used_emails:
                    break
            used_ids.add(email)
            used_emails.add(email)
            postcode = rng.choice(postcodes)
            users_writer.writerow({
                "user_id": email, "email": email,
                "name": f"{first} {last}", "postcode": postcode,
            })

            # ActivityModel's key is (task_id, user_id), so never repeat a task.
            for task in rng.sample(tasks, rng.randint(0, args.max_tasks)):
                completed_on = start + timedelta(days=rng.randint(0, days))
                activities_writer.writerow({
                    "user_id": email, "postcode": postcode,
                    "task_id": task["task_id"], "date": completed_on.isoformat(),
                    "points": task["points"],
                })
                activity_count += 1

    return users_path, activities_path, activity_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--users", type=int, required=True, metavar="N", help="Number of new users")
    parser.add_argument("--max-tasks", type=int, default=8, metavar="N1",
                        help="Each user completes a random 0–N1 distinct tasks (0–8; default: 8)")
    parser.add_argument("--seed", type=int, help="Optional seed for reproducible CSVs")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today(), metavar="YYYY-MM-DD",
                        help="End of the one-calendar-month completion window (default: today)")
    parser.add_argument("--output-dir", type=Path, default=SCRIPT_DIR / "generated")
    parser.add_argument("--tasks-csv", type=Path, default=SCRIPT_DIR / "adahack2026.tasks.csv")
    parser.add_argument("--postcodes-csv", type=Path, default=SCRIPT_DIR / "coordinates.csv")
    parser.add_argument("--users-csv", type=Path, default=SCRIPT_DIR / "users.csv",
                        help="Existing users export, used to avoid ID/email collisions")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing generated CSVs")
    args = parser.parse_args()
    try:
        users_path, activities_path, count = generate(args)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(f"Wrote {args.users} users to {users_path}")
    print(f"Wrote {count} activities to {activities_path}")
    print(f"Completion dates: {month_before(args.as_of)} through {args.as_of} (inclusive)")
    print("Import users first, then activities. Use string task_id/date fields and integer points.")


if __name__ == "__main__":
    main()
