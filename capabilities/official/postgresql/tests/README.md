# official.postgresql tests

The Prompt5 baseline validates this package through npm run test:capabilities.
The package also references the existing golden database safe migration scenario
and PostgreSQL backup freshness failure fixture.

Future source-level tests should cover collector, classifier, planner, verifier,
and rollback descriptor modules if this package grows dynamic code.

