import { apiClient } from "@/lib/api";

// --- Billing (Settings) ---
// Typed wrappers over /billing. What comes back is counted or measured on the
// server: the entitlement tier, seats, storage on disk, and only invoices some
// code actually issued. There is no card, no plan price and no auto-pay,
// because none of those exist for this installation.

export interface BillingInfo {
  company: string;
  email: string;
  gstin: string;
  address: string;
}

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
}

export interface BillingOverview {
  plan: { tier: string; label: string; features: PlanFeature[]; note: string };
  seats: { staff: number; super_admins: number; active_staff: number; members: number };
  storage: { bytes: number; label: string; files: number; location: string };
  billing_info: BillingInfo;
  billing_info_saved: boolean;
  billing_info_updated_at: string;
  payments: { provider: string; enabled: boolean; custody: boolean; note: string };
  invoices_total: number;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  date: string;
  period: string;
  description: string;
  plan: string;
  amount: string;
  status: string; // "Paid" | "Pending" | "Failed"
}

export interface InvoiceList {
  items: BillingInvoice[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// --- Reads --------------------------------------------------------------------

export async function apiBillingOverview(): Promise<BillingOverview> {
  const { data } = await apiClient.get<BillingOverview>("/billing/account");
  return data;
}

export async function apiListInvoices(
  params: { status?: string; page?: number; page_size?: number } = {}
): Promise<InvoiceList> {
  const { data } = await apiClient.get<InvoiceList>("/billing/invoices", { params });
  return data;
}

export async function apiGetInvoice(invoiceNumber: string): Promise<BillingInvoice> {
  const { data } = await apiClient.get<BillingInvoice>(`/billing/invoices/${invoiceNumber}`);
  return data;
}

export async function apiDownloadInvoice(invoiceNumber: string): Promise<Blob> {
  const { data } = await apiClient.get(`/billing/invoices/${invoiceNumber}/download`, {
    responseType: "blob",
  });
  return data as Blob;
}

// --- Writes -------------------------------------------------------------------

export async function apiUpdateBillingInfo(body: BillingInfo): Promise<BillingInfo> {
  const { data } = await apiClient.put<BillingInfo>("/billing/account/billing-info", body);
  return data;
}
