"use client";

import { useState } from "react";
import { FaCreditCard, FaDownload } from "react-icons/fa6";
import SectionTitle from "@/components/ui/SectionTitle";
import { primaryButtonClass } from "@/features/account/lib/styles";
import { INVOICES } from "../../data";
import UpgradePlanModal from "./UpgradePlanModal";

export default function SubscriptionSection() {
  const [plan, setPlan] = useState("Premium");
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "Active" | "Canceled"
  >("Active");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isCancelConfirming, setIsCancelConfirming] = useState(false);

  return (
    <section aria-labelledby="subscription-heading">
      <SectionTitle id="subscription-heading">Subscription</SectionTitle>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-neutral-500">Plan</dt>
        <dd className="font-medium">{plan}</dd>

        <dt className="text-neutral-500">Renewal date</dt>
        <dd className="font-medium">December 31, 2024</dd>

        <dt className="text-neutral-500">Status</dt>
        <dd
          className={`font-medium ${
            subscriptionStatus === "Active"
              ? "text-green-400"
              : "text-neutral-500"
          }`}
        >
          {subscriptionStatus}
        </dd>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={() => setIsUpgradeOpen(true)}
          className={primaryButtonClass}
        >
          {plan === "Free" ? "Upgrade Plan" : "Change Plan"}
        </button>

        {subscriptionStatus === "Active" ? (
          isCancelConfirming ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-neutral-400">
                Cancel your subscription?
              </span>
              <button
                onClick={() => {
                  setSubscriptionStatus("Canceled");
                  setIsCancelConfirming(false);
                }}
                className="font-medium text-red-400 hover:underline"
              >
                Yes, cancel
              </button>
              <button
                onClick={() => setIsCancelConfirming(false)}
                className="font-medium text-neutral-400 hover:underline"
              >
                Keep plan
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCancelConfirming(true)}
              className="text-sm font-medium text-red-400 hover:underline"
            >
              Cancel Subscription
            </button>
          )
        ) : (
          <button
            onClick={() => setSubscriptionStatus("Active")}
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            Reactivate Subscription
          </button>
        )}
      </div>

      {isUpgradeOpen && (
        <UpgradePlanModal
          currentPlan={plan}
          onClose={() => setIsUpgradeOpen(false)}
          onSelect={(next) => {
            setPlan(next);
            setIsUpgradeOpen(false);
          }}
        />
      )}

      <div className="mt-8 flex flex-col gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-500">
          Billing
        </h3>

        <div className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3">
          <FaCreditCard
            aria-hidden="true"
            className="shrink-0 text-neutral-500"
            size={20}
          />
          <div>
            <p className="text-sm font-medium">Visa •••• 4242</p>
            <p className="text-xs text-neutral-500">Expires 08/2027</p>
          </div>
        </div>

        <div className="flex flex-col">
          {INVOICES.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{plan} Plan</p>
                <p className="text-xs text-neutral-500">{invoice.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-green-400">
                  {invoice.status}
                </span>
                <span className="font-medium">{invoice.amount}</span>
                <button
                  aria-label={`Download invoice from ${invoice.date}`}
                  className="text-neutral-500 hover:text-white"
                >
                  <FaDownload size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
