import type { CoordinatesPlacement, Orientation } from "../board/types";
import type { VolumeLevel } from "@/components/ui/settings/SettingsVolume";

export type ThemeShade = "midnight" | "charcoal" | "slate";

export type SoundSettings = {
  master: VolumeLevel;
  pieceMove: VolumeLevel;
  capture: VolumeLevel;
  check: VolumeLevel;
  aiVoice: VolumeLevel;
};

export type NotificationSettings = {
  enabled: boolean;
  yourTurn: boolean;
  gameResult: boolean;
  coachingInsights: boolean;
  sound: boolean;
};

export type AppSettings = {
  // appearance
  themeShade: ThemeShade;

  // board
  orientation: Orientation;
  pieceSet: string;
  boardTheme: string;
  moveMethod: string;
  showCoordinates: boolean;
  coordinatesPlacement: CoordinatesPlacement;
  showEvalBar: boolean;
  showEvalScore: boolean;
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  highlightCheck: boolean;

  // sound
  sound: SoundSettings;

  // notifications
  notifications: NotificationSettings;
};
