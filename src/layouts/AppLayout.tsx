import { LogOut, MessagesSquare, Video } from "lucide-react";
import { NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { InviteModal } from "../components/InviteModal";
import { JoinRequestModal } from "../components/JoinRequestModal";
import { WS_URL } from "../config";
import { useSocket } from "../realtime/useSocket";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";

const links = [
  { to: "/", label: "Sala geral", icon: MessagesSquare, end: true },
  { to: "/rooms", label: "Salas privadas", icon: Video, end: false },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { status } = useSocket();
  const navigate = useNavigate();
  // dentro de uma sala o espaço é do vídeo: sem barra inferior
  const inRoom = useMatch("/rooms/:code") !== null;

  return (
    <div className="flex h-dvh flex-col bg-ink-900">
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 w-full max-w-[1200px] items-center justify-between gap-4 px-5">
          <NavLink to="/" aria-label="Chama — início">
            <Logo />
          </NavLink>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "border-b-2 py-1 text-sm font-bold uppercase tracking-wide transition",
                    isActive
                      ? "border-heat-pink text-fog-100"
                      : "border-transparent text-fog-500 hover:text-fog-100",
                  ].join(" ")
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span
              role="status"
              title={status === "online" ? "Conectado" : "Reconectando…"}
              className={`h-2.5 w-2.5 rounded-full ${
                status === "online" ? "bg-heat-green" : "animate-pulse bg-heat-orange"
              }`}
            />
            {user && <Avatar src={user.avatar_url} name={user.name} size={30} />}
            <span className="hidden max-w-40 truncate text-sm text-fog-300 sm:block">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate("/login", { replace: true });
              }}
              title="Sair"
              aria-label="Sair"
              className="p-2 text-fog-300 transition hover:text-fog-100"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {status === "offline" && (
        <div role="alert" className="bg-heat-orange px-4 py-1.5 text-center text-xs font-bold text-ink-950">
          Reconectando ao servidor… <span className="font-normal opacity-80">({WS_URL})</span>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {/* navegação inferior no celular */}
      <nav
        aria-label="Principal"
        className={`${inRoom ? "hidden" : "grid"} shrink-0 grid-cols-2 border-t border-ink-700 bg-ink-850 pb-[env(safe-area-inset-bottom)] md:hidden`}
      >
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold uppercase tracking-wide",
                isActive ? "text-heat-yellow" : "text-fog-500",
              ].join(" ")
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <InviteModal />
      <JoinRequestModal />
    </div>
  );
}
