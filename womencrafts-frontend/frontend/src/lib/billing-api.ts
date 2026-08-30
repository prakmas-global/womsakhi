import { apiClient } from "@/lib/api";

// --- Billing & Subscription module (Settings) ---
// Typed wrappers over the FastAPI /billing endpoints. Money / usage figures are
// display strings ("₹2,999", "128 / Unlimited") painted verbatim by the UI.

export interface BillingCard {
  brand: string;
  last4: string;
  expiry: string;
  is_primary: boolean;
}

export interface BillingInfo {
  company: string;
  email: string;
  gstin: string;
  address: string;
}

export interface BillingFeature {
  icon: string; // lucide icon NAME, mapped back on the client
  label: string;
  sub: string;
}

export interface BillingUsageItem {
  icon: string; // lucide icon NAME
  label: string;
  value: string;
  pct: number;
  color: string;
}

export interface BillingSummary {
  plan: string;
  billing_cycle: string;
  subtotal: string;
  tax_percent: number;
  taxes: string;
  total: string;
  currency: string;
}

export interface BillingAccount {
  id: string;
  plan: string;
  plan_price: string;
  plan_description: string;
  status: string; // "Active" | "Cancelled"
  billing_cycle: string;
  next_billing_date: string;
  usage_reset_date: string;
  auto_pay: boolean;
  card: BillingCard;
  billing_info: BillingInfo;
  features: BillingFeature[];
  usage: BillingUsageItem[];
  summary: BillingSummary;
}

export interface BillingPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  billing_cycle: string;
  order: number;
  current: boolean;
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

export interface UsageOverview {
  usage: BillingUsageItem[];
  usage_reset_date: string;
}

export interface UpdatePaymentInput {
  number: string;
  expiry: string;
  name?: string;
  cvc?: string;
  brand: string;
}

// --- Reads --------------------------------------------------------------------

export async function apiGetBillingAccount(): Promise<BillingAccount> {
  const { data } = await apiClient.get<BillingAccount>("/billing/account");
  return data;
}

export async function apiGetBillingInfo(): Promise<BillingInfo> {
  const { data } = await apiClient.get<BillingInfo>("/billing/account/billing-info");
  return data;
}

export async function apiGetUsage(): Promise<UsageOverview> {
  const { data } = await apiClient.get<UsageOverview>("/billing/account/usage");
  return data;
}

export async function apiGetBillingSummary(): Promise<BillingSummary> {
  const { data } = await apiClient.get<BillingSummary>("/billing/account/summary");
  return data;
}

export async function apiListPlans(): Promise<BillingPlan[]> {
  const { data } = await apiClient.get<BillingPlan[]>("/billing/plans");
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

export async function apiChangePlan(planName: string): Promise<BillingAccount> {
  const { data } = await apiClient.put<BillingAccount>("/billing/account/plan", {
    plan_name: planName,
  });
  return data;
}

export async function apiCancelSubscription(): Promise<BillingAccount> {
  const { data } = await apiClient.post<BillingAccount>("/billing/account/cancel");
  return data;
}

export async function apiUpdatePayment(body: UpdatePaymentInput): Promise<BillingAccount> {
  const { data } = await apiClient.put<BillingAccount>("/billing/account/payment", body);
  return data;
}

export async function apiToggleAutoPay(autoPay: boolean): Promise<BillingAccount> {
  const { data } = await apiClient.patch<BillingAccount>("/billing/account/autopay", {
    auto_pay: autoPay,
  });
  return data;
}

export async function apiUpdateBillingInfo(body: BillingInfo): Promise<BillingInfo> {
  const { data } = await apiClient.put<BillingInfo>("/billing/account/billing-info", body);
  return data;
}
