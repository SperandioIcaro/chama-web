import { Navigate, createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { AppLayout } from "../layouts/AppLayout";
import { GeneralRoom } from "../pages/GeneralRoom";
import { GithubCallback } from "../pages/GithubCallback";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import RoomPage from "../pages/RoomPage";
import RoomsPage from "../pages/RoomsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/auth/github/callback", element: <GithubCallback /> },

  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <GeneralRoom /> },
      { path: "rooms", element: <RoomsPage /> },
      { path: "rooms/:code", element: <RoomPage /> },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
