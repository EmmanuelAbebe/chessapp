# Product Notes

> Working notes on the coaching model and product shape. Moved out of `app/page.tsx`,
> where it was previously living as the literal homepage content.

## The key features

**Stockfish finds what was wrong. AI coach explains why it happened, what pattern it
reflects, and what to train next. Game history personalizes the teaching.**

That is a coherent product.

## Revised Product Model

Your system has three teaching inputs:

1. **Engine truth**
   - best moves
   - evaluation swings
   - tactical misses
   - positional inaccuracies
2. **User history**
   - repeated mistakes
   - weak phases
   - opening habits
   - time pressure patterns
   - improvement trends
3. **AI coaching layer**
   - explains mistakes in human terms
   - adapts language to level
   - builds lesson sequence
   - gives drills and follow-up positions

That combination is valuable because Stockfish alone is not a coach, and generic AI
alone is not reliable enough.

## The Main Design Principle

Do not build for "all levels" by making everything broad. Build for "all levels" by
making the coach adapt along three axes:

- **knowledge level** — beginner to advanced
- **instruction style** — direct, guided, Socratic, drill-based
- **mistake profile** — tactics blindness, positional misunderstanding, endgame
  technique, opening confusion, etc.

That is how one system can serve both beginners and strong players.

## Better Skill Architecture

The better structure is:

### 1. Player profile layer

Tracks: level estimate, strengths, weaknesses, preferred openings, recurring blunder
patterns, learning pace.

### 2. Training domain layer

Content buckets: opening fundamentals, middlegame tactics, strategic planning,
calculation, positional evaluation, endgame technique, practical decision-making.

### 3. Coaching mode layer

How the AI teaches: explain simply, hint only, ask guiding questions, compare
candidate moves, test understanding, assign practice.

## For Absolute Beginners

A beginner with no history should not start from game review. They need a
**bootstrap path**.

Beginner onboarding should include: a quick skill assessment, a few mini positions,
one or two sample games, maybe a short questionnaire (knows piece movement? knows
checkmate patterns? knows opening principles? has played online before?).

Then the AI creates an initial profile such as: understands rules but hangs pieces,
weak on king safety, no concept of development, low tactical awareness.

From there, the coach gives: very short lessons, one concept at a time, interactive
board examples, repetition-heavy exercises.

For beginners, the coach should prioritize: piece safety, checks/captures/threats,
development, king safety, basic mates, basic endgames, avoiding blunders. Not long
strategic lectures.

## For Intermediate Players

Likely the largest and best market. They usually: know principles, still blunder,
calculate inconsistently, mis-evaluate positions, struggle to convert advantages.

The coach for them should focus on: candidate move selection, tactical scanning
discipline, calculation habits, pawn structure understanding, planning from
imbalances, identifying critical moments.

This is where game-history personalization becomes especially valuable. Example: if a
player repeatedly loses equal positions after the opening, the AI should detect poor
middlegame planning — not just "you made a mistake on move 18."

## For Advanced Players

Advanced players do not want generic explanations. They need: precise language,
candidate move comparison, deeper strategic explanations, practical alternatives (not
only engine lines), self-review tools.

For them, the coach should act more like an analyst, sparring partner, or reflective
trainer. Useful advanced features:

- "What were the critical alternatives here?"
- "Was my plan wrong or just the execution?"
- "Where did evaluation shift structurally?"
- "Which recurring blind spots appear across my last 20 games?"

Advanced users benefit less from "best move is X" and more from: plan recognition,
decision quality, consistency across games.

## What Makes This Product Actually Good

Three things matter.

### 1. Memory across sessions

The coach must remember: common tactical oversights, recurring positional errors,
emotional or practical tendencies if detectable, opening repertoire patterns,
improvement areas already assigned. Without memory, it feels fake-personalized.

### 2. Mistake classification

Do not only label moves as blunder/inaccuracy. Classify why: missed tactical threat,
undeveloped pieces, ignored king safety, poor exchange decision, wrong pawn break,
horizon effect, inaccurate endgame technique, time-pressure collapse. This is what
turns analysis into coaching.

### 3. Next-step prescription

Every review should end with: one takeaway, one drill, one theme to watch next game.
Not ten lessons. One clear next step.

## The Biggest Product Risk

The AI coach can become too verbose, too generic, or too engine-dependent. That will
kill learning. You need strict response design.

The coach should always answer in this pattern: what happened → why it matters → what
the player missed → the principle behind it → one concrete improvement action.

Example:

> "You castled late." "That left your king exposed in a position with open central
> lines." "You focused on pawn grabbing instead of development." "In open positions,
> king safety and activity matter more than material." "In your next games, castle by
> move 10 unless there is a concrete reason not to."

That is teachable.

## Page Structure (current)

Two pages, each with internal structure:

### 1. Account / profile page

Should include: player profile summary, current estimated level, strengths and
weaknesses, recent progress, recommended training focus, saved openings, reviewed
games, training streak / activity. This page should feel like a coach dashboard, not
just account settings.

### 2. Analysis / coaching page

Should include: chess board, move list, evaluation bar, engine panel, AI coach panel,
lesson tab, training tab, game insights tab.

The AI chat should not just be freeform text. It should have structured actions like:
explain this move, what did I miss, give a hint, compare candidates, create drill from
this mistake, summarize game lessons. That reduces friction and improves quality.

## Lesson System

Keep the opening / middlegame / endgame split, but do not make it the only structure.
Use a hybrid system:

- **By phase** — opening, middlegame, endgame
- **By skill type** — tactics, calculation, planning, positional play, endgame
  technique, practical play
- **By level** — beginner, intermediate, advanced
- **By personal weakness** — hanging pieces, passive play, weak king safety, poor
  conversion, endgame inaccuracy, opening drift

## Product Loop

**Assess → Teach → Review → Diagnose → Drill → Reassess**

Example: user uploads game → Stockfish finds critical mistakes → AI identifies themes
→ system updates weakness model → coach gives focused explanation → system generates
custom exercises → future games test improvement.

## What to Build First

Do not start by building everything. Build the smallest version that proves the core
value.

**MVP should have:** game import / play interface, Stockfish analysis, AI explanations
for critical moves, basic user profile memory, weakness tagging, lesson
recommendations based on mistakes.

**Next layer:** adaptive drills from user mistakes, beginner assessment flow, progress
dashboard, coaching modes.

**Later:** repertoire guidance, spaced repetition for recurring mistakes, advanced
self-analysis tools, voice coaching or live coaching.

## Product Positioning

**A chess coach that studies your games, finds recurring thinking errors, and teaches
exactly what you need next.**

That is much better than: "AI chess chat," "analysis board with lessons," or "chess
tutor app."

## Final Correction to the Concept

The goal is not to "teach any level." The goal is to build a system that: diagnoses
current skill, teaches at the right abstraction level, adapts over time as the player
improves.

The main thing needed now is a tighter internal model for: user profile, mistake
taxonomy, coaching response format, progression logic. Without that, personalization
stays superficial.
