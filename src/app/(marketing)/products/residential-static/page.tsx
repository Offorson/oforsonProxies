import { ProductDetail } from "@/components/marketing/product-detail";

export const metadata = { title: "Static Residential Proxies" };

export default function Page() {
  return (
    <ProductDetail
      slug="residential-static"
      eyebrow="Static Residential"
      title="ISP-grade sticky residential IPs"
      subtitle="Sessions that stay yours perfect for verification flows and account-bound automation."
      features={[
        "Sticky, long-lived sessions",
        "ISP-level trust score",
        "Country & city targeting",
        "Large residential IP pool",
        "Per-IP billing",
        "Fast, stable throughput"
      ]}
    />
  );
}
