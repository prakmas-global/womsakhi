"use client";

import { useCallback, useEffect, useState } from "react";
import type { ElementType } from "react";
import {
  CreditCard,
  Crown,
  Users,
  CalendarDays,
  Package,
  CloudUpload,
  Headphones,
  ShieldCheck,
  Plus,
  CheckCircle2,
  FileText,
  Mail,
  ChevronRight,
  Receipt,
  XCircle,
  Download,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, ProgressBar, Select, Switch, useToast } from "@/design-system";
import {
  apiGetBillingAccount,
  apiListPlans,
  apiListInvoices,
  apiChangePlan,
  apiCancelSubscription,
  apiUpdatePayment,
  apiToggleAutoPay,
  apiUpdateBillingInfo,
  apiDownloadInvoice,
  type BillingAccount,
  type BillingPlan,
  type BillingInvoice,
  type BillingInfo,
} from "@/lib/billing-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

// Icons are stored on the backend by NAME (features + usage); map them back here.
const ICON_MAP: Record<string, ElementType> = {
  Users,
  CalendarDays,
  Package,
  CloudUpload,
  Headphones,
  Mail,
};
const iconFor = (name: string): ElementType => ICON_MAP[name] ?? Package;

export default function BillingPage() {
  const toast = useToast();
  // Live data from MongoDB
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [planModal, setPlanModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [billingInfoModal, setBillingInfoModal] = useState(false);
  const [planDetailsModal, setPlanDetailsModal] = useState(false);

  // Plan-selection modal draft
  const [selectedPlan, setSelectedPlan] = useState("");

  // Payment modal draft
  const [payDraft, setPayDraft] = useState({
    name: "",
    number: "",
    expiry: "",
    cvc: "",
    brand: "Mastercard",
  });

  // Billing information modal draft
  const [billingDraft, setBillingDraft] = useState<BillingInfo>({
    company: "",
    email: "",
    gstin: "",
    address: "",
  });

  const refresh = useCallback(async () => {
    try {
      const [acc, pls, inv] = await Promise.all([
        apiGetBillingAccount(),
        apiListPlans(),
        apiListInvoices({ page_size: 100 }),
      ]);
      setAccount(acc);
      setPlans(pls);
      setInvoices(inv.items);
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!account) {
    return (
      <div>
        <div className="mb-6 flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <CreditCard className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Billing &amp; Subscription</h1>
            <p className="mt-1 text-sm text-ink-subtle">Manage your subscription plan, billing information and payment history.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20 text-sm text-ink-subtle">
          {loading ? "Loading billing…" : "Unable to load billing information."}
        </div>
      </div>
    );
  }

  // Derived UI values from the live account (account is non-null past this point).
  const plan = account.plan;
  const planPrice = account.plan_price;
  const planDesc = account.plan_description;
  const cancelled = account.status === "Cancelled";
  const autoPay = account.auto_pay;
  const card = account.card;
  const nextBillingDate = account.next_billing_date;
  const usageResetDate = account.usage_reset_date;
  const features = account.features;
  const usage = account.usage;
  const summary = account.summary;
  const billingInfo = account.billing_info;

  const openPlanModal = () => {
    setSelectedPlan(plan);
    setPlanModal(true);
  };

  const savePlan = async () => {
    const chosen = plans.find((p) => p.name === selectedPlan);
    if (!chosen) return;
    try {
      await apiChangePlan(chosen.name);
      await refresh();
      setPlanModal(false);
    } catch (err) {
      toast.error("Could not change the plan", { description: memberError(err) });
    }
  };

  const cancelSubscription = async () => {
    try {
      await apiCancelSubscription();
      await refresh();
      setCancelModal(false);
    } catch (err) {
      toast.error("Could not cancel the subscription", { description: memberError(err) });
    }
  };

  const savePayment = async () => {
    if (!payDraft.number.trim() || !payDraft.expiry.trim()) return;
    try {
      await apiUpdatePayment({
        number: payDraft.number,
        expiry: payDraft.expiry.trim(),
        name: payDraft.name,
        cvc: payDraft.cvc,
        brand: payDraft.brand,
      });
      await refresh();
      setPaymentModal(false);
      setPayDraft({ name: "", number: "", expiry: "", cvc: "", brand: payDraft.brand });
    } catch (err) {
      toast.error("Could not save the payment method", { description: memberError(err) });
    }
  };

  const handleAutoPay = async (next: boolean) => {
    try {
      await apiToggleAutoPay(next);
      await refresh();
    } catch (err) {
      toast.error("Could not change auto-pay", { description: memberError(err) });
    }
  };

  const openBillingInfo = () => {
    setBillingDraft(billingInfo);
    setBillingInfoModal(true);
  };

  const saveBillingInfo = async () => {
    if (!billingDraft.company.trim() || !billingDraft.email.trim()) return;
    try {
      await apiUpdateBillingInfo(billingDraft);
      await refresh();
      toast.success("Billing details saved");
      setBillingInfoModal(false);
    } catch (err) {
      toast.error("Could not save the billing details", { description: memberError(err) });
    }
  };

  const downloadInvoice = async (inv: BillingInvoice) => {
    try {
      const blob = await apiDownloadInvoice(inv.invoice_number);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <CreditCard className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Billing &amp; Subscription</h1>
          <p className="mt-1 text-sm text-ink-subtle">Manage your subscription plan, billing information and payment history.</p>
        </div>
      </div>

      <ResizableColumns id="settings-billing" defaultSize={0.74} className="gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Current Plan */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Current Plan</h2>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-50 to-violet-tint text-violet-ink">
                  <Crown className="h-8 w-8" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-ink">{plan}</h3>
                    {cancelled ? <Badge tone="rose">Cancelled</Badge> : <Badge tone="emerald">Active</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-subtle">Billed monthly</p>
                  <p className="mt-1 max-w-md text-sm text-ink-muted">{planDesc}</p>
                  <button
                    onClick={() => setPlanDetailsModal(true)}
                    className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-brand-ink"
                  >
                    View Plan Details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-ink">
                  {planPrice} <span className="text-sm font-medium text-ink-subtle">/ month</span>
                </p>
                <p className="mt-1 text-sm text-ink-subtle">Next billing on</p>
                <p className="text-sm font-semibold text-ink-muted">{nextBillingDate}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button onClick={openPlanModal} className="btn btn-secondary btn-block">Change Plan</button>
                  <button
                    onClick={() => setCancelModal(true)}
                    disabled={cancelled}
                    className="btn btn-danger btn-block disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancelled ? "Subscription Cancelled" : "Cancel Subscription"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-surface-inset/70 p-3 sm:grid-cols-3 lg:grid-cols-5">
              {features.map((f) => {
                const Icon = iconFor(f.icon);
                return (
                  <div key={f.sub} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-ink shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">{f.label}</p>
                      <p className="text-xs text-ink-subtle">{f.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Payment Method */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Payment Method</h2>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-14 items-center justify-center rounded-lg bg-surface-inset">
                  <span className="relative flex items-center">
                    {/* Mastercard's own red and amber. Deliberately literal:
                        these identify the card network and are not ours to
                        theme — recolouring them would misrepresent the brand. */}
                    <span className="h-6 w-6 rounded-full bg-[#eb001b]" />
                    <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#f79e1b] opacity-90" />
                  </span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{card.brand} ending in {card.last4}</p>
                    <Badge tone="brand">Primary</Badge>
                  </div>
                  <p className="text-xs text-ink-subtle">Expires {card.expiry}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {autoPay ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-status-ok-ink">
                    <CheckCircle2 className="h-4 w-4" /> Auto-pay is enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink-subtle">
                    <XCircle className="h-4 w-4" /> Auto-pay is disabled
                  </span>
                )}
                <button onClick={() => setPaymentModal(true)} className="btn btn-secondary">Update Payment Method</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={() => setPaymentModal(true)} className="btn btn-secondary btn-sm">
                <Plus className="h-4 w-4" /> Add Payment Method
              </button>
            </div>
            <div className="mt-3">
              <Switch
                label="Auto-pay"
                description="Automatically pay invoices on the billing date"
                checked={autoPay}
                onChange={handleAutoPay}
              />
            </div>
          </Card>

          {/* Billing History */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Billing History</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Date</th>
                    <th scope="col" className="px-2 py-3">Description</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Plan</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Amount</th>
                    <th scope="col" className="px-2 py-3">Status</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoices.map((h) => (
                    <tr key={h.invoice_number} className="text-sm hover:bg-surface-hover/60">
                      <td className="whitespace-nowrap px-2 py-3.5 font-medium text-ink-muted">{h.date}</td>
                      <td className="px-2 py-3.5 text-ink-muted">{h.description}</td>
                      <td className="whitespace-nowrap px-2 py-3.5 text-ink-subtle">{h.period}</td>
                      <td className="whitespace-nowrap px-2 py-3.5 font-semibold text-ink">{h.amount}</td>
                      <td className="px-2 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ok-bg px-2.5 py-1 text-2xs font-semibold text-status-ok-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {h.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadInvoice(h)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-brand-ink"
                          >
                            <FileText className="h-4 w-4" /> {h.invoice_number}
                          </button>
                          <Menu
                            trigger={
                              <button
                                aria-label="Invoice actions"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-hover hover:text-ink-muted"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            }
                          >
                            <MenuItem icon={Download} onClick={() => downloadInvoice(h)}>Download invoice</MenuItem>
                            <MenuItem icon={Eye} onClick={() => downloadInvoice(h)}>View invoice</MenuItem>
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => invoices[0] && downloadInvoice(invoices[0])}
                className="flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-brand-ink"
              >
                View All Invoices <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Usage Overview */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Usage Overview</h2>
              <span className="text-xs text-ink-subtle">Resets on {usageResetDate}</span>
            </div>
            <div className="space-y-4">
              {usage.map((u) => {
                const Icon = iconFor(u.icon);
                return (
                  <div key={u.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                          <Icon className="h-4 w-4" />
                        </span>
                        {u.label}
                      </span>
                      <span className="text-sm font-semibold text-ink">{u.value}</span>
                    </div>
                    <div className="pl-9"><ProgressBar value={u.pct} color={u.color} /></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setPlanDetailsModal(true)}
                className="flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-brand-ink"
              >
                View All Usage <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>

          {/* Billing Summary */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Billing Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-subtle">Plan</dt>
                <dd className="font-semibold text-ink">{summary.plan}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-subtle">Billing Cycle</dt>
                <dd className="font-semibold text-ink">{summary.billing_cycle}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-subtle">Subtotal</dt>
                <dd className="font-semibold text-ink">{summary.subtotal}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-subtle">Taxes ({summary.tax_percent}%)</dt>
                <dd className="font-semibold text-ink">{summary.taxes}</dd>
              </div>
            </dl>
            <div className="my-3 border-t border-line" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="font-display text-lg font-bold text-brand-ink">{summary.total}</span>
            </div>
            <p className="mt-3 text-xs text-ink-subtle">All amounts are in {summary.currency}</p>
          </Card>

          {/* Need to make a change? */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Need to make a change?</h2>
            <div className="space-y-2">
              <button
                onClick={openPlanModal}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                  <CreditCard className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">Change Plan</span>
                  <span className="block text-xs text-ink-subtle">Upgrade or downgrade your plan</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </button>
              <button
                onClick={openBillingInfo}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                  <Receipt className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">Billing Information</span>
                  <span className="block text-xs text-ink-subtle">Update your billing details</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </button>
              <button
                onClick={() => setCancelModal(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                  <XCircle className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">Cancel Subscription</span>
                  <span className="block text-xs text-ink-subtle">Cancel your subscription plan</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </button>
            </div>
          </Card>
        </div>
      </ResizableColumns>

      {/* Change Plan Modal */}
      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        title="Change Plan"
        description="Choose the plan that best fits your team."
        icon={CreditCard}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button onClick={() => setPlanModal(false)} className="btn btn-outline">Cancel</button>
            <button onClick={savePlan} className="btn btn-primary">Confirm Plan</button>
          </>
        }
      >
        <div className="space-y-3">
          {plans.map((p) => {
            const active = selectedPlan === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelectedPlan(p.name)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-tint/60 ring-1 ring-brand-500/40"
                    : "border-line hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{p.name}</span>
                    {p.name === plan && <Badge tone="emerald">Current</Badge>}
                  </span>
                  <span className="mt-1 block text-xs text-ink-subtle">{p.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-display text-lg font-bold text-ink">{p.price}</span>
                  <span className="block text-xs text-ink-subtle">/ month</span>
                  {active && (
                    <CheckCircle2 className="ml-auto mt-1 h-5 w-5 text-brand-ink" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Cancel Subscription"
        description="Your plan will remain active until the end of the current billing period."
        icon={XCircle}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button onClick={() => setCancelModal(false)} className="btn btn-outline">Keep Plan</button>
            <button
              onClick={cancelSubscription}
              className="btn btn-danger"
            >
              Cancel Subscription
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Are you sure you want to cancel your <span className="font-semibold text-ink">{plan}</span>?
          You will lose access to premium features once the billing period ends.
        </p>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Payment Method"
        description="Add or update the card used for billing."
        icon={CreditCard}
        iconTone="violet"
        footer={
          <>
            <button onClick={() => setPaymentModal(false)} className="btn btn-outline">Cancel</button>
            <button onClick={savePayment} className="btn btn-primary">Save Card</button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Cardholder Name"
            placeholder="Full name on card"
            value={payDraft.name}
            onChange={(e) => setPayDraft({ ...payDraft, name: e.target.value })}
          />
          <Input
            label="Card Number"
            required
            icon={CreditCard}
            placeholder="1234 5678 9012 3456"
            value={payDraft.number}
            onChange={(e) => setPayDraft({ ...payDraft, number: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Expiry"
              required
              placeholder="MM/YY"
              value={payDraft.expiry}
              onChange={(e) => setPayDraft({ ...payDraft, expiry: e.target.value })}
            />
            <Input
              label="CVC"
              placeholder="123"
              value={payDraft.cvc}
              onChange={(e) => setPayDraft({ ...payDraft, cvc: e.target.value })}
            />
          </div>
          <Select
            label="Card Brand"
            options={["Mastercard", "Visa", "American Express", "RuPay"]}
            value={payDraft.brand}
            onChange={(e) => setPayDraft({ ...payDraft, brand: e.target.value })}
          />
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <ShieldCheck className="h-4 w-4 text-status-ok-ink" /> Card details are stored securely.
          </p>
        </div>
      </Modal>

      {/* Billing Information Modal */}
      <Modal
        open={billingInfoModal}
        onClose={() => setBillingInfoModal(false)}
        title="Billing Information"
        description="Update the details shown on your invoices."
        icon={Receipt}
        iconTone="sky"
        footer={
          <>
            <button onClick={() => setBillingInfoModal(false)} className="btn btn-outline">Cancel</button>
            <button onClick={saveBillingInfo} className="btn btn-primary">Save Changes</button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Company Name"
            required
            value={billingDraft.company}
            onChange={(e) => setBillingDraft({ ...billingDraft, company: e.target.value })}
          />
          <Input
            label="Billing Email"
            required
            icon={Mail}
            value={billingDraft.email}
            onChange={(e) => setBillingDraft({ ...billingDraft, email: e.target.value })}
          />
          <Input
            label="GSTIN"
            value={billingDraft.gstin}
            onChange={(e) => setBillingDraft({ ...billingDraft, gstin: e.target.value })}
          />
          <Input
            label="Billing Address"
            value={billingDraft.address}
            onChange={(e) => setBillingDraft({ ...billingDraft, address: e.target.value })}
          />
        </div>
      </Modal>

      {/* Plan Details / Usage Modal */}
      <Modal
        open={planDetailsModal}
        onClose={() => setPlanDetailsModal(false)}
        title={`${plan} Details`}
        description="Included features and current usage."
        icon={Crown}
        iconTone="violet"
        size="lg"
        footer={
          <button onClick={() => setPlanDetailsModal(false)} className="btn btn-primary">Done</button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-inset/70 p-3 sm:grid-cols-3">
            {features.map((f) => {
              const Icon = iconFor(f.icon);
              return (
                <div key={f.sub} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-ink shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{f.label}</p>
                    <p className="text-xs text-ink-subtle">{f.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-4">
            {usage.map((u) => {
              const Icon = iconFor(u.icon);
              return (
                <div key={u.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <Icon className="h-4 w-4" />
                      </span>
                      {u.label}
                    </span>
                    <span className="text-sm font-semibold text-ink">{u.value}</span>
                  </div>
                  <div className="pl-9"><ProgressBar value={u.pct} color={u.color} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
