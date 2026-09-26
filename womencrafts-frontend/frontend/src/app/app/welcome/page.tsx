import ProductTour from "@/components/onboarding/ProductTour";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const value = (await searchParams).step;
  const initialStep = Number(Array.isArray(value) ? value[0] : value);
  return <ProductTour mode="member" initialStep={initialStep} />;
}
