# Final Submission Checklist

Due: Sunday, 5 July 2026 at 11:00 BST.

## Submission Details

**Project name:** CashPilot

**One-liner:** CashPilot turns Xero accounting data into a human-approved revenue and cash-flow action plan.

**What we built:**
CashPilot is a dark analytics cockpit for small businesses. It uses Xero accounting records to forecast cash position over the next 30-90 days, detect future cash crunches, find revenue opportunities, and queue specific actions for owner approval.

The product recommends:

- which customers to chase
- which invoice follow-up to send
- whether an early-payment incentive is worth it
- which customers are good reactivation or upsell candidates
- which repeat purchases could become retainers
- which supplier payment changes may protect short-term cash

Each recommendation includes Xero evidence, expected impact, an agent-drafted message, and a human-control note.

The dashboard also includes a forecast intelligence layer that shows which model layers are running and which business factors are driving the cash forecast.

## How The Project Uses The Xero API

CashPilot uses Xero as the accounting system of record. The live path connects through Xero OAuth 2.0 using the official `xero-node` SDK, then maps Xero records into deterministic forecast and revenue-opportunity models.

Xero data powers:

- **Cash-flow forecast:** open receivables, payables, payment timing, bank-summary cash position.
- **Customer payment-delay model:** contacts, authorised invoices, paid invoices, due dates, fully paid dates.
- **Time-series forecast:** daily ledger of expected inflows/outflows across 30, 60, and 90 days.
- **Monte Carlo simulation:** payment-delay uncertainty and crunch probability.
- **Explainability:** cash-driver attribution for customer payment timing, supplier timing, fixed costs, starting buffer, revenue pipeline, and approved action lift.
- **Revenue opportunity engine:** invoice line items, contacts, paid invoices, service categories, repeat purchases.
- **Action approval queue:** invoice IDs, contact names, bill IDs, quote/draft-action plans.
- **Xero API footprint panel:** visible endpoint and record provenance for judges.

For demo resilience, the repo also includes `XERO_DEMO_AUTH=true`, which presents seeded Xero-style demo data as a connected local Xero demo tenant when Xero login is unavailable. The live OAuth/API path is implemented and ready for real credentials.

## Xero API Endpoints Used

All calls are read-first unless a human approves a future action. Current implementation uses these HTTP methods and endpoints:

| Method | Xero API endpoint | Used for |
| --- | --- | --- |
| `GET` | `/connections` | OAuth tenant discovery and connected organisation selection |
| `GET` | `/Organisations` | Organisation name, base currency, connected tenant metadata |
| `GET` | `/Contacts?summaryOnly=true` | Customer/supplier identity, relationship context, contact mapping |
| `GET` | `/Invoices?Statuses=AUTHORISED` | Open receivables/payables for cash forecast and action ranking |
| `GET` | `/Invoices?Statuses=PAID` | Payment history, median days late, repeat-purchase detection |
| `GET` | `/Accounts` | Accounting-resource coverage and future categorisation |
| `GET` | `/Items` | Item/service catalogue coverage and future package recommendations |
| `GET` | `/Payments` | Payment activity coverage and future cash timing enrichment |
| `GET` | `/Quotes` | Quote activity coverage and future approved quote workflow |
| `GET` | `/BankTransactions` | Bank activity coverage and future cash reconciliation |
| `GET` | `/RepeatingInvoices` | Recurring revenue/subscription conversion context |
| `GET` | `/TrackingCategories` | Future segmentation by department, service line, or project |
| `GET` | `/Reports/BankSummary` | Opening/current cash balance for forecast baseline |
| `GET` | `/Reports/ProfitAndLoss` | Business performance context |
| `GET` | `/Reports/BalanceSheet` | Financial position context |
| `GET` | `/Reports/TrialBalance` | Accounting completeness and finance context |
| `GET` | `/Reports/AgedReceivablesByContact` | Customer receivables risk by contact |
| `GET` | `/Reports/AgedPayablesByContact` | Supplier/payables risk by contact |

Future human-approved write actions are designed around creating draft quotes/invoices, adding contact notes, and preparing repeating-invoice templates, but the current app does not perform automatic writes.

## Xero OAuth 2.0 Scopes Needed

Identity and refresh scopes:

- `openid`
- `profile`
- `email`
- `offline_access`

Granular accounting scopes:

- `accounting.invoices`
- `accounting.invoices.read`
- `accounting.payments.read`
- `accounting.banktransactions.read`
- `accounting.reports.aged.read`
- `accounting.reports.balancesheet.read`
- `accounting.reports.profitandloss.read`
- `accounting.reports.trialbalance.read`
- `accounting.contacts`
- `accounting.contacts.read`
- `accounting.settings`
- `accounting.settings.read`

Compatibility/reporting scope:

- `accounting.reports.read`

## Development Platform Used

- React 19 + Vite frontend
- Express + TypeScript backend
- Node.js runtime
- `xero-node` official Xero Accounting SDK
- OpenAI Agents SDK for optional narrative/agent orchestration
- Optional Xero MCP bridge scaffolding via `@xeroapi/xero-mcp-server`
- Recharts for the before-vs-after forecast chart
- Deterministic time-series ledger, payment-delay model, Monte Carlo simulation, and cash-driver attribution
- GitHub repository: https://github.com/kevinmeix1/cashpilot

## Track(s)

Recommended track selection:

- **Revenue growth / improve cash flow using Xero data**
- **Predicting late payments and automating follow-ups**
- **Identifying upsell, cross-sell, subscription conversion, and dormant-customer opportunities**

If the form has one track only, choose the Xero track focused on actively identifying and acting on revenue opportunities using Xero data.

## Links To Add Before Submission

**GitHub repo:**
https://github.com/kevinmeix1/cashpilot

**Presentation link:**
TODO: paste Canva/Google Slides link here.

**Demo video link:**
TODO: paste Loom/YouTube/Drive link here.

## Copy-Paste Submission Summary

CashPilot is a Xero-powered revenue and cash-flow action cockpit for small businesses. It connects to Xero via OAuth 2.0 using the official `xero-node` SDK, reads accounting records such as contacts, invoices, payments, bank transactions, repeating invoices, tracking categories, and financial reports, then turns that data into a 30-90 day cash forecast and a ranked approval queue of revenue and cash-flow actions.

The system combines a deterministic daily time-series ledger, customer payment-delay model, Monte Carlo cash simulation, and cash-driver attribution layer. It detects future cash crunches, identifies dormant customers, upsell/cross-sell opportunities, subscription conversions, late-payment recovery actions, and underperforming services. Each recommendation includes Xero evidence, forecast impact, an agent-drafted message, and a human approval step before any external action is taken.
