# Failed-delivery follow-up (NDR): audit and repeatable test

Audited 2026-11-12 against the supplied assignment's section 3.

## Verdict

The required mock-courier NDR workflow passed three browser journeys. Background outreach, courier acknowledgement and timed handover were observed without directly running jobs or changing queue records. These are demo web-chat notifications and mock courier acknowledgements, not SMS/WhatsApp delivery or a real courier integration.

| Assignment requirement | Evidence |
| --- | --- |
| Shipment timeline and all six event controls | Courier dashboard exposes Picked up, In transit, Out for delivery, Delivery failed, Delivered and RTO initiated. |
| Automatic customer contact including failure reason | New failure events generated outreach in the matching customer conversation; observed after natural waits of up to 10 seconds. |
| Collect retry date within three days, corrected address/landmark or alternate phone | Live browser retry collected tomorrow and a landmark. Backend tests cover corrected address, valid/invalid phone, invalid pincode and dates beyond three days. |
| Send instructions to mock courier and note them on order | Customer YES consumed a saved proposal; worker acknowledged a durable instruction, added a timeline event and an order note. |
| Refusal with reason and RTO | Browser refusal preserved travel reason, produced RTO requested, then accepted the RTO initiated courier event. |
| Two failed attempts without customer response go to a person | With the actual 120-second setting unchanged, handover was observed after 128.5 seconds; matching ticket opened the right Inbox thread. |
| Human takes over, AI pauses | Customer's subsequent message received no automated answer; an Inbox team reply appeared in customer chat. |

## Corrections made

1. The escalation check previously checked for unfinished instructions rather than absence of a customer reply. It now checks customer messages since that failure; a clarification does not count as silence. Other normal unresolved-issue safeguards still apply.
2. Acknowledged order notes now include supplied retry date, corrected address, landmark and masked alternate-phone suffix rather than a generic acknowledgement. Full validated instructions remain in the mock courier command.
3. Whitespace-only refusal reasons are rejected.

## Retained browser examples

Only newly created runtime orders were exercised; original supplied orders and seed files were not rewritten.

- `DEMO-F8429D93`: retry consent → `MOCK-ACK-5e123a5c3b0f76ad` → Delivered.
- `DEMO-3869ED5B`: refusal with travelling reason → `MOCK-ACK-35cb26e58d1dc168` → RTO initiated.
- `DEMO-9509C2E2`: two failures without customer replies → Needs human → Inbox team reply.

The refusal conversation needed one explicit “Refuse delivery” clarification after the model first offered shipped-order options. Final consent and RTO processing succeeded. This is not evidence that every possible wording will produce an identical first reply.

Browser fixture creation used the authorized team setup endpoint to isolate these tests. The normal customer journey remains storefront → bag → checkout.

## How to reproduce entirely in the app

### Preparation

1. Use separate browser profiles/windows: one Customer session and one Team session. Regular tabs share login cookies; use an incognito window or separate browser for the second role.
2. In the customer store, choose an in-stock product and size, add it to the bag and check out using a valid serviceable address and phone.
3. Note the new order ID. For COD, confirm the order through its customer confirmation choice. For prepaid, complete the explicit mock successful payment. Unconfirmed COD and unpaid prepaid must not dispatch.
4. Team: open Settings and read **Unanswered NDR escalation delay**. It was 120 seconds in this test. Initial outreach is immediate; that delay is for unanswered escalation, not the first message.
5. Team: open Courier, search the new order ID and select it. Leave Event ID blank normally. Distinct failed attempts must have distinct event IDs; replaying one ID must not create an extra attempt.

### A. Automatic outreach and successful retry

1. Team Courier: select Picked up and send it; repeat for In transit and Out for delivery.
2. Select Delivery failed, enter “Customer not available”, then send the event.
3. Without typing a message or running any queue control, wait a few seconds. Customer: open **Order help**, use **All conversations** if necessary, and select the thread mentioning the new order. Inbox should show the same automatic failure reason.
4. Customer: send “My order is [ORDER_ID], my registered phone is [PHONE]. Please retry tomorrow at the security desk.”
5. Follow verification if requested. Check the proposed date is within three days, then reply **YES** only after the saved proposal is shown.
6. Wait for **Mock courier acknowledged** and a `MOCK-ACK-…` reference.
7. Team Orders: open that order. Check Courier instructions is **Acknowledged**, the shipment timeline contains **Reattempt requested**, and Notes records the acknowledged instructions.
8. Team Courier: send Delivered. Verify the timeline and order now show Delivered.

Optional variants on a fresh failed order: supply a corrected serviceable address, landmark or valid alternate phone. Invalid dates, phones and unsupported pincodes must not become an acknowledged change.

### B. Customer refusal and RTO

1. Create a separate new dispatchable order and send Picked up → Out for delivery → Delivery failed.
2. Customer: open its outreach thread and send “My order is [ORDER_ID], phone [PHONE]. I refuse delivery because I am travelling. Please return it to origin.”
3. If offered options, explicitly choose **Refuse delivery**. Provide a reason if asked.
4. Read the proposed refusal and reply YES. Wait for the mock acknowledgement.
5. Check **RTO requested** and the refusal reason in the order timeline/Notes. This is a request, not a claim that physical return is complete.
6. Team Courier: send RTO initiated and verify it appears separately in the timeline.

### C. Two failures without a response

1. Use a third new dispatchable order. Do not send any customer message after its failed-delivery events.
2. Team Courier: send Picked up → Out for delivery → Delivery failed with the first reason.
3. Check automatic outreach; one failure alone must not trigger the two-attempt handover.
4. Send Out for delivery again, then a second Delivery failed with another reason. Leave Event ID blank or use a different ID.
5. Do not reply in customer chat. Wait the configured NDR delay after the second failure, plus a few seconds for the worker/UI to update.
6. Inbox should show **Needs human** and “Two failed delivery attempts without a response.”
7. Support tickets should show the customer and reason. **Open conversation** must open that exact Inbox thread.
8. Customer: send a message now. AI should remain paused. Team: reply through Inbox; the customer should see a Team member message.

## Scope of confidence

These checks establish the specified application paths under the tested conditions, not a guarantee against every future outage or model response. Automatic jobs require the API worker to be running. No real courier or external messaging delivery was tested or claimed.
