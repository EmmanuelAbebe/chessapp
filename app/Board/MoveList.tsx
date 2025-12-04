import {
  FaArrowAltCircleLeft,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa";

interface MoveListProp {
  notationList: { moveNumber: number; white?: string; black?: string }[];
}

{
  /* GAME HEADER: horizontal single-row move list */
}
const MoveList = ({ notationList }: MoveListProp) => {
  return (
    <div className="flex w-full items-center gap-3 h-12 sm:h-14 text-xs sm:text-sm font-mono">
      {notationList.length === 0 ? (
        <div className="text-neutral-500 flex-1 min-w-0">
          Wating for you to start
        </div>
      ) : (
        <div className="flex-1 flex flex-row min-w-0">
          <button className="p-2 m-1 cursor-pointer hover:bg-gray-400 rounded">
            <FaArrowLeft />
          </button>
          <ol className="flex flex-row flex-nowrap gap-3 w-full whitespace-nowrap overflow-x-auto custom-scrollbar pr-2 m-1 justify-start">
            {" "}
            {/* how to stick to the end when move is made */}
            {notationList.map((row) => (
              <li
                key={row.moveNumber}
                className="flex items-center gap-1 shrink-0"
              >
                <span className="">{row.moveNumber}.</span>
                <span className="max-w-20 bg-white text-black rounded p-1">
                  {row.white ?? ""}
                </span>
                <span className="max-w-20 bg-black text-white rounded p-1">
                  {row.black ?? ""}
                </span>
              </li>
            ))}
          </ol>
          <button className="p-2 m-1 cursor-pointer hover:bg-gray-400 rounded">
            <FaArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default MoveList;
