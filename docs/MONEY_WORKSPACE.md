# My Money: personal notebook and bill plans

My Money is the single member entry at `/app/money`. The previous separation between My Khata and a household forecasting screen mixed actual records, plans, wallet balances and customer receivables. The workspace gives each task a clear place without moving or copying saved data.

| Section | User task | Meaning |
| --- | --- | --- |
| Money in & out | Record received or spent money | Monthly totals from notebook entries; difference is received minus spent, not cash in hand or a bank balance |
| Bills & plans | Remember a future expense | A plan does not affect actual spending until explicitly recorded as paid |
| Notes | Keep reminders and personal notes | Existing notes, colours, amounts and reminders are retained |

My chits and Customer dues remain linked specialist tools. Customer promises are not personal income. My Payments and historical wallet data remain separate records. This change does not introduce bank payouts or money transfers.

## Compatibility and privacy

- `/app/khata` redirects to `/app/money`, preserving supported tab and calculator handoffs. The chits tab redirects to `/app/khata/chits`; nested chit URLs remain available.
- Existing `khata_entries`, `khata_notes`, `khata_chits`, `khata_settings` and `money_commitments` keep their collections and ownership keys. No migration or historical expense reconstruction runs.
- The existing PIN protects all workspace sections, including bill APIs and the older money aggregate. Clients must attach the valid `X-Khata-Key` after unlocking. The browser stores this key in session storage.
- Hide amounts applies to summaries, entries, bill cards and payment confirmation amounts. This visual privacy option does not replace PIN protection.
- Full backup coverage includes the five collections above. Chit member and month records remain embedded in their existing chit documents.

## Bill lifecycle and source of truth

1. Add a plan with a name, planned amount, optional due date and priority. It appears under Upcoming. It creates no expense.
2. Choose **Record as paid**, confirm the actual payment date, and save. This records already-paid money; it does not initiate payment.
3. The server creates one `khata_entries` row with `source="bill"`, `commitment_id`, expense direction and the plan amount. The plan appears under Completed because this row exists.
4. Money in & out includes that expense in its payment month. Its link opens the matching completed bill.
5. **Undo payment record** deletes that linked expense and returns the plan to Upcoming. Other entries remain untouched. Undo does not refund or reverse a transfer.

The expense ID is derived from the owner and normalized bill ID. An atomic upsert with `$setOnInsert` prevents concurrent payment retries from creating additional expenses. Paid state is derived from the expense instead of independently writing a second paid flag. Repeated undo is harmless. Editing/deleting a linked bill or its expense directly is blocked: undo the payment record first, change the plan, and record again if appropriate.

Previously saved `paid=true` plans remain completed and show that no expense was automatically added. Explicitly reopening a legacy plan is required before creating its linked expense. Rental and chit entries retain their existing source links and update rules.

## API ownership

| API | Responsibility |
| --- | --- |
| `GET /api/v1/me/money/commitments` | Upcoming and completed plans with derived payment metadata |
| `POST /api/v1/me/money/commitments` | Create a plan |
| `PATCH/DELETE /api/v1/me/money/commitments/{id}` | Change or remove an unlinked plan |
| `POST /api/v1/me/money/commitments/{id}/payment` | Record one expense; optional `on` date, defaults to today in India |
| `DELETE /api/v1/me/money/commitments/{id}/payment` | Undo the linked expense |
| `/api/v1/me/khata/entries` | Actual income/expense entries and monthly totals |
| `/api/v1/me/khata/notes`, `/settings`, `/pin`, `/unlock` | Existing notes and privacy controls |

All amounts are integer paise. Payment dates cannot be in the future. Due dates are optional and can be cleared. Plans and entries are owner-scoped, and money endpoints require an active member. The older `GET /me/money` aggregate remains for client compatibility; new personal notebook screens do not use its wallet/receivable forecast.

## Verification

`tests/test_money_workspace.py` covers concurrent retries, idempotent undo, monthly totals, ownership, linked-entry edit protection, legacy completed plans, PIN enforcement, date validation and clearing a due date. `checks/money-workspace.mjs` exercises the production frontend with a synthetic account; run only against a fresh throwaway database configured for fixed-code login, using `APP_URL`, `INTERNAL_API_URL`, and `CHECK_LOGIN_CODE`.

## Personal notebook versus My Payments

For this release, My Money is the personal notebook and **My Payments** is the record of direct-UPI course/mentoring payments and recipient confirmations. The old Wallet and Wallet statement routes redirect to `/app/payments`. No credits screen or money-held balance is presented.

Members pay the provider’s UPI ID outside WomSakhi, submit a transaction reference, then wait for the teacher or mentor to check their own account and confirm receipt. A claim remains pending; only the recipient can confirm it. This does not create a wallet credit or a personal notebook entry. Existing confirmation flows continue to record provider income in Business books.

Bank payouts remain a later release feature. Historical wallet data and read APIs are preserved for compatibility. The gateway checkout routes and webhook are unavailable under the default `DIRECT_UPI_ONLY=true`; old checkout links lead to My Payments. See [Direct UPI payments](DIRECT_UPI_PAYMENTS.md) for scope, proof and validation.

## Customer dues inside My Money

The old “Who owes you money” navigation entry is now **Customer dues**, grouped under My Money and linked from its notebook. The existing `/app/books` URL and saved records remain in place. The Earn board offers one My Money entry with a Customer dues shortcut.

My Money’s notebook answers “what did I receive or spend?”; Customer dues answers “which customers still need to pay for work already delivered?”. Upcoming work and received customer payments have their own filters. Upcoming work does not count as an overdue payment, and overdue counts use the actual due date rather than counting every unpaid customer.

A customer record has a name, work/order description, amount, stage, date, optional due date and order source. Recording a receipt asks when the money actually arrived and updates the same customer row; it clears the due date. Older clients that mark a record received without supplying a date default to today on the first transition and retain that date on retries. Optional due dates can be cleared. Names cannot be blank, amounts must be positive, and receipt dates cannot be in the future.

These are separate business records: no personal notebook entry, wallet credit or UPI confirmation is automatically created. Existing course and mentoring business-income records link to My Payments and have no direct edit/remove action in the customer-dues screen. Loading and failed reads do not display fallback totals or a false empty-success state. The notebook PIN continues to protect the personal notebook; Customer dues retains its existing member ownership controls.

`tests/test_customer_dues.py` covers ownership, receipt dates, repeat updates without duplicate records, due-date clearing and separation from personal income. `checks/customer-dues.mjs` exercises the production UI with a synthetic member: create, record receipt, edit, remove, hidden amounts, mobile light/dark layouts and explicit failure states.

## Business income summary

The existing `/app/books/proof` page is now **Business income summary**. It reads the same six-month received-payment aggregation. The summary shows the account holder, reporting period, total received, monthly average, recorded receipt count and monthly rows with received amounts, receipt counts and customer counts. Unpaid dues and upcoming work are excluded. The average includes all months in the selected reporting window, including zero months.

The previous purpose choices (renting, admission, loans and guarantor), “make statement” gate and supposed verification-link claim have been removed. Navigation, the Customer dues shortcut and the error screen use the new name. Share and Print / save PDF use the same snapshot shown in the preview, with exact paise. Sharing uses the device share sheet or clipboard; print opens a clean summary document. Neither action sends an application or certifies income. No verification reference or official acceptance promise is generated.

Loading and failed reads do not show a fallback income total. A successful empty summary explains the absence of received payments and disables sharing/printing. The existing page and API URLs remain available for compatibility; the API description now identifies the output as a record-keeping summary.
