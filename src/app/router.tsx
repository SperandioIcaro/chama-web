import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { AppLayout } from "../layouts/AppLayout";
import { Home } from "../pages/Home";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";

import RoomLobbyPage from "../pages/RoomLobbyPage";
import RoomsPage from "../pages/RoomsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },

  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "rooms", element: <RoomsPage /> },
      { path: "rooms/:code", element: <RoomLobbyPage /> },
    ],
  },
]);
