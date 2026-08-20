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
      <h2 className="text-xl font-bold text-white">Choose a Plan</h2>

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
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  {planOption.name}
                </span>
                <span className="text-sm text-neutral-400">
                  {planOption.price}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5 text-xs text-neutral-500">
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
