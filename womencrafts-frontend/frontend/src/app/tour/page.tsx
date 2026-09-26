import ProductTour from "@/components/onboarding/ProductTour";
import "@/app/ux/tokens.css";
import "@/app/ux/mobile.css";

export const metadata = {
  title: "How WomSakhi works",
  description: "Explore learning, work, money, wellbeing and community in WomSakhi.",
};

export default async function TourPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const value = (await searchParams).step;
  const initialStep = Number(Array.isArray(value) ? value[0] : value);
  return <div className="ux min-h-screen"><ProductTour mode="public" initialStep={initialStep} /></div>;
}
