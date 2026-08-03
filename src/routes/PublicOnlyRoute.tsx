import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useStates } from "../context/StatesContext";

interface LoginLocationState {
  from?: string;
}

export default function PublicOnlyRoute() {
  const { activeSession } = useStates();
  const location = useLocation();

  if (activeSession) {
    const state =
      location.state as LoginLocationState | null;

    return (
      <Navigate
        to={state?.from || "/"}
        replace
      />
    );
  }

  return <Outlet />;
}
