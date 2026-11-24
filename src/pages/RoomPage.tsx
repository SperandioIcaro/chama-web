import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/error";
import { getAccess, joinRoom, type Room } from "../api/rooms";
import { GENERAL_ROOM_CODE } from "../config";
import { Button } from "../ui/Button";
import { FullScreenLoader, Spinner } from "../ui/Spinner";
import { RoomView } from "./RoomView";

export default function RoomPage() {
  const { code = "" } = useParams();
  if (code === GENERAL_ROOM_CODE) return <Navigate to="/" replace />;
  return <PrivateRoom key={code} code={code} />;
}

function PrivateRoom({ code }: { code: string }) {
  const navigate = useNavigate();

  // Entrar pelo código é o "convite": a API registra você como participante (idempotente).
  const access = useQuery({
    queryKey: ["room-access", code],
    queryFn: () => joinRoom(code),
    retry: false,
    gcTime: 0,
  });

  if (access.isPending) return <FullScreenLoader label="Entrando na sala…" />;

  if (access.isError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div role="alert" className="w-full max-w-md bg-ink-850 p-6 text-center">
          <h1 className="text-xl font-bold">Não consegui abrir a sala</h1>
          <p className="mt-2 text-fog-300">{getErrorMessage(access.error)}</p>
          <Button className="mt-6 w-full" onClick={() => navigate("/rooms")}>
            Ver minhas salas
          </Button>
        </div>
      </div>
    );
  }

  // Entrou por link/código: o admin precisa permitir.
  if (access.data.status !== "approved") {
    return (
      <WaitingForApproval
        room={access.data.room}
        onApproved={() => void access.refetch()}
        onRetry={() => void access.refetch()}
      />
    );
  }

  return <RoomView room={access.data.room} />;
}

function WaitingForApproval({
  room,
  onApproved,
  onRetry,
}: {
  room: Room;
  onApproved: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();

  // Só consulta a situação (não reenvia o pedido ao admin a cada checagem).
  const poll = useQuery({
    queryKey: ["room-wait", room.code],
    queryFn: () => getAccess(room.code),
    refetchInterval: 3000,
    gcTime: 0,
  });
  const status = poll.data;

  useEffect(() => {
    if (status === "approved" || status === "invited") onApproved();
  }, [status, onApproved]);

  const denied = status === "denied";

  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-md bg-ink-850 p-8 text-center" role="status">
        {denied ? (
          <>
            <h1 className="text-xl font-bold">O admin não liberou sua entrada</h1>
            <p className="mt-2 text-fog-300">
              Você pode pedir de novo ou voltar para as suas salas.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => navigate("/rooms")}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onRetry();
                  void poll.refetch();
                }}
              >
                Pedir de novo
              </Button>
            </div>
          </>
        ) : (
          <>
            <Spinner className="mx-auto h-8 w-8 text-heat-yellow" />
            <h1 className="mt-4 text-xl font-bold">Aguardando liberação</h1>
            <p className="mt-2 text-fog-300">
              O admin de <strong>{room.name}</strong> foi avisado. Assim que ele permitir, você entra
              automaticamente.
            </p>
            <Button className="mt-6 w-full" variant="ghost" onClick={() => navigate("/rooms")}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
