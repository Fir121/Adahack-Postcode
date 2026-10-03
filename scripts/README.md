# Generate import CSVs

Run from the repository root (Python 3, standard library only):

```sh
python3 scripts/generate_import_csvs.py --users 1000 --max-tasks 8
```

`--users N` creates exactly N new user records. `--max-tasks N1` gives each
user a uniformly random number of distinct completed tasks between 0 and N1,
inclusive. N1 must be 0–8; it defaults to 8. Tasks cannot repeat for a user,
because the backend identifies activities by `(task_id, user_id)`.

The script writes `scripts/generated/generated_users.csv` and
`scripts/generated/generated_activities.csv`. It reads local exports only:

- `users.csv` supplies existing IDs/emails to avoid collisions.
- `coordinates.csv` supplies randomly selected postcodes already known to the backend.
- `adahack2026.tasks.csv` supplies the eight task IDs and their points.

Activity columns follow the existing `activtiies.csv` export. Every activity
references a generated user and matches that user's postcode. Completion dates
are random from one calendar month before today through today, inclusive (for
example, September 3 through October 3). Month-end dates are clamped to the
previous month's last day. The user model has no signup timestamp, so none is
added to the user records. Names are synthetic and emails use `example.com`.

For repeatable output with a fixed date, or to choose an output directory:

```sh
python3 scripts/generate_import_csvs.py --users 1000 --max-tasks 5 \
  --seed 42 --as-of 2026-10-03 --output-dir /tmp/adahack-import
```

Use `--overwrite` to replace generated files. Reference file paths can be
changed with `--users-csv`, `--tasks-csv`, and `--postcodes-csv`. Defaults resolve
relative to the script, so it can also run from another working directory.

Import the users CSV into **users first**, then the activities CSV into
**activities**, with the first row treated as column headers. The files omit
`_id` so MongoDB can allocate new IDs. Keep `user_id`, `email`, `name`, `postcode`,
`task_id`, and `date` as **strings**, and import `points` as an **integer**.
In particular, disable automatic numeric typing for `task_id`: the backend
looks up task IDs as strings. Dates must remain ISO `YYYY-MM-DD` strings.
The existing task and coordinate collections should already contain the
reference exports.

The same seed, date, inputs and counts produce the same user IDs and contents;
use a different seed (or omit it) for an additional batch. When reimporting a
batch, use upsert keys `user_id` for users and `user_id,task_id` for activities
to avoid duplicates. No database connection, backend import, or API call is
made by the generator.

Run the generator's consistency tests with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_generate_import_csvs.py' -v
```
