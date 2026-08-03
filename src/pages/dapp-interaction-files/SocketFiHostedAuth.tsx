// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

const SOCKETFI_SERVER = "https://server.socket.fi";

async function postRequest(path, body) {
  const res = await fetch(`${SOCKETFI_SERVER}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "SocketFi auth failed");
  }

  return data;
}

function getAuthMode() {
  return window.location.pathname.includes("/signup") ? "signup" : "signin";
}

function StatusScreen({ status, message }) {
  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "20px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "360px",
          borderRadius: "24px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          boxShadow: "0 20px 60px rgba(15,23,42,0.12)",
          padding: "28px",
          textAlign: "center",
        }}
      >
        {isLoading ? (
          <div
            style={{
              margin: "0 auto 18px",
              height: "36px",
              width: "36px",
              borderRadius: "999px",
              border: "2px solid #e2e8f0",
              borderTopColor: "#2800AA",
              animation: "socketfi-spin 800ms linear infinite",
            }}
          />
        ) : (
          <div
            style={{
              margin: "0 auto 18px",
              height: "44px",
              width: "44px",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isSuccess ? "#ecfdf5" : "#fff1f2",
              color: isSuccess ? "#047857" : "#be123c",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            {isSuccess ? "✓" : "!"}
          </div>
        )}

        <h1
          style={{
            margin: 0,
            fontSize: "18px",
            lineHeight: "28px",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {isLoading
            ? "Authenticating..."
            : isSuccess
            ? "Authentication successful"
            : "Authentication failed"}
        </h1>

        <p
          style={{
            margin: "8px 0 0",
            fontSize: "14px",
            lineHeight: "22px",
            color: "#64748b",
          }}
        >
          {message}
        </p>

        <a
          href="https://www.socket.fi/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "20px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#94a3b8",
            textDecoration: "none",
          }}
        >
          Powered by{" "}
          <strong style={{ color: "#475569", fontWeight: 600 }}>
            SocketFi
          </strong>
        </a>

        <style>
          {`
            @keyframes socketfi-spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </section>
    </main>
  );
}

export default function SocketFiHostedAuth() {
  const mode = useMemo(() => getAuthMode(), []);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState(
    mode === "signup"
      ? "Creating your secure SocketFi wallet..."
      : "Signing in securely with SocketFi..."
  );

  const tempAccess = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("tempAccess");
  }, []);

  useEffect(() => {
    async function runAuth() {
      if (!tempAccess) {
        setStatus("error");
        setMessage(
          "Invalid or expired session. Please restart authentication."
        );
        sendErrorToApp("Missing temporary access token.");
        return;
      }

      try {
        const initPath =
          mode === "signup"
            ? "/auth/hosted/init-passkey-register"
            : "/auth/hosted/init-passkey-login";

        const initRes = await postRequest(initPath, { tempAccess });

        const authData =
          mode === "signup"
            ? await startRegistration(initRes.options)
            : await startAuthentication(initRes.options);

        const authRes = await postRequest("/auth/hosted/verify-auth", {
          id: initRes.id,
          tempAccess,
          authData,
        });

        window.opener?.postMessage(
          {
            type: "SOCKETFI_AUTH_SUCCESS",
            session: authRes.session,
          },
          authRes.allowedOrigin
        );

        setStatus("success");
        setMessage("You are signed in. This window will close automatically.");

        setTimeout(() => {
          window.close();
        }, 900);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Authentication failed.";

        window.opener?.postMessage(
          {
            type: "SOCKETFI_AUTH_ERROR",
            message: errorMessage,
          },
          "*"
        );

        setStatus("error");
        setMessage(errorMessage || "Please return to the app and try again.");
      }
    }

    runAuth();
  }, [mode, tempAccess]);

  function sendErrorToApp(errorMessage) {
    window.opener?.postMessage(
      {
        type: "SOCKETFI_AUTH_ERROR",
        message: errorMessage,
      },
      "*"
    );
  }

  return <StatusScreen status={status} message={message} />;
}
