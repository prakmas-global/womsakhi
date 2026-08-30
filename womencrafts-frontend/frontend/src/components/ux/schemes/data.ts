/**
 * Schemes & Benefits — public money she may already be entitled to.
 *
 * The hardest part of a government scheme is not applying, it is finding out it
 * exists and whether it applies to you. So every entry carries an explicit
 * eligibility list and a plain-language "what you get", and the app says
 * whether SHE looks eligible rather than leaving her to work it out.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Scheme = {
  id: string;
  name: string;
  body: string;
  who: string;
  gives: string;
  amount: string;
  category: "Loan" | "Savings" | "Training" | "Grant" | "Insurance";
  eligible: boolean;
  reason: string;
  needs: string[];
  deadline: string;
  icon: string;
  tint: string;
  ink: string;
  applied: boolean;
};

export const SCHEMES: Scheme[] = [
  {
    id: "sc1", name: "Pradhan Mantri Mudra Yojana", body: "Government of India",
    who: "Any woman running or starting a small business",
    gives: "A business loan with no collateral and no guarantor",
    amount: "Up to ₹10 lakh", category: "Loan", eligible: true,
    reason: "You have a registered shop and three months of records.",
    needs: ["Aadhaar", "PAN card", "Bank passbook", "Udyam registration"],
    deadline: "Open all year", icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green", applied: false,
  },
  {
    id: "sc2", name: "Mahila Samman Savings Certificate", body: "Post Office",
    who: "Any woman or girl, no income limit",
    gives: "A two-year deposit at a fixed rate, partly withdrawable",
    amount: "₹1,000 to ₹2 lakh", category: "Savings", eligible: true,
    reason: "Open to every woman. No conditions.",
    needs: ["Aadhaar", "PAN card"],
    deadline: "Until 31 March 2027", icon: "PiggyBank", tint: "--ux-tint-violet", ink: "--ux-violet", applied: true,
  },
  {
    id: "sc3", name: "Stand-Up India", body: "Government of India",
    who: "Women setting up a new manufacturing, services or trading business",
    gives: "A bank loan for a brand-new venture",
    amount: "₹10 lakh to ₹1 crore", category: "Loan", eligible: false,
    reason: "This is for a business you have not started yet. Yours is already trading.",
    needs: ["Aadhaar", "PAN card", "Project report", "Bank account"],
    deadline: "Open all year", icon: "Rocket", tint: "--ux-tint-blue", ink: "--ux-blue", applied: false,
  },
  {
    id: "sc4", name: "PM Vishwakarma", body: "Ministry of MSME",
    who: "Traditional artisans and craftspeople — tailors included",
    gives: "Skill training with a daily stipend, a toolkit grant, and a cheap loan",
    amount: "₹15,000 toolkit · loan up to ₹3 lakh", category: "Training", eligible: true,
    reason: "Tailoring is one of the eighteen listed trades.",
    needs: ["Aadhaar", "Bank passbook", "Proof of trade"],
    deadline: "Open all year", icon: "Hammer", tint: "--ux-tint-orange", ink: "--ux-orange", applied: false,
  },
  {
    id: "sc5", name: "Pradhan Mantri Suraksha Bima Yojana", body: "Government of India",
    who: "Anyone aged 18 to 70 with a bank account",
    gives: "Accident insurance for the whole family's peace of mind",
    amount: "₹2 lakh cover for ₹20 a year", category: "Insurance", eligible: true,
    reason: "You have a bank account and are within the age range.",
    needs: ["Aadhaar", "Bank passbook"],
    deadline: "Renews every 1 June", icon: "ShieldCheck", tint: "--ux-tint-pink", ink: "--ux-pink", applied: false,
  },
  {
    id: "sc6", name: "Rajasthan Mahila Nidhi", body: "Government of Rajasthan",
    who: "Women in a self-help group in Rajasthan",
    gives: "A quick group loan, decided in 48 hours",
    amount: "Up to ₹40,000", category: "Loan", eligible: true,
    reason: "You are in a savings circle in Jaipur.",
    needs: ["Aadhaar", "Circle membership proof"],
    deadline: "Open all year", icon: "Users", tint: "--ux-tint-green", ink: "--ux-green", applied: false,
  },
];

export const SCHEME_CATEGORIES = ["Loan", "Savings", "Training", "Grant", "Insurance"] as const;
export const SCHEME_ART = { empty: A("empty-open-notebook-pen"), hero: A("scene-woman-reading-document") };
