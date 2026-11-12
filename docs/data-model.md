# Active dataset → Prisma models

Schema source: `backend/prisma/schema.prisma`. The only seed input is `data/wishluck_seed_data.json`; PostgreSQL stores subsequent runtime activity separately.

| JSON collection | Prisma model | Records |
| --- | --- | ---: |
| customers | Customer | 30 |
| customers[].return_history_last_60_days | CustomerReturnHistory | 6 |
| products | Product | 6 |
| inventory | Inventory | 23 |
| orders | Order | 30 |
| orders[].items | OrderItem | 31 |
| orders[].payment | OrderPayment | 30 |
| shipments | Shipment | 21 |
| shipments[].events | ShipmentEvent | 74 |
| returns | ReturnRecord | 12 |
| refunds | Refund | 4 |
| cod_confirmations | CODConfirmation | 7 |
| pincode_serviceability | PincodeServiceability | 11 |
| policy | PolicyVersion | 1 |
| demo_scenarios | DemoScenario | 13 |
| dataset_metadata and notes | SeedDataset | 1 active seed |

Orders belong to customers; items reference products; payments and COD confirmation belong to orders. Shipments belong to orders and events belong to shipments. Refunds and returns retain their supplied IDs and relationships. Historical returns can reference orders outside the supplied 30-order subset; the model preserves their source order identifiers instead of inventing orders.

Runtime models cover customer accounts/sessions, cart items, idempotent checkout submissions, conversations/messages, support tickets, pending action consent, return/exchange requests, tool executions and model usage, audits, webhook deduplication, risk assessments, NDR cases, courier instructions, mock payment attempts, durable outbox jobs and settings.

Seed validation checks collection IDs, ownership, relationships and financial arithmetic before import. Active data quality checks are expected to return no issues. The seed script refuses conflicting dataset hashes rather than overwriting runtime state.

The old reference dataset is intentionally absent from this submission. Its historical provenance hash may remain inside the active dataset; no original file is opened or required by seeding or tests.
