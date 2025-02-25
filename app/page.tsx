"use client";
import MazeRunner from "@/components/maze-runner";
import useWebSocket from "react-use-websocket";

export default function Home() {
   

  return (
    <main className="min-h-screen">
      <MazeRunner />
    </main>
  )
}
