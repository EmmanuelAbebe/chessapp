import type {} from "react/canary";
import { ViewTransition } from "react";
import Link from "next/link";
import {
  ABOUT,
  CAPABILITIES,
  FAQ,
  FEATURES,
  FINAL_CTA,
  FOOTER,
  HERO,
  POSITIONING,
  STEPS,
  VISION,
} from "./content";
import {
  BoardGlyph,
  CoachCardGlyph,
  EvalBarGlyph,
  MapGlyph,
  TraitBarsGlyph,
} from "./visuals";

const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-text transition hover:border-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
      {children}
    </span>
  );
}

function Section({
  children,
  raised = false,
  labelledBy,
  className = "",
}: {
  children: React.ReactNode;
  raised?: boolean;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`${raised ? "bg-surface" : "bg-background"} border-b border-border-soft ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        {children}
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className="flex w-full flex-col">
        {/* ---------- Hero ---------- */}
        <section className="border-b border-border-soft bg-background">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-28 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col items-start gap-5">
              <Eyebrow>{HERO.eyebrow}</Eyebrow>
              <h1 className="text-4xl font-bold tracking-tight text-balance text-text sm:text-5xl">
                {HERO.title}
              </h1>
              <p className="max-w-xl text-lg text-text-dim">{HERO.subtitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link href={HERO.primaryCta.href} className={primaryBtn}>
                  {HERO.primaryCta.label}
                </Link>
                <Link href={HERO.secondaryCta.href} className={secondaryBtn}>
                  {HERO.secondaryCta.label}
                </Link>
              </div>
              <p className="text-xs text-text-faint">{HERO.note}</p>
            </div>

            {/* Product-voice mockup */}
            <div className="flex w-full max-w-md flex-col gap-3 justify-self-center lg:justify-self-end">
              <CoachCardGlyph
                tone="bad"
                evalLabel="−1.8"
                quote="You castled on move 14 — the open e-file left your king exposed while you were still grabbing a pawn. In open positions, castle by move 10 unless there's a concrete reason not to."
              />
              <div className="flex gap-2">
                <EvalBarGlyph whitePercent={38} />
                <BoardGlyph />
              </div>
            </div>
          </div>

          {/* Capability strip */}
          <div className="border-t border-border-soft">
            <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-xs text-text-faint sm:px-6">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-accent">
                    ◆
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Positioning ---------- */}
        <Section raised labelledBy="positioning-title">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>{POSITIONING.eyebrow}</Eyebrow>
              <h2
                id="positioning-title"
                className="text-2xl font-bold tracking-tight text-balance text-text sm:text-3xl"
              >
                {POSITIONING.title}
              </h2>
            </div>
            <div className="flex flex-col gap-4 text-text-dim">
              {POSITIONING.body.map((p) => (
                <p key={p} className="leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </Section>

        {/* ---------- How it works ---------- */}
        <Section labelledBy="how-title">
          <div className="flex flex-col gap-3">
            <Eyebrow>How it works</Eyebrow>
            <h2
              id="how-title"
              className="text-2xl font-bold tracking-tight text-text sm:text-3xl"
            >
              From a played game to the one thing to fix
            </h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.step}
                className="flex flex-col gap-3 rounded-xl border border-border-soft bg-surface p-6"
              >
                <span className="font-mono text-sm text-accent">{s.step}</span>
                <h3 className="text-lg font-semibold text-text">{s.title}</h3>
                <p className="text-sm leading-relaxed text-text-dim">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------- Feature deep-dives ---------- */}
        <Section raised labelledBy="features-title">
          <div className="flex flex-col gap-3">
            <Eyebrow>What you get</Eyebrow>
            <h2
              id="features-title"
              className="text-2xl font-bold tracking-tight text-text sm:text-3xl"
            >
              A workspace, not a chatbot
            </h2>
          </div>

          <div className="mt-12 flex flex-col gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`grid items-center gap-8 rounded-2xl border border-border-soft bg-background p-6 sm:p-8 md:grid-cols-2 ${
                  i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-text">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-text-dim">
                    {f.body}
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <FeatureVisual index={i} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- Vision ---------- */}
        <Section labelledBy="vision-title">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <span className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
              {VISION.eyebrow}
            </span>
            <h2
              id="vision-title"
              className="text-2xl font-bold tracking-tight text-balance text-text sm:text-3xl"
            >
              {VISION.title}
            </h2>
            <p className="text-text-dim">{VISION.body}</p>
          </div>
        </Section>

        {/* ---------- About ---------- */}
        <Section raised labelledBy="about-title">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>{ABOUT.eyebrow}</Eyebrow>
              <h2
                id="about-title"
                className="text-2xl font-bold tracking-tight text-balance text-text sm:text-3xl"
              >
                {ABOUT.title}
              </h2>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 text-text-dim">
                {ABOUT.body.map((p) => (
                  <p key={p} className="leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-border-soft bg-background p-5">
                <span className="text-xs font-semibold tracking-wide text-text-faint uppercase">
                  Who it's for
                </span>
                <ul className="flex flex-col gap-1.5 text-sm text-text-dim">
                  {ABOUT.audience.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span aria-hidden="true" className="text-accent">
                        —
                      </span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- FAQ ---------- */}
        <Section labelledBy="faq-title">
          <div className="flex flex-col gap-3">
            <Eyebrow>FAQ</Eyebrow>
            <h2
              id="faq-title"
              className="text-2xl font-bold tracking-tight text-text sm:text-3xl"
            >
              Questions
            </h2>
          </div>
          <div className="mt-10 flex flex-col divide-y divide-border-soft border-y border-border-soft">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-text marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-text-faint transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Section>

        {/* ---------- Final CTA ---------- */}
        <section className="bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-24">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-balance text-text sm:text-3xl">
              {FINAL_CTA.title}
            </h2>
            <Link href={FINAL_CTA.cta.href} className={primaryBtn}>
              {FINAL_CTA.cta.label}
            </Link>
          </div>
        </section>

        {/* ---------- Footer ---------- */}
        <footer className="border-t border-border-soft bg-background">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[1.4fr_1fr] sm:px-6">
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2 text-base font-bold text-text">
                <span aria-hidden="true" className="text-accent">
                  ♞
                </span>
                CoachMeChess
              </span>
              <p className="max-w-sm text-sm text-text-dim">{FOOTER.tagline}</p>
            </div>
            <div className="flex gap-12">
              {FOOTER.columns.map((col) => (
                <div key={col.heading} className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-text-faint uppercase">
                    {col.heading}
                  </span>
                  {col.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="text-sm text-text-dim transition hover:text-text"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border-soft">
            <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-text-faint sm:px-6">
              {FOOTER.disclaimer}
            </p>
          </div>
        </footer>
      </div>
    </ViewTransition>
  );
}

/** The right-hand illustration for each feature deep-dive row. */
function FeatureVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="w-full max-w-xs">
        <CoachCardGlyph
          tone="good"
          evalLabel="+0.3"
          quote="Solid — you finished development before opening the center. Nothing to fix here."
        />
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="flex w-full max-w-[200px] gap-2">
        <EvalBarGlyph whitePercent={55} />
        <BoardGlyph />
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="w-full max-w-[220px] rounded-xl border border-border-soft bg-background p-4">
        <MapGlyph />
      </div>
    );
  }
  return (
    <div className="w-full max-w-xs rounded-xl border border-border-soft bg-background p-5">
      <TraitBarsGlyph />
    </div>
  );
}
