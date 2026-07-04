# Demo Video Script

Target length: 2-3 minutes.

## Opening

"This is CashFlow Radar, a Xero-powered action cockpit for small businesses. It helps owners understand when cash will become risky and what actions will improve revenue and cash flow."

## Step 1: Show Connected Xero Demo

Open:

```text
http://127.0.0.1:5173/?source=xero
```

Say:

"For the demo, this is running in local Xero demo tenant mode. The live OAuth 2.0 path is implemented with the official Xero SDK, and the app reads the same Xero-style accounting resources used by the model."

Point to:

- Xero connection status
- source set to Live Xero API
- Xero API footprint later in the page

## Step 2: Show Top Signals

Say:

"At the top, the owner sees the business outcome: baseline breach on 18 July, no breach after selected actions, twenty-two thousand pounds of revenue upside, and thirteen thousand pounds of protected cash."

## Step 3: Show Pending Approval

Say:

"The core workflow is the approval queue. The agent has selected three cash-flow actions and five growth actions. Each action explains the Xero evidence behind it."

Open one cash action:

- Bright Studio early-payment incentive
- show invoice number
- show cash impact
- show human-control note

Open one growth action:

- Harbor Coffee Co reactivation
- show paid invoice history
- show expected revenue
- show drafted message

## Step 4: Show Forecast Chart

Say:

"The before-vs-after chart shows whether these actions actually change the forecast. The numerical forecast is deterministic. The agents explain, rank, and draft actions, but they do not invent the numbers."

## Step 5: Show Revenue Opportunity Agent

Say:

"This is where the app aligns with the growth track. It detects dormant customers, retainer conversions, upsells, late-payment recovery, and underperforming services from Xero invoice and line-item activity."

## Step 6: Show Xero API Footprint

Say:

"Here is the Xero API footprint: invoices, contacts, accounts, items, payments, quotes, bank transactions, repeating invoices, tracking categories, and reports. The live path uses OAuth 2.0 scopes for invoices, contacts, payments, bank transactions, reports, and settings."

## Step 7: Approval

Click **Approve 8**.

Say:

"Approval queues the selected actions for reviewed execution. The app is intentionally human-in-the-loop: no customer message, supplier request, invoice change, or quote is sent automatically."

## Closing

"CashFlow Radar turns Xero accounting records into the next best revenue and cash-flow actions, with measurable forecast impact and human approval."
