# Direct UPI payments: current release

WomSakhi provides the provider’s UPI ID and a payment confirmation workflow. It does not run a payment gateway, hold the transferred money, or offer bank payouts. My Money remains a personal notebook; My Payments records the direct payment workflow.

## Member flow

1. A paid course enrolment or accepted paid mentoring request displays the recipient’s UPI ID and the agreed amount.
2. The payer completes payment in their own UPI app. Opening or copying a UPI link does not change payment status.
3. The payer submits the transaction reference from their app. Blank/whitespace references are rejected. The current evidence field is the transaction reference; screenshot uploads are not implemented by this change.
4. The record becomes **Awaiting confirmation**. Course lessons or paid meeting details remain gated by the existing course/session rules.
5. The teacher or mentor checks their own UPI account, then selects **Payment received**. Recipient ownership is enforced server-side. The record stores the confirmation date and confirming user ID. A payer cannot confirm their own submission as recipient.
6. A teacher who cannot locate a payment uses the existing Not received flow. The record remains distinct from confirmed payments and carries the recipient’s note.

A transaction reference is a claim to review, not automatic proof that money reached the recipient. The application does not independently query the bank or verify the reference through a gateway. Confirmation records describe the recipient’s acknowledgement.

## My Payments

`/app/payments` reads the existing enrolment and mentorship payment records through `GET /api/v1/payments/activity`. It shows sent/received direction, amount, status, transaction reference, submitted/confirmed dates and a link to the existing payment/review screen. Receiver course links open the Learners tab. There is no second payment collection and no new wallet transaction generated from a UPI claim or acknowledgement.

The activity endpoint is scoped to the payer or the owner of the relevant course/session. It includes up to 500 enrolment records, 500 mentoring records and 200 older gateway order records. It excludes free records. Earlier gateway records are labelled separately; the UI does not invent a recipient acknowledgement for them. Loading/error states do not masquerade as an empty or zero balance. Amounts retain paise and can be hidden.

This release’s consolidated activity covers the existing course and mentoring UPI workflows. It does not invent payment confirmation states for other modules that do not store those records.

## Compatibility and release switches

- `/app/wallet` and `/app/wallet/statement` redirect to My Payments. Existing backend credit records remain stored, but they are not the current release’s payment model.
- `/app/checkout/[orderId]` redirects to My Payments. Historical order records remain readable by their owner.
- `DIRECT_UPI_ONLY=true` is the release default. Gateway order creation, gateway confirmation and webhook processing return HTTP 501 before provider/database work or idempotency replay. Payment methods describe direct UPI. Retained gateway adapters are future code, not an enabled release feature.
- Bank payouts remain deferred. The payout endpoint rejects before any ledger deduction.
- Settings offer a UPI input rather than a new bank-account form. Existing saved bank metadata remains available for upkeep. Course and mentor settings still supply the actual UPI destination shown to their payers.
- Existing course/session confirmations continue to add provider income to Business books. They do not automatically create an entry in the separate personal notebook.

## Validation

Backend tests cover blank references, pending-versus-confirmed states, recipient ownership, private record filtering, exact amounts, confirmation audit metadata, no wallet/notebook writes, retry protection on recipient confirmation, blocked gateway routes, and the deferred payout boundary. Existing course and mentoring lifecycle tests exercise their original fulfilment behavior.

`checks/direct-upi-payments.mjs` uses fresh synthetic fixtures on an isolated API and production frontend. It submits test references through the course and mentor forms, signs in as the recipient to confirm them, and checks redirects, hidden amounts, phone light/dark layouts, blocked gateway confirmation and explicit failed-read messages. It does not initiate a real UPI payment or establish that a bank received money.
