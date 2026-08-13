// import type { BoardTheme } from "../types";

// export const BOARD_THEMES: Record<string, BoardTheme> = {
//   default: {
//     name: "Default",
//     lightSquare: "#EEEED2",
//     darkSquare: "#769656",
//     borderRadius: "4px",
//   },
//   blue: {
//     name: "Blue",
//     lightSquare: "#dbeafe",
//     darkSquare: "#3b82f6",
//     borderRadius: "4px",
//   },
//   red: {
//     name: "Red",
//     lightSquare: "#fee2e2",
//     darkSquare: "#dc2626",
//     borderRadius: "4px",
//   },
//   gray: {
//     name: "Gray",
//     lightSquare: "#e5e7eb",
//     darkSquare: "#6b7280",
//     borderRadius: "4px",
//   },
// };

// export const DEFAULT_THEME_NAME = "default";
import {
  defaultDarkSquareStyle,
  defaultLightSquareStyle,
} from "react-chessboard";

export const boardTheme = {
  darkSquareStyle: {
    ...defaultDarkSquareStyle,
    backgroundColor: "#769656",
  },
  lightSquareStyle: {
    ...defaultLightSquareStyle,
    backgroundColor: "#EEEED2",
  },
  boardStyle: {
    borderRadius: "4px",
  },
};
