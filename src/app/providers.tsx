import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "../auth/AuthProvider";
import { SocketProvider } from "../realtime/SocketProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>{children}</SocketProvider>
      </AuthProvider>
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
