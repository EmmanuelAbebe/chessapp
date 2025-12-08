import { useEffect, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

interface Move {
  moveNumber: number;
  white?: string;
  black?: string;
}

interface MoveListProp {
  notationList: Move[];
}

const MoveList = ({ notationList }: MoveListProp) => {
  const [index, setIndex] = useState(0);

  const maxIndex = Math.max(0, notationList.length - 1);

  const prev = () => {
    setIndex((i) => Math.max(0, i - 1));
  };

  const next = () => {
    setIndex((i) => Math.min(maxIndex, i + 1));
  };

  // Jump to latest move whenever the list grows
  useEffect(() => {
    if (notationList.length === 0) return;
    setIndex(notationList.length - 1);
  }, [notationList.length]);

  const current = notationList[index];

  return (
    <div className="flex w-full items-center gap-3 h-12 sm:h-14 text-xs sm:text-sm font-mono">
      {notationList.length === 0 ? (
        <div className="text-neutral-500 flex-1 min-w-0">
          Waiting for you to start
        </div>
      ) : (
        <div className="flex-1 flex flex-row min-w-0 items-center">
          <button
            onClick={prev}
            disabled={index === 0}
            className="p-2 m-1 cursor-pointer hover:bg-gray-400 rounded disabled:opacity-40 disabled:cursor-default"
          >
            <FaArrowLeft />
          </button>

          {current && (
            <div className="flex flex-row gap-3 w-full justify-center items-center">
              <span>{current.moveNumber}.</span>
              <span className="max-w-20 bg-white text-black rounded p-1">
                {current.white ?? ""}
              </span>
              <span className="max-w-20 bg-black text-white rounded p-1">
                {current.black ?? ""}
              </span>
            </div>
          )}

          <button
            onClick={next}
            disabled={index === maxIndex}
            className="p-2 m-1 cursor-pointer hover:bg-gray-400 rounded disabled:opacity-40 disabled:cursor-default"
          >
            <FaArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default MoveList;
