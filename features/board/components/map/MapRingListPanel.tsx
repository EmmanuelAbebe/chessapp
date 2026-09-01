"use client";

import {
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { IoClose } from "react-icons/io5";
import { HUB_COLOR, isHub, nodeLabel } from "../../lib/map/move-tree-map-helpers";
import type { MoveNode } from "../../types";

// Every move explored at a clicked-on depth ring. Rendered twice by
// MoveTreeMap (see `variant`): floating in the top-right stack on desktop,
// or as a full-width block below the map on mobile, where there's no spare
// corner to float it in. Height is owned here (not lifted to MoveTreeMap)
// since nothing outside this panel ever needs to know it.
export function MapRingListPanel({
  variant,
  selectedRingPly,
  nodesOnSelectedRing,
  onClose,
  goToNode,
  setHoveredId,
  hoverStartRef,
  pinnedId,
}: {
  variant: "floating" | "inline";
  selectedRingPly: number | null;
  nodesOnSelectedRing: MoveNode[];
  onClose: () => void;
  goToNode: (nodeId: string) => void;
  setHoveredId: Dispatch<SetStateAction<string | null>>;
  hoverStartRef: MutableRefObject<number>;
  pinnedId: string | null;
}) {
  // Roughly 5 rows by default (32px row + 4px gap each) - draggable from a
  // handle at the bottom of the list itself, since a heavily-explored ply
  // could have far more moves than fit comfortably at once.
  const [ringListHeight, setRingListHeight] = useState(176);

  // Plain window listeners for the duration of one drag rather than a
  // persistent effect - simpler than tracking "is dragging" as state just
  // to conditionally attach/detach these.
  function startRingListResize(e: ReactPointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = ringListHeight;
    function onMove(moveEvent: PointerEvent) {
      const next = Math.min(480, Math.max(64, startHeight + (moveEvent.clientY - startY)));
      setRingListHeight(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (selectedRingPly === null || nodesOnSelectedRing.length === 0) return null;

  return (
    <div
      className={
        variant === "floating"
          ? "hidden w-40 flex-col rounded-[14px] border border-accent-soft p-3 sm:flex"
          : "w-full shrink-0 border-t border-accent bg-surface p-3 sm:hidden"
      }
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-accent">
          Move {nodesOnSelectedRing[0].moveNumber}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-text-faint transition hover:text-text"
        >
          <IoClose />
        </button>
      </div>
      <p className="mb-2 font-mono text-xs text-text-faint">
        ply {selectedRingPly} · {nodesOnSelectedRing.length} move
        {nodesOnSelectedRing.length === 1 ? "" : "s"}
      </p>

      {/* Capped to roughly 5 rows by default and scrollable beyond that - a
          heavily-explored ply could otherwise grow this panel past the
          whole screen. Draggable from the handle below since "5" won't be
          the right amount for everyone. */}
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ height: ringListHeight }}>
        {nodesOnSelectedRing.map((node, index) => (
          <button
            key={node.id}
            type="button"
            onClick={() => goToNode(node.id)}
            onMouseEnter={() => {
              setHoveredId(node.id);
              hoverStartRef.current = performance.now();
            }}
            onMouseLeave={() => setHoveredId((current) => (pinnedId ? current : null))}
            className="shrink-0 px-2 py-1.5 text-left text-sm text-text-dim transition hover:font-bold hover:text-text flex flex-row items-center gap-2 rounded-[10px] border border-border-soft"
            style={isHub(node) ? { color: HUB_COLOR } : undefined}
          >
            <p className="font-bold font-mono">{index + 1}.</p>
            <p className="text-text-dim">{nodeLabel(node)}</p>
          </button>
        ))}
      </div>

      <div
        onPointerDown={startRingListResize}
        aria-hidden="true"
        className="-mb-1 flex h-3 shrink-0 cursor-ns-resize touch-none items-center justify-center"
      >
        <div className="h-1 w-8 rounded-full bg-border" />
      </div>
    </div>
  );
}
