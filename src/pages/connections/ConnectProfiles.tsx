// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  ChevronRight,
  Link2,
  Lock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { BASE_URL, useStates } from "../../context/StatesContext";
import ConnectionModal from "../account-settings/ConnectionModal";
import Button from "../../components/Button";
import { getRequest, postRequest } from "../../utils/fetch-functions";
import { getAuthSession } from "../../utils/localStorage";
import { startAuthentication } from "@simplewebauthn/browser";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function PlatformIcon({ src, alt, bg = "bg-slate-100" }) {
  return (
    <div
      className={classNames(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-slate-200",
        bg
      )}
    >
      <img className="h-6 w-6 object-contain" src={src} alt={alt} />
    </div>
  );
}

function getProfileLabel(profile, fallback) {
  return (
    profile?.name ||
    profile?.displayName ||
    profile?.username ||
    profile?.screenName ||
    profile?.address ||
    profile?.email ||
    fallback
  );
}

function getProfileSubLabel(platformId, profile) {
  if (!profile) return "";

  if (platformId === "email") {
    return profile?.address || profile?.email || "";
  }

  if (profile?.screenName) {
    return `@${profile.screenName}`;
  }

  if (profile?.username) {
    return `@${profile.username}`;
  }

  return profile?.id ? `ID: ${profile.id}` : "";
}

function getProfileImage(platformId, profile, fallbackIcon) {
  if (!profile) return fallbackIcon;

  return (
    profile?.profileImageUrl ||
    profile?.avatar ||
    profile?.image ||
    profile?.picture ||
    fallbackIcon
  );
}

export default function ConnectProfiles() {
  const {
    activeSession,
    setActiveSession,
    updateData,
    triggerUpdate,
    selectedNetwork,
  } = useStates();

  const navigate = useNavigate();
  const userProfile = activeSession?.userProfile || {};
  const accessToken = activeSession?.accessToken;

  const [value, setValue] = useState("");
  const [verificationValue, setVerificationValue] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalInfo, setModalInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [twitterPendingLink, setTwitterPendingLink] = useState(null);
  const [discordPendingLink, setDiscordPendingLink] = useState(null);
  const [telegramPendingLink, setTelegramPendingLink] = useState(null);
  const [emailPendingLink, setEmailPendingLink] = useState(null);
  const twitterOptionsFetchedRef = useRef(false);
  const discordOptionsFetchedRef = useRef(false);

  const connectedCount = useMemo(() => {
    return ["email", "discord", "telegram", "twitter"].filter(
      (platform) =>
        userProfile?.[platform]?.id || userProfile?.[platform]?.address
    ).length;
  }, [userProfile]);

  const supportedSocialPlatforms = useMemo(
    () => [
      {
        id: "email",
        name: "Email Account",
        description: "Link an email address for account-based actions.",
        active: true,
        type: "modal",
        icon: (
          <PlatformIcon src="/EmailIcon.svg" alt="Email" bg="bg-slate-100" />
        ),
        modal: {
          title: "Connect Email",
          platform: "email",
          description:
            "Enter your email address and verify it to link it to your account.",
          inputLabel: "Email Address",
          placeholder: "you@example.com",
          isOpen: true,
          inputType: "regular",
        },
      },
      {
        id: "discord",
        name: "Discord Account",
        description: "Connect Discord for social wallet interactions.",
        active: true,
        type: "oauth",
        icon: (
          <PlatformIcon
            src="/DiscordIcon.svg"
            alt="Discord"
            bg="bg-[#eee7fb]"
          />
        ),
      },
      {
        id: "telegram",
        name: "Telegram Account",
        description: "Link Telegram through the SocketFi bot.",
        active: true,
        type: "modal",
        icon: (
          <PlatformIcon
            src="/TelegramIcon.svg"
            alt="Telegram"
            bg="bg-[#e2f4fb]"
          />
        ),
        modal: {
          title: "Connect Telegram",
          platform: "telegram",
          description:
            "Enter your Telegram username to link it to your account.",
          inputLabel: "Telegram Username",
          placeholder: "@socket",
          isOpen: true,
          inputType: "regular",
        },
      },
      {
        id: "twitter",
        name: "X Account",
        description: "Connect X for social intent transactions.",
        active: true,
        type: "oauth",
        icon: <PlatformIcon src="/XIcon.svg" alt="X" bg="bg-slate-100" />,
      },
      {
        id: "tiktok",
        name: "TikTok Account",
        description: "TikTok support is coming soon.",
        active: false,
        type: "disabled",
        icon: (
          <PlatformIcon src="/TiktokIcon.svg" alt="TikTok" bg="bg-[#f9e5fb]" />
        ),
      },
      {
        id: "message",
        name: "SMS Number",
        description: "Phone number support is coming soon.",
        active: false,
        type: "disabled",
        icon: (
          <PlatformIcon src="/MessageIcon.svg" alt="SMS" bg="bg-[#fbf3ba]" />
        ),
      },
    ],
    []
  );

  async function handleMapTwitterToSmartContract() {
    try {
      if (!twitterPendingLink?.options) {
        throw new Error("Missing Twitter link options");
      }

      setIsLoading(true);
      setMessage("passkey approval");

      const sigData = await startAuthentication({
        optionsJSON: twitterPendingLink.options,
      });

      console.log("the twitter pending is", twitterPendingLink);
      setMessage("Mapping to account");

      const tx = await postRequest(
        "auth/twitter/link/confirm",
        {
          sigData,
        },
        activeSession?.accessToken
      );

      console.log("the tx response", tx);

      if (!tx?.status === "SUCCESS") {
        throw new Error(tx?.error || "Unable to map X account");
      }

      toast.success("X account mapped successfully.");
      resetModalState();
      setTwitterPendingLink(null);
      triggerUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to map X account.");
    } finally {
      setIsLoading(false);
      setMessage("");
      navigate("/settings");
    }
  }

  async function handleMapDiscordToSmartContract() {
    try {
      if (!discordPendingLink?.options) {
        throw new Error("Missing Discord link options");
      }

      setIsLoading(true);
      setMessage("passkey approval");

      console.log(
        "the discord pending link options",
        discordPendingLink.options
      );

      const sigData = await startAuthentication({
        optionsJSON: discordPendingLink.options,
      });

      console.log("the discord pending is", discordPendingLink);
      setMessage("Mapping to account");

      const tx = await postRequest(
        "auth/discord/link/confirm",
        {
          sigData,
        },
        activeSession?.accessToken
      );

      console.log("the tx response", tx);

      if (!tx) {
        throw new Error(tx?.error || "Unable to map Discord account");
      }

      if (!tx?.status === "SUCCESS") {
        throw new Error(tx?.error || "Unable to map Discord account");
      }

      toast.success("Discord account mapped successfully.");
      resetModalState();
      setDiscordPendingLink(null);
      triggerUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to map Discord account.");
    } finally {
      setIsLoading(false);
      setMessage("");
      navigate("/settings");
    }
  }

  async function handleMapTelegramToSmartContract() {
    try {
      if (!telegramPendingLink?.options) {
        throw new Error("Missing Telegram link options");
      }

      setIsLoading(true);
      setMessage("passkey approval");

      console.log(
        "the telegram pending link options",
        telegramPendingLink.options
      );

      const sigData = await startAuthentication({
        optionsJSON: telegramPendingLink.options,
      });

      console.log("the telegram pending is", telegramPendingLink);
      setMessage("Mapping to account");

      const tx = await postRequest(
        `auth/telegram/link/confirm?pendingId=${telegramPendingLink.telegram.pendingId}`,
        {
          sigData,
        },
        activeSession?.accessToken
      );

      console.log("the tx response", tx);

      if (!tx) {
        throw new Error(tx?.error || "Unable to map Telegram account");
      }

      if (!tx?.status === "SUCCESS") {
        throw new Error(tx?.error || "Unable to map Telegram account");
      }

      toast.success("Telegram account mapped successfully.");
      resetModalState();
      setTelegramPendingLink(null);
      triggerUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to map Telegram account.");
    } finally {
      setIsLoading(false);
      setMessage("");
      navigate("/settings");
    }
  }

  async function handleMapEmailToSmartContract() {
    try {
      if (!emailPendingLink?.options) {
        throw new Error("Missing Email link options");
      }

      setIsLoading(true);
      setMessage("passkey approval");

      console.log("the email pending link options", emailPendingLink.options);

      const sigData = await startAuthentication({
        optionsJSON: emailPendingLink.options,
      });

      console.log("the email pending is", emailPendingLink);
      setMessage("Mapping to account");

      const tx = await postRequest(
        `auth/email/link/confirm?pendingId=${emailPendingLink.email.pendingId}`,
        {
          sigData,
        },
        activeSession?.accessToken
      );

      console.log("the tx response", tx);

      if (!tx) {
        throw new Error(tx?.error || "Unable to map Email account");
      }

      if (!tx?.status === "SUCCESS") {
        throw new Error(tx?.error || "Unable to map Email account");
      }

      toast.success("Email account mapped successfully.");
      resetModalState();
      setEmailPendingLink(null);
      triggerUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to map Email account.");
    } finally {
      setIsLoading(false);
      setMessage("");
      navigate("/settings");
    }
  }

  function openPlatform(platform) {
    if (!platform?.active) return;

    const profile = userProfile?.[platform.id];
    const alreadyConnected = profile?.id || profile?.address;

    if (alreadyConnected) return;

    if (platform.type === "modal") {
      setError("");
      setValue("");
      setModalInfo(platform.modal);
      return;
    }

    if (platform.type === "oauth") {
      handleSubmit(platform.id);
    }
  }

  function validateInput(platform) {
    const cleanValue = value.trim();

    if (platform === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(cleanValue)) {
        return "Enter a valid email address.";
      }
    }

    if (platform === "telegram") {
      const usernameRegex = /^@?[a-zA-Z0-9_]{5,32}$/;

      if (!usernameRegex.test(cleanValue)) {
        return "Enter a valid Telegram username.";
      }
    }

    if (platform === "email-otp" || platform === "telegram-otp") {
      if (!cleanValue || cleanValue.length < 4) {
        return "Enter a valid verification code.";
      }
    }

    return "";
  }

  function resetModalState() {
    setModalInfo(null);
    setValue("");
    setVerificationValue("");
    setError("");
    setMessage("");
    navigate("/settings");
  }

  async function handleSubmit(platform) {
    const cleanValue = value.trim();

    setError("");

    if (!accessToken) {
      toast.error("Session expired. Please sign in again.");
      navigate("/");
      return;
    }

    if (!["discord", "twitter"].includes(platform)) {
      const validationError = validateInput(platform);

      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return;
      }
    }

    try {
      setIsLoading(true);

      if (platform === "twitter-onchain") {
        await handleMapTwitterToSmartContract();
        return;
      }

      if (platform === "discord-onchain") {
        await handleMapDiscordToSmartContract();
        return;
      }

      if (platform === "telegram-onchain") {
        await handleMapTelegramToSmartContract();
        return;
      }

      if (platform === "email-onchain") {
        await handleMapEmailToSmartContract();
        return;
      }

      if (platform === "email") {
        setMessage("Processing");

        const res = await postRequest(
          "init-add-email",
          { email: cleanValue },
          accessToken
        );

        if (res?.message === "Verification code sent") {
          toast.success("Verification code sent.");

          setModalInfo({
            title: "Verify Email",
            platform: "email-otp",
            description: `Enter the verification code sent to ${cleanValue}.`,
            inputLabel: "Verification Code",
            placeholder: "123456",
            isOpen: true,
            inputType: "otp",
          });

          setVerificationValue(cleanValue);
          setValue("");
          setMessage("");
        }

        return;
      }

      if (platform === "email-otp") {
        setMessage("Verifying");

        const response = await postRequest(
          "verify-email",
          {
            email: verificationValue,
            otp: cleanValue,
            network: selectedNetwork,
          },
          accessToken
        );

        console.log({ response });

        if (response?.success) {
          // toast.success("Email verified successfully.");

          const { email, network, walletContractId, options, signAccess } =
            response;

          setEmailPendingLink({
            email,
            network,
            walletContractId,
            options,
            signAccess,
          });

          setModalInfo({
            title: "Confirm Email Account",
            platform: "email-onchain",
            description:
              "This email account was verified successfully. Review it before mapping it to your smart wallet.",
            isOpen: true,
            inputType: "confirm",
            email: response.email,
            network: response.network,
            walletContractId: response.walletContractId,
            cancelText: "Cancel",
            submitText: "Map to Wallet",
          });
        } else {
          toast.error(response?.error || "Unable to verify Telegram.");
        }

        return;
      }

      if (platform === "telegram") {
        setMessage("Processing");

        const username = cleanValue.startsWith("@")
          ? cleanValue.slice(1)
          : cleanValue;

        try {
          const response = await fetch(`${BASE_URL}/init-telegram-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ username }),
          });

          const data = await response.json();

          if (data?.pendingId) {
            setModalInfo({
              title: "Verify Telegram",
              platform: "telegram-otp",
              link: {
                url: "https://t.me/socketfi_bot",
                name: "SocketFi Bot",
              },
              description:
                "Get your Telegram code by sending /start to the SocketFi bot.",
              inputLabel: "Verification Code",
              placeholder: "123456",
              isOpen: true,
              inputType: "otp",
            });

            setVerificationValue(username);
            setValue("");
            setMessage("");
          } else {
            toast.error(data.error);
          }
        } catch (error) {
          console.error(error);
          toast.error(
            error.message || "Unable to start Telegram verification."
          );
        }

        return;
      }

      if (platform === "telegram-otp") {
        setMessage("Verifying");

        const response = await fetch(`${BASE_URL}/verify-telegram-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ otp: cleanValue, network: selectedNetwork }),
        });

        const data = await response.json();

        console.log({ data });

        if (data?.success) {
          // toast.success("Telegram account verified successfully.");

          console.log({ data });
          const { telegram, network, walletContractId, options, signAccess } =
            data;

          setTelegramPendingLink({
            telegram,
            network,
            walletContractId,
            options,
            signAccess,
          });

          setModalInfo({
            title: "Confirm Telegram Account",
            platform: "telegram-onchain",
            description:
              "This telegram account was authenticated successfully. Review it before mapping it to your smart wallet.",
            isOpen: true,
            inputType: "confirm",
            telegram: data.telegram,
            network: data.network,
            walletContractId: data.walletContractId,
            cancelText: "Cancel",
            submitText: "Map to Wallet",
          });
        } else {
          toast.error(data?.error || "Unable to verify Telegram.");
        }

        return;
      }

      if (platform === "discord") {
        window.location.href = `${BASE_URL}/init-discord-auth?token=${accessToken}&network=${selectedNetwork}`;
        return;
      }

      if (platform === "twitter") {
        window.location.href = `${BASE_URL}/init-twitter-auth?token=${accessToken}&network=${selectedNetwork}`;
      }
    } catch (err) {
      console.error("Connection error:", err);
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setMessage("");
    }
  }

  return (
    <div className="mx-auto flex w-full flex-col px-0  ">
      <ConnectionModal
        message={message}
        isLoading={isLoading}
        value={value}
        setValue={setValue}
        error={error}
        setError={setError}
        modalInfo={modalInfo}
        onClose={resetModalState}
        handleSubmit={handleSubmit}
      />

      <main className="space-y-5 mb-10">
        <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <Link2 className="h-3.5 w-3.5" />
                Supported platforms
              </div>

              <h3 className="mt-3 text-xl font-semibold text-slate-900">
                Choose a profile to connect
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Connected profiles are shown as verified and cannot be linked
                twice.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {supportedSocialPlatforms.map((platform) => {
              const profile = userProfile?.[platform.id];
              const isConnected = Boolean(profile?.id || profile?.address);
              const isDisabled = !platform.active || isConnected;

              console.log("the profile is", userProfile);
              return (
                <button
                  key={platform.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => openPlatform(platform)}
                  className={classNames(
                    "group flex min-h-[132px] w-full items-start justify-between gap-4 rounded-[22px] border p-4 text-left transition-all duration-200",
                    isConnected
                      ? "border-emerald-200 bg-emerald-50/50"
                      : platform.active
                      ? "border-slate-200 bg-white hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-[#f8fbff] hover:shadow-sm"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {isConnected && profile?.profileImageUrl ? (
                      <img
                        src={profile?.profileImageUrl}
                        alt={getProfileLabel(profile, platform.name)}
                        className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover"
                      />
                    ) : (
                      platform.icon
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {platform.name}
                        </p>

                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <BadgeCheck className="h-3 w-3" />
                            Connected
                          </span>
                        ) : !platform.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                            <Lock className="h-3 w-3" />
                            Soon
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 break-words text-sm leading-5 text-slate-500">
                        {isConnected
                          ? getProfileLabel(profile, platform.description)
                          : platform.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={classNames(
                      "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition",
                      isConnected
                        ? "bg-emerald-100 text-emerald-700"
                        : platform.active
                        ? "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                        : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {isConnected ? (
                      <BadgeCheck className="h-4 w-4" />
                    ) : platform.active ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
