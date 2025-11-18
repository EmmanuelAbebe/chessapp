import Image from "next/image";
import ChessBoardUI from "./Board/Chessboard";

export default function Home() {
  return (
    <main className="p-6 w-full py-32">
      <ChessBoardUI />
    </main>
  );
}
