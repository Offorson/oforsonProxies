import { ProductDetail } from "@/components/marketing/product-detail";

export const metadata = { title: "Datacenter Proxies" };

export default function Page() {
  return (
    <ProductDetail
      slug="datacenter"
      eyebrow="Datacenter"
      title="Dedicated, ultra-fast datacenter IPs"
      subtitle="The most affordable way to scale. High throughput, high concurrency, and dedicated IPs."
      features={[
        "Dedicated IP addresses",
        "Low-latency connections",
        "High-throughput performance",
        "High concurrency support",
        "Global country coverage",
        "Pay-per-IP pricing"
      ]}
    />
  );
}
