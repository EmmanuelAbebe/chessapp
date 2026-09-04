"use client";

import { useState } from "react";
import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  useAiProviderConfig,
  type AiProvider,
} from "../../useAiProviderConfig";
import { FaRobot } from "react-icons/fa6";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  google: "Google (Gemini)",
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  groq: "Groq",
};

const LABEL_TO_PROVIDER = Object.fromEntries(
  Object.entries(PROVIDER_LABELS).map(([provider, label]) => [
    label,
    provider as AiProvider,
  ]),
);

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none";

export default function AiCoachSection() {
  const { config, setConfig } = useAiProviderConfig();
  const [showKey, setShowKey] = useState(false);

  function handleProviderChange(label: string) {
    const provider = LABEL_TO_PROVIDER[label];
    if (!provider) return;
    // Swapping providers with the old model name left behind would just
    // send a nonsense model id to the new one - reset to that provider's
    // own default; the field's still free text, so it's a starting point
    // to edit from, not a restriction.
    setConfig({
      ...config,
      provider,
      model: DEFAULT_MODEL_BY_PROVIDER[provider],
    });
  }

  return (
    <SettingsCard title="AI Coach">
      <SettingsItem
        item={{
          icon: <FaRobot />,
          title: "Provider",
          content: (
            <SettingsSelect
              setting={{
                label: "Provider",
                value: PROVIDER_LABELS[config.provider],
                options: Object.values(PROVIDER_LABELS),
                onChange: handleProviderChange,
              }}
            />
          ),
        }}
      />

      <div className="flex flex-col gap-1.5 py-3">
        <div className="flex items-center justify-between">
          <label
            htmlFor="ai-api-key"
            className="text-sm font-semibold text-text"
          >
            API key
          </label>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-xs font-medium text-text-dim hover:text-text"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="ai-api-key"
          type={showKey ? "text" : "password"}
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="Leave blank to use this app's own key, if it has one"
          autoComplete="off"
          className={INPUT_CLASS}
        />
        <p className="text-xs text-text-faint">
          Stored only in your browser - sent only to the provider you pick
          above, never anywhere else.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <label htmlFor="ai-model" className="text-sm font-semibold text-text">
          Model
        </label>
        <input
          id="ai-model"
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          placeholder={DEFAULT_MODEL_BY_PROVIDER[config.provider]}
          autoComplete="off"
          className={INPUT_CLASS}
        />
        <p className="text-xs text-text-faint">
          Free text, not a fixed list - check your provider's own docs for
          current model names.
        </p>
      </div>
    </SettingsCard>
  );
}
