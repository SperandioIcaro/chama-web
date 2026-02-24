import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();

  if (isLoading) return <div className="p-6 text-zinc-300">Carregando…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
