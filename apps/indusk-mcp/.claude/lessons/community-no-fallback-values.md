# Never use fallback values where a value is expected

When a value should exist, don't provide a default. Let it fail visibly.

`process.env.DATABASE_URL ?? "localhost"` hides the fact that the env var is missing. The app runs, connects to the wrong database, and you debug for an hour.

If a value is required, assert its existence. If it's truly optional, make that explicit in the type.
