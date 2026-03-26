# Don't mock the database in integration tests

Mocked tests pass. Production breaks. The mock doesn't know about:
- Migration changes
- Constraint violations
- Query performance
- Transaction behavior
- Type coercion differences

Use a real database instance for integration tests. Docker makes this trivial. The extra seconds are worth the confidence.

Unit tests can mock external calls. Integration tests should hit real infrastructure.
