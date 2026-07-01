# official.nginx tests

The Prompt5 baseline validates this package through npm run test:capabilities.
The package also references the existing golden scenario and golden failure
fixtures for Nginx assessment and config validation failure.

Future source-level tests should cover collector, classifier, planner, verifier,
and rollback descriptor modules if this package grows dynamic code.

