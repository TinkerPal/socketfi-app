import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useStates } from "../context/StatesContext";

export default function ProtectedRoute() {
  const { activeSession } = useStates();
  const location = useLocation();

  if (!activeSession) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    );
  }

  return <Outlet />;
}
