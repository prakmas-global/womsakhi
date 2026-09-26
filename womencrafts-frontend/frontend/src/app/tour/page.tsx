import ProductTour from "@/components/onboarding/ProductTour";
import "@/app/ux/tokens.css";
import "@/app/ux/mobile.css";

export const metadata = {
  title: "How WomSakhi works",
  description: "Explore learning, work, money, wellbeing and community in WomSakhi.",
};

export default function TourPage() {
  return <div className="ux min-h-screen"><ProductTour mode="public" /></div>;
}
