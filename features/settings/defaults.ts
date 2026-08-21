import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  themeShade: "charcoal",

  orientation: "white",
  pieceSet: "Default",
  boardTheme: "Default",
  moveMethod: "Default",
  showCoordinates: true,
  coordinatesPlacement: "inside",
  showEvalBar: false,
  showEvalScore: false,
  showLegalMoves: true,
  highlightLastMove: true,
  highlightCheck: true,
  showFigurineNotation: true,
  showMoveList: false,

  showEngineSuggestions: false,

  sound: {
    master: 100,
    pieceMove: 100,
    capture: 100,
    check: 100,
    aiVoice: 100,
  },

  notifications: {
    enabled: true,
    yourTurn: true,
    gameResult: true,
    coachingInsights: true,
    sound: true,
  },
};
