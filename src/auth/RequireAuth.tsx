import { Navigate, useLocation } from "react-router-dom";
import { FullScreenLoader } from "../ui/Spinner";
import { useAuth } from "./useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading, hadSession } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader label="Carregando…" />;

  if (!token || !user) {
    // Só link de convite (/rooms/<código>) aberto por quem ainda não tinha sessão volta para a sala.
    // Depois de sair (ou de a sessão expirar), o próximo login sempre cai na página principal.
    const isInvite = location.pathname.startsWith("/rooms/");
    const from = !hadSession && isInvite ? `${location.pathname}${location.search}` : undefined;
    return <Navigate to="/login" replace state={from ? { from } : undefined} />;
  }

  return <>{children}</>;
}
