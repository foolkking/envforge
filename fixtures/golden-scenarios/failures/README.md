# Golden Failure Fixtures

These fixtures exercise the read-only Failure Diagnostic and Support Bundle builders. They never call Plan approval, Apply, Managed Execution, repair execution, or rollback execution.

Run them together with the product golden scenarios:

```bash
npm run test:golden
```

Each fixture records failure evidence, expected taxonomy and recovery boundaries, expected Support Bundle content, redaction sentinels, and current limitations.
