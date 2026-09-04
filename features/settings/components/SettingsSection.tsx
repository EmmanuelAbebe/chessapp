import AppearanceSection from "./sections/AppearanceSection";
import BoardSection from "./sections/BoardSection";
import CoordinatesSection from "./sections/CoordinatesSection";
import EvaluationSection from "./sections/EvaluationSection";
import EngineSection from "./sections/EngineSection";
import AiCoachSection from "./sections/AiCoachSection";
import PlayerIdentitySection from "./sections/PlayerIdentitySection";
import SoundSection from "./sections/SoundSection";
import NotificationsSection from "./sections/NotificationsSection";
import AccountSection from "./sections/AccountSection";

export default function SettingsSection() {
  return (
    <section>
      <p className="text-sm text-text-faint">
        These are the full app settings — the gear icon on the board is a
        quick shortcut to the board-related ones below, and both stay in
        sync.
      </p>

      <div className="mt-4 flex flex-col gap-6">
        <AppearanceSection />
        <BoardSection />
        <CoordinatesSection />
        <EvaluationSection />
        <EngineSection />
        <AiCoachSection />
        <PlayerIdentitySection />
        <SoundSection />
        <NotificationsSection />
        <AccountSection />
      </div>
    </section>
  );
}
