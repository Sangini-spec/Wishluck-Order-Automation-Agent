---
name: Customer-led order creation
description: User's expected boundary between the customer store and team COD operations.
---

The user expects the normal journey to be customer portal → cart → checkout → new order → automatic Operations Center tracking and COD risk/confirmation. TEAM should monitor and handle exceptions rather than create or answer customer orders as the normal journey.

**Why:** The user said that with a product/order customer portal, adding to cart and ordering through checkout should create the test orders; Operations should then track those orders and their COD risk. The assignment permits a dashboard test-order button, but that is an evaluator shortcut, not the desired customer journey.

**How to apply:** Treat staff-created test orders as optional simulation tools. Customer order creation must derive identity from the signed-in session, persist the order and trigger the existing shared backend rules automatically. Make all customer COD choices and the simulated prepaid completion accessible from the customer side, with live team visibility.
