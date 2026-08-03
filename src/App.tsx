// @ts-nocheck
import { Toaster } from "sonner";
import { Route, Routes, BrowserRouter as Router } from "react-router-dom";
import NotFound from "./not-found/NotFound";
import Layout from "./layout-screens/Layout";
import { StatesProvider } from "./context/StatesContext";
import WalletAccessLanding from "./pages/socketfi-wallet-access/WalletAccessLanding";
import DappsDashboard from "./pages/dapps-hub/DappsDashboard";
import DappInteractionDisplay from "./pages/dapp-interaction-files/DappInteractionDisplay";
import WalletDashboard from "./pages/socketfi-wallet/WalletDashboard";
import Settings from "./pages/account-settings/Settings";
import SignUp from "./pages/login-files/Signup";
import SocialIntentTransaction from "./pages/social-intent/SocialIntentTransaction";
import { SocketFiProvider } from "@socketfi/react";

import ConnectProfiles from "./pages/connections/ConnectProfiles";
import PublicDepositPage from "./pages/socketfi-wallet/PublicDepositPage";

import EvmProvider from "./evm/EvmProvider";
import CctpExplorerPage from "./pages/CctpExplorerPage";
import { SOCKETFI_NETWORK } from "./config/tenant.config";
import SessionsPage from "./pages/sessions/SessionsPage";
import AutomationsPage from "./pages/strategies/AutomationsPage";
import CreateAutomationPage from "./pages/strategies/CreateAutomationPage";
import AutomationDetailsPage from "./pages/strategies/AutomationDetailsPage";
import SettingsSessionsPage from "./pages/account-settings/SettingsSessionsPage";
import SettingsGuardiansPage from "./pages/account-settings/SettingsGuardiansPage";

function App() {
  return (
    <div className=" ">
      <Toaster position="top-center" richColors />
      <Router>
        <StatesProvider>
          <EvmProvider>
            <SocketFiProvider
              config={{
                clientId: "sf_client_live_2st5s8mnt5qxmzm0q48a73iklg1s",
                guardians: [
                  "GBYV5SISEH5DNG2U56E6Y6DPT7C3WSR6NHO6QHT27ECWYRX66HQTAHHP",
                ],
                network: SOCKETFI_NETWORK,
              }}
            >
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<WalletDashboard />} />
                  <Route
                    path="/wallet-access"
                    element={<WalletAccessLanding />}
                  />
                  <Route
                    path="/social-intent"
                    element={<SocialIntentTransaction />}
                  />

                  <Route path="/dapps" element={<DappsDashboard />} />
                  <Route
                    path="/dapps/:id"
                    element={<DappInteractionDisplay />}
                  />

                  <Route path="/settings" element={<Settings />} />
                  <Route
                    path="/settings/sessions"
                    element={<SettingsSessionsPage />}
                  />
                  <Route
                    path="/settings/guardians"
                    element={<SettingsGuardiansPage />}
                  />

                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="/automations" element={<AutomationsPage />} />
                  <Route
                    path="/automations/:automationId"
                    element={<AutomationDetailsPage />}
                  />
                  <Route
                    path="/automations/new"
                    element={<CreateAutomationPage />}
                  />
                </Route>

                <Route path="/explorer" element={<CctpExplorerPage />} />
                <Route
                  path="/deposit/:address"
                  element={<PublicDepositPage />}
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </SocketFiProvider>
          </EvmProvider>
        </StatesProvider>
      </Router>
    </div>
  );
}

export default App;
