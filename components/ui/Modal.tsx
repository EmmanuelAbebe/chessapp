import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Matches the panel's transform transition (the slower of its two
// properties), so unmount waits for the full close animation instead of
// cutting the scale short.
const CLOSE_DURATION_MS = 350;

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Mount in the closed visual state first, then flip to open on the
      // next frame so the transition has a "from" state to animate out of.
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), CLOSE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg ${
          isVisible ? "scale-100 opacity-100" : "scale-[0.85] opacity-0"
        }`}
        style={{
          transition:
            "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
