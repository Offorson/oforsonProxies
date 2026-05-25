import { ProductDetail } from "@/components/marketing/product-detail";

export const metadata = { title: "Rotating Residential Proxies" };

export default function Page() {
  return (
    <ProductDetail
      slug="residential-rotating"
      eyebrow="Rotating Residential"
      title="Massive rotating residential pool"
      subtitle="Engineered for high-throughput scraping with anti-detection optimized rotation."
      features={[
        "Large rotating residential pool",
        "Global country coverage",
        "Sub-second rotation",
        "Session pinning supported",
        "Per-GB billing",
        "Scraping & automation ready"
      ]}
    />
  );
}
