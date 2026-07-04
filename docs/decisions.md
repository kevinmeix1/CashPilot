# CashPilot Design Decisions

## 1. Keep Xero As The System Of Record

The project is competing in Xero bounties, so Xero needs to be central. CashPilot uses external CRM/e-commerce data only as a signal. Xero decides whether the signal is actionable by checking contacts, invoices, payments, bills, and reports.

Example: the CRM says `Brightside Studio Ltd` is closed-won for GBP 6,500. CashPilot only recommends a draft invoice after it matches the company to a Xero contact and verifies that no similar Xero invoice already exists.

## 2. Use Agents For Reasoning, Not Raw Maths

Forecast numbers should be deterministic and repeatable. The app therefore keeps numerical work in TypeScript:

- daily cash ledger
- payment-delay assumptions
- Monte Carlo simulation
- revenue opportunity scoring
- smart mapping confidence
- before-vs-after scenario comparison

The agent layer is used for the work agents are good at:

- explaining the forecast in plain English
- drafting customer/supplier messages
- ranking owner priorities
- describing evidence and human-control steps
- making recommendations feel understandable to non-technical users

## 3. Human Approval First

Small businesses are sensitive to customer tone, supplier relationships, VAT/tax treatment, and invoice timing. CashPilot does not automatically send emails or mutate accounting records in the demo. It queues actions with:

- source records
- expected impact
- recommendation rationale
- draft message
- planned Xero writeback
- owner control note

This makes the product safer and more credible.

## 4. Explainability Is A Product Feature

The app does not only show charts. It explains what changed the forecast:

- which invoices are late
- which supplier payments create pressure
- which customer actions protect cash
- which revenue opportunities increase runway
- how sensitive the cash forecast is to payment delays
- what the Monte Carlo crunch probability means

For a non-technical owner, Monte Carlo is described as: "we ran many realistic payment-timing futures; this percentage is how often cash fell below the safe line."

## 5. Smart Mapping Beats Brittle Integrations

Traditional integrations often fail when:

- a CRM company name has `Ltd` but Xero does not
- a store order uses a trading name
- an email domain is more reliable than the typed company name
- a payment record has missing fields

CashPilot uses normalisation, similarity scoring, domain evidence, and review states so the owner can approve uncertain matches.

## 6. Bounty 01 Scope

Productivity features focus on painful back-office workflows:

- receipt-to-expense
- invoice reconciliation
- duplicate bill guard
- contractor payment prep
- subscription expense control

These are grounded in Xero records and include estimated time saved.

## 7. Bounty 02 Scope

Adaptive integration features focus on intelligent syncing:

- CRM deal to Xero draft invoice
- Shopify/Stripe-style order to Xero contact/invoice checks
- SaaS renewal to repeating invoice or retention action
- spreadsheet contractor data to Xero bill/payment preparation

The point is not just connectivity. The point is context-aware mapping with evidence and graceful handling of messy data.

## 8. What To Build Next

The highest-value production additions are:

- persistent audit and approval tables
- Xero draft-invoice writeback after approval
- contact-note creation for outreach history
- Make workflow triggers for approved actions
- Lovable UI iteration once the workflow is stable
- tenant-level data permissions and secure token storage
