import { useContext } from "react";
import { SocketContext } from "./SocketContext";

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket precisa estar dentro de <SocketProvider>");
  return ctx;
}
