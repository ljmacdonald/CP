import { InvestmentDetailClient } from "@/components/investment/InvestmentDetailClient";

export default async function InvestmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvestmentDetailClient id={id} />;
}
