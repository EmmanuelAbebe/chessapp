"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/account/lib/styles";
import { PLANS } from "../../data";

export default function UpgradePlanModal({
  currentPlan,
  onClose,
  onSelect,
}: {
  currentPlan: string;
  onClose: () => void;
  onSelect: (plan: string) => void;
}) {
  const [selected, setSelected] = useState(currentPlan);

  return (
    <Modal isOpen onClose={onClose}>
      <h2 className="text-xl font-bold text-text">Choose a Plan</h2>

      <div className="mt-6 flex flex-col gap-3">
        {PLANS.map((planOption) => {
          const isSelected = selected === planOption.name;

          return (
            <button
              key={planOption.name}
              type="button"
              onClick={() => setSelected(planOption.name)}
              className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text">
                  {planOption.name}
                </span>
                <span className="text-sm text-text-dim">
                  {planOption.price}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5 text-xs text-text-faint">
                {planOption.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          onClick={() => onSelect(selected)}
          className={primaryButtonClass}
        >
          Confirm Plan
        </button>
      </div>
    </Modal>
  );
}
