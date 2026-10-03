import csv
from datetime import date
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from generate_import_csvs import generate, month_before


class GenerateImportCSVsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.tasks = self.root / "tasks.csv"
        self.postcodes = self.root / "coordinates.csv"
        self.users = self.root / "users.csv"
        self.write_csv(self.tasks, ["task_id", "points"], [
            {"task_id": str(i), "points": i * 2} for i in range(1, 9)
        ])
        self.write_csv(self.postcodes, ["postcode"], [
            {"postcode": "EH9 1AB"}, {"postcode": "EH9 1AD"}, {"postcode": "EH9 1AF"},
        ])
        self.write_csv(self.users, ["user_id", "email"], [
            {"user_id": "existing@example.com", "email": "existing@example.com"},
        ])
        self.args = SimpleNamespace(
            users=500, max_tasks=8, seed=42, as_of=date(2026, 10, 3),
            output_dir=self.root / "output", tasks_csv=self.tasks,
            postcodes_csv=self.postcodes, users_csv=self.users, overwrite=False,
        )

    @staticmethod
    def write_csv(path, fields, rows):
        with path.open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    @staticmethod
    def read_csv(path):
        with path.open(newline="", encoding="utf-8") as source:
            return list(csv.DictReader(source))

    def test_relationships_counts_dates_and_task_points(self):
        users_path, activities_path, count = generate(self.args)
        users = self.read_csv(users_path)
        activities = self.read_csv(activities_path)
        by_id = {user["user_id"]: user for user in users}
        self.assertEqual(len(users), 500)
        self.assertEqual(len(by_id), 500)
        self.assertEqual(len({user["email"] for user in users}), 500)
        self.assertEqual(len(activities), count)
        self.assertEqual({user["postcode"] for user in users}, {"EH9 1AB", "EH9 1AD", "EH9 1AF"})
        for user in users:
            self.assertEqual(user["user_id"], user["email"])
            self.assertNotEqual(user["user_id"], "existing@example.com")
            self.assertNotIn("_id", user)
        seen = set()
        counts = dict.fromkeys(by_id, 0)
        for activity in activities:
            user = by_id[activity["user_id"]]
            self.assertEqual(activity["postcode"], user["postcode"])
            self.assertIn(activity["task_id"], {str(i) for i in range(1, 9)})
            self.assertEqual(int(activity["points"]), int(activity["task_id"]) * 2)
            completed = date.fromisoformat(activity["date"])
            self.assertLessEqual(date(2026, 9, 3), completed)
            self.assertLessEqual(completed, self.args.as_of)
            key = (activity["user_id"], activity["task_id"])
            self.assertNotIn(key, seen)
            seen.add(key)
            counts[activity["user_id"]] += 1
        self.assertEqual(set(counts.values()), set(range(9)))

    def test_reproducible_output_and_overwrite_guard(self):
        users, activities, _ = generate(self.args)
        original = (users.read_bytes(), activities.read_bytes())
        with self.assertRaisesRegex(ValueError, "already exists"):
            generate(self.args)
        self.assertEqual(original, (users.read_bytes(), activities.read_bytes()))
        self.args.overwrite = True
        generate(self.args)
        self.assertEqual(original, (users.read_bytes(), activities.read_bytes()))

    def test_existing_ids_are_skipped_even_with_same_seed(self):
        previous_users, _, _ = generate(self.args)
        previous_ids = {row["user_id"] for row in self.read_csv(previous_users)}
        self.args.users_csv = previous_users
        self.args.output_dir = self.root / "second_batch"
        new_users, _, _ = generate(self.args)
        new_ids = {row["user_id"] for row in self.read_csv(new_users)}
        self.assertEqual(len(new_ids), self.args.users)
        self.assertTrue(previous_ids.isdisjoint(new_ids))

    def test_zero_users_and_zero_tasks(self):
        self.args.users = 0
        users, activities, count = generate(self.args)
        self.assertEqual(self.read_csv(users), [])
        self.assertEqual(self.read_csv(activities), [])
        self.assertEqual(count, 0)
        self.args.users = 10
        self.args.max_tasks = 0
        self.args.overwrite = True
        users, activities, count = generate(self.args)
        self.assertEqual(len(self.read_csv(users)), 10)
        self.assertEqual(self.read_csv(activities), [])
        self.assertEqual(count, 0)

    def test_invalid_counts_and_task_references(self):
        for users, tasks in [(-1, 8), (1, -1), (1, 9)]:
            with self.subTest(users=users, tasks=tasks):
                self.args.users, self.args.max_tasks = users, tasks
                with self.assertRaises(ValueError):
                    generate(self.args)
        self.args.users, self.args.max_tasks = 10, 8
        self.write_csv(self.tasks, ["task_id", "points"], [
            {"task_id": "9", "points": "1"},
        ])
        with self.assertRaisesRegex(ValueError, "exactly one task"):
            generate(self.args)
        self.assertFalse(self.args.output_dir.exists())

    def test_calendar_month_boundaries(self):
        self.assertEqual(month_before(date(2026, 10, 3)), date(2026, 9, 3))
        self.assertEqual(month_before(date(2026, 3, 31)), date(2026, 2, 28))
        self.assertEqual(month_before(date(2024, 3, 31)), date(2024, 2, 29))
        self.assertEqual(month_before(date(2026, 1, 31)), date(2025, 12, 31))


if __name__ == "__main__":
    unittest.main()
