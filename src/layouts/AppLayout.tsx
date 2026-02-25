import { Link, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b p-4 flex items-center justify-between">
        <Link to="/" className="font-semibold">
          Chama
        </Link>

        <nav className="flex gap-3 text-sm">
          <Link className="hover:underline underline-offset-4" to="/rooms">
            Salas
          </Link>
        </nav>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
