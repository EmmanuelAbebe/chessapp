"use client";

import { useState } from "react";
import { FaCreditCard, FaDownload } from "react-icons/fa6";
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
    <section>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-text-faint">Plan</dt>
        <dd className="font-medium">{plan}</dd>

        <dt className="text-text-faint">Renewal date</dt>
        <dd className="font-medium">December 31, 2024</dd>

        <dt className="text-text-faint">Status</dt>
        <dd
          className={`font-medium ${
            subscriptionStatus === "Active"
              ? "text-good"
              : "text-text-faint"
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
              <span className="text-text-dim">
                Cancel your subscription?
              </span>
              <button
                onClick={() => {
                  setSubscriptionStatus("Canceled");
                  setIsCancelConfirming(false);
                }}
                className="font-medium text-bad hover:underline"
              >
                Yes, cancel
              </button>
              <button
                onClick={() => setIsCancelConfirming(false)}
                className="font-medium text-text-dim hover:underline"
              >
                Keep plan
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCancelConfirming(true)}
              className="text-sm font-medium text-bad hover:underline"
            >
              Cancel Subscription
            </button>
          )
        ) : (
          <button
            onClick={() => setSubscriptionStatus("Active")}
            className="text-sm font-medium text-accent hover:underline"
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
        <h3 className="text-sm font-semibold tracking-wide text-text-faint">
          Billing
        </h3>

        <div className="flex items-center gap-3 rounded-lg border border-border-soft p-3">
          <FaCreditCard
            aria-hidden="true"
            className="shrink-0 text-text-faint"
            size={20}
          />
          <div>
            <p className="text-sm font-medium">Visa •••• 4242</p>
            <p className="text-xs text-text-faint">Expires 08/2027</p>
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
                <p className="text-xs text-text-faint">{invoice.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-good">
                  {invoice.status}
                </span>
                <span className="font-medium">{invoice.amount}</span>
                <button
                  aria-label={`Download invoice from ${invoice.date}`}
                  className="text-text-faint hover:text-text"
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
