import type { ReactNode } from "react";
import { Logo } from "../ui/Logo";

/** Moldura das telas de login/cadastro: faixa de hexágonos + cartão (visual Heat). */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-ink-900 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div
        aria-hidden
        className="heat-pattern pointer-events-none absolute -right-[200px] top-0 hidden h-full w-[420px] lg:block"
      />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1200px] grid-cols-1 gap-10 px-5 py-8 lg:grid-cols-[1fr_453px] lg:gap-[120px]">
        <section className="flex flex-col justify-between gap-12">
          <Logo />

          <div className="max-w-lg">
            <h1 className="text-4xl font-black leading-[1.1] sm:text-5xl">
              Converse <span className="text-heat-gradient">olhando nos olhos</span>,
              <br />
              onde você estiver.
            </h1>
            <p className="mt-6 text-lg leading-7 text-fog-300">
              Salas privadas por convite para chamadas de vídeo, e uma sala geral aberta para
              todo mundo deixar sua mensagem.
            </p>
          </div>

          <p className="hidden text-sm text-fog-500 lg:block">Funciona no navegador, no computador e no celular.</p>
        </section>

        <section className="relative z-10 self-center bg-ink-850 p-6 sm:p-8">
          <h2 className="text-3xl font-bold leading-9">{title}</h2>
          <p className="mt-2 text-fog-300">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </div>
  );
}
