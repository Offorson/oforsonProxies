import { Hero } from "@/components/marketing/hero";
// import { TrustedBy } from "@/components/marketing/trusted-by"; // hidden — placeholder logos, restore when real customers exist
import { Products } from "@/components/marketing/products";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Features } from "@/components/marketing/features";
import { UseCases } from "@/components/marketing/use-cases";
import { Pricing } from "@/components/marketing/pricing";
// import { Testimonials } from "@/components/marketing/testimonials"; // hidden — placeholder reviews, restore when real testimonials exist
import { FAQ } from "@/components/marketing/faq";
import { CTA } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* <TrustedBy /> */}
      <Products />
      <DashboardPreview />
      <Features />
      <UseCases />
      <Pricing />
      {/* <Testimonials /> */}
      <FAQ />
      <CTA />
    </>
  );
}
