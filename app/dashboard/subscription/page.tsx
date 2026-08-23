import SubscriptionSection from "@/features/account/components/billing/SubscriptionSection";

export default function SubscriptionPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-text">Subscription</h1>
      <SubscriptionSection />
    </div>
  );
}
