# TransitOps – UML Diagrams

These diagrams were drawn from the actual code in `TransitOps-NET` (controllers, entities, DbContext, services), not from assumptions.
They use Mermaid, so they render on GitHub, in VS Code (with a Mermaid preview extension), and in `uml-viewer.html`.

| # | File | Diagrams |
|---|---|---|
| 1 | [01-use-case.md](01-use-case.md) | Use cases for the 5 roles, purchase/admin use cases, permission matrix |
| 2 | [02-architecture.md](02-architecture.md) | Component diagram (layers), deployment diagram, local dev setup |
| 3 | [03-class-diagram.md](03-class-diagram.md) | Domain class diagram, service-layer interfaces |
| 4 | [04-er-diagram.md](04-er-diagram.md) | PostgreSQL entity-relationship diagram |
| 5 | [05-state-diagrams.md](05-state-diagrams.md) | Trip, Vehicle, Driver, Maintenance, SaaS purchase state machines |
| 6 | [06-sequence-diagrams.md](06-sequence-diagrams.md) | Login, trip create/dispatch, trip completion, maintenance, purchase→receipt, reports, Hangfire job |
| 7 | [07-activity-diagrams.md](07-activity-diagrams.md) | Trip workflow, onboarding, Safety Officer workflow |

## Viewing

Open `uml-viewer.html` in a browser (needs internet for the Mermaid library).
After editing any `.md` file, rebuild the viewer:

```
node build-viewer.mjs
```

## Recent additions reflected here

- Subscription receipt: QuestPDF receipt attached to the payment email (sequence 6.5). Sample: `../samples/subscription-receipt.pdf`.
- Safety score: calculated by `SafetyScoreCalculator`, recalculated on trip completion, incidents, driver edits and daily (sequence 6.3, class 3.1).
- Indian registration and licence validation: `IndianRegulatoryFormats` (class 3.1).
