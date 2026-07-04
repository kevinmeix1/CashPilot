import type { ExternalDeal, ExternalOrder } from "../types/domain";

export interface ExternalSalesSnapshot {
  deals: ExternalDeal[];
  orders: ExternalOrder[];
}

export interface ExternalSalesConnector {
  loadExternalSalesSnapshot(): Promise<ExternalSalesSnapshot>;
}

export class MockExternalSalesConnector implements ExternalSalesConnector {
  async loadExternalSalesSnapshot(): Promise<ExternalSalesSnapshot> {
    return mockExternalSalesSnapshot;
  }
}

export const mockExternalSalesSnapshot: ExternalSalesSnapshot = {
  deals: [
    {
      externalDealId: "CRM-DEAL-6500",
      sourceSystem: "MockCRM",
      companyName: "Brightside Studio Ltd",
      contactEmail: "finance@brightside.co.uk",
      dealName: "Conversion Sprint",
      amount: 6500,
      closeDate: "2026-07-02",
      stage: "closed_won",
      productOrService: "Conversion sprint",
      rawPayload: {
        owner: "Mia",
        stage_label: "Closed Won",
        invoice_instruction: "invoice after kickoff",
        company_alias: "Brightside Studio Ltd"
      }
    },
    {
      externalDealId: "CRM-DEAL-2210",
      sourceSystem: "MockCRM",
      companyName: "Harbor Coffee Company",
      contactEmail: "founders@harborcoffee.example",
      dealName: "Launch Kit Follow-up",
      amount: 2450,
      closeDate: "2026-07-01",
      stage: "open",
      productOrService: "Launch kit",
      rawPayload: {
        next_step: "confirm assets"
      }
    },
    {
      externalDealId: "CRM-DEAL-9104",
      sourceSystem: "MockCRM",
      companyName: "Luna Fit Ltd",
      contactEmail: "ops@lunafitness.example",
      dealName: "Monthly Content Renewal",
      amount: 2100,
      closeDate: "2026-07-03",
      stage: "closed_won",
      productOrService: "Content retainer",
      rawPayload: {
        cadence: "monthly",
        source: "renewal pipeline"
      }
    },
    {
      externalDealId: "CRM-DEAL-3319",
      sourceSystem: "MockCRM",
      companyName: "Apex Architecture",
      contactEmail: "studio@apexarchitects.example",
      dealName: "Analytics Sprint",
      amount: 2600,
      closeDate: "2026-07-05",
      stage: "closed_won",
      productOrService: "Analytics",
      rawPayload: {
        project_code: "AN-APEX"
      }
    },
    {
      externalDealId: "CRM-DEAL-4040",
      sourceSystem: "MockCRM",
      companyName: "NewCo Marketplace",
      contactEmail: "ops@newcomarket.example",
      dealName: "Discovery Call",
      amount: 1800,
      closeDate: "2026-07-08",
      stage: "open",
      productOrService: "Discovery",
      rawPayload: {
        missing_xero_contact: true
      }
    }
  ],
  orders: [
    {
      externalOrderId: "SHOPIFY-ORDER-1098",
      sourceSystem: "MockShopify",
      customerName: "Harbor Coffee Co",
      customerEmail: "founders@harborcoffee.example",
      orderDate: "2026-07-01",
      amount: 2450,
      productNames: ["Launch Kit", "Brand Assets"],
      status: "paid",
      rawPayload: {
        vat_number: null,
        channel: "online checkout"
      }
    },
    {
      externalOrderId: "SHOPIFY-ORDER-1101",
      sourceSystem: "MockShopify",
      customerName: "LUNA monthly content",
      customerEmail: "ops@lunafitness.example",
      orderDate: "2026-07-02",
      amount: 1967,
      productNames: ["Monthly content refresh"],
      status: "paid",
      rawPayload: {
        payout_id: "STRIPE-PO-2026-07-02",
        payment_fee: 54.42
      }
    },
    {
      externalOrderId: "SHOPIFY-ORDER-1114",
      sourceSystem: "MockShopify",
      customerName: "Apex Architects",
      customerEmail: "studio@apexarchitects.example",
      orderDate: "2026-07-03",
      amount: 2600,
      productNames: ["Analytics sprint"],
      status: "pending",
      rawPayload: {
        payment_status: "awaiting transfer"
      }
    },
    {
      externalOrderId: "CSV-ROW-77",
      sourceSystem: "MockCSV",
      customerName: "Brightside Ops",
      customerEmail: "operations@brightside.co.uk",
      orderDate: "2026-07-04",
      amount: 3200,
      productNames: ["Monthly support retainer"],
      status: "pending",
      rawPayload: {
        source_file: "retainers-july.csv",
        cadence: "monthly"
      }
    },
    {
      externalOrderId: "SHOPIFY-ORDER-1120",
      sourceSystem: "MockShopify",
      customerName: "Unknown buyer",
      orderDate: "2026-07-04",
      amount: 720,
      productNames: ["Template pack"],
      status: "paid",
      rawPayload: {
        email_missing: true
      }
    }
  ]
};
