// @ts-nocheck
import { IoCloseSharp } from "react-icons/io5";
import { ExternalLink, ShieldCheck } from "lucide-react";
import Button from "../../components/Button";

export default function ConnectionModal({
	value,
	setValue,
	onClose,
	modalInfo,
	error,
	setError,
	handleSubmit,
	isLoading,
	message,
}) {
	if (!modalInfo) return null;

	const isOtp = modalInfo?.inputType === "otp";
	const inputType = isOtp
		? "text"
		: modalInfo?.platform === "email"
			? "email"
			: "text";

	function handleChange(event) {
		const nextValue = isOtp
			? event.target.value.replace(/\D/g, "").slice(0, 6)
			: event.target.value;

		setValue(nextValue);
		setError?.("");
	}

	function handleKeyDown(event) {
		if (event.key === "Enter" && !isLoading) {
			handleSubmit(modalInfo?.platform);
		}

		if (event.key === "Escape" && !isLoading) {
			onClose?.();
		}
	}

	const isTwitterOnchain = modalInfo?.platform === "twitter-onchain";
	const twitter = modalInfo?.twitter;

	const isDiscordOnchain = modalInfo?.platform === "discord-onchain";
	const discord = modalInfo?.discord;

	const isTelegramOnchain = modalInfo?.platform === "telegram-onchain";
	const telegram = modalInfo?.telegram;

	const isEmailOnchain = modalInfo?.platform === "email-onchain";
	const email = modalInfo?.email;

	return (
		<div
			role="presentation"
			className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-950/40 px-3 py-6 backdrop-blur-sm sm:px-6"
			onClick={() => {
				if (!isLoading) onClose?.();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="connection-modal-title"
				className="w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef4ff_55%,#f8fafc_100%)] p-5 sm:p-6">
					<div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-indigo-200/30 blur-3xl" />

					<div className="relative flex items-start justify-between gap-4">
						<div className="flex min-w-0 items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
								<ShieldCheck className="h-5 w-5" />
							</div>

							<div className="min-w-0">
								<h2
									id="connection-modal-title"
									className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
								>
									{modalInfo?.title}
								</h2>

								<p className="mt-1 text-sm leading-6 text-slate-600">
									{modalInfo?.description}
								</p>

								{modalInfo?.link?.url && (
									<a
										className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 transition hover:text-indigo-800"
										href={modalInfo.link.url}
										target="_blank"
										rel="noopener noreferrer"
									>
										{modalInfo?.link?.name || "Open link"}
										<ExternalLink className="h-3.5 w-3.5" />
									</a>
								)}
							</div>
						</div>

						<button
							type="button"
							onClick={onClose}
							disabled={isLoading}
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
							aria-label="Close modal"
						>
							<IoCloseSharp className="h-5 w-5" />
						</button>
					</div>
				</div>

				<div className="p-5 sm:p-6">
					{isTwitterOnchain ? (
						<div className="space-y-5">
							<div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
								<img
									src={twitter?.profileImageUrl || "x.svg"}
									alt={twitter?.name}
									className="h-14 w-14 rounded-full border border-slate-200"
								/>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-base font-semibold text-slate-900">
											{twitter?.name}
										</p>

										<ShieldCheck className="h-4 w-4 text-indigo-600" />
									</div>

									<p className="text-sm text-slate-500">
										@{twitter?.screenName}
									</p>

									<p className="mt-1 break-all text-xs text-slate-400">
										ID: {twitter?.id}
									</p>
								</div>
							</div>

							<div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
								This account will be mapped to your smart wallet after passkey
								approval.
							</div>

							{modalInfo?.walletContractId && (
								<div className="rounded-2xl border border-slate-200 bg-white p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
										Wallet
									</p>

									<p className="mt-2 break-all text-sm text-slate-700">
										{modalInfo.walletContractId}
									</p>
								</div>
							)}

							<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
								<div className="w-full ">
									<Button noBackground onClick={onClose} disabled={isLoading}>
										{modalInfo?.cancelText || "Cancel"}
									</Button>
								</div>

								<div className="w-full ">
									<Button
										message={message}
										isLoading={isLoading}
										disabled={isLoading}
										onClick={() => handleSubmit(modalInfo?.platform)}
									>
										{modalInfo?.submitText || "Map to Wallet"}
									</Button>
								</div>
							</div>
						</div>
					) : isDiscordOnchain ? (
						<div className="space-y-5">
							<div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
								<img
									src={discord?.avatar || "/DiscordIcon.svg"}
									alt={discord?.username}
									className="h-14 w-14 rounded-full border border-slate-200"
								/>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-base font-semibold text-slate-900">
											{discord?.username.toUpperCase()}
										</p>

										<ShieldCheck className="h-4 w-4 text-indigo-600" />
									</div>

									<p className="text-sm text-slate-500">@{discord?.username}</p>

									<p className="mt-1 break-all text-xs text-slate-400">
										ID: {discord?.id}
									</p>
								</div>
							</div>

							<div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
								This account will be mapped to your smart wallet after passkey
								approval.
							</div>

							{modalInfo?.walletContractId && (
								<div className="rounded-2xl border border-slate-200 bg-white p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
										Wallet
									</p>

									<p className="mt-2 break-all text-sm text-slate-700">
										{modalInfo.walletContractId}
									</p>
								</div>
							)}

							<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
								<div className="w-full ">
									<Button noBackground onClick={onClose} disabled={isLoading}>
										{modalInfo?.cancelText || "Cancel"}
									</Button>
								</div>

								<div className="w-full ">
									<Button
										message={message}
										isLoading={isLoading}
										disabled={isLoading}
										onClick={() => handleSubmit(modalInfo?.platform)}
									>
										{modalInfo?.submitText || "Map to Wallet"}
									</Button>
								</div>
							</div>
						</div>
					) : isTelegramOnchain ? (
						<div className="space-y-5">
							<div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
								<img
									src={telegram?.avatar || "/TelegramIcon.svg"}
									alt={telegram?.username}
									className="h-14 w-14 rounded-full border border-slate-200"
								/>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-base font-semibold text-slate-900">
											{telegram?.username.toUpperCase()}
										</p>

										<ShieldCheck className="h-4 w-4 text-indigo-600" />
									</div>

									<p className="text-sm text-slate-500">
										@{telegram?.username}
									</p>

									<p className="mt-1 break-all text-xs text-slate-400">
										ID: {telegram?.id}
									</p>
								</div>
							</div>

							<div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
								This account will be mapped to your smart wallet after passkey
								approval.
							</div>

							{modalInfo?.walletContractId && (
								<div className="rounded-2xl border border-slate-200 bg-white p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
										Wallet
									</p>

									<p className="mt-2 break-all text-sm text-slate-700">
										{modalInfo.walletContractId}
									</p>
								</div>
							)}

							<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
								<div className="w-full ">
									<Button noBackground onClick={onClose} disabled={isLoading}>
										{modalInfo?.cancelText || "Cancel"}
									</Button>
								</div>

								<div className="w-full ">
									<Button
										message={message}
										isLoading={isLoading}
										disabled={isLoading}
										onClick={() => handleSubmit(modalInfo?.platform)}
									>
										{modalInfo?.submitText || "Map to Wallet"}
									</Button>
								</div>
							</div>
						</div>
					) : isEmailOnchain ? (
						<div className="space-y-5">
							<div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
								<img
									src={email?.avatar || "/EmailIcon.svg"}
									alt="Email Avatar"
									className="h-14 w-14 rounded-full border border-slate-200"
								/>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-base font-semibold text-slate-900">
											{email?.address.toUpperCase()}
										</p>

										<ShieldCheck className="h-4 w-4 text-indigo-600" />
									</div>

									<p className="text-sm text-slate-500">@{email?.address}</p>

									{/* <p className="mt-1 break-all text-xs text-slate-400">
										ID: {telegram?.id}
									</p> */}
								</div>
							</div>

							<div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
								This account will be mapped to your smart wallet after passkey
								approval.
							</div>

							{modalInfo?.walletContractId && (
								<div className="rounded-2xl border border-slate-200 bg-white p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
										Wallet
									</p>

									<p className="mt-2 break-all text-sm text-slate-700">
										{modalInfo.walletContractId}
									</p>
								</div>
							)}

							<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
								<div className="w-full ">
									<Button noBackground onClick={onClose} disabled={isLoading}>
										{modalInfo?.cancelText || "Cancel"}
									</Button>
								</div>

								<div className="w-full ">
									<Button
										message={message}
										isLoading={isLoading}
										disabled={isLoading}
										onClick={() => handleSubmit(modalInfo?.platform)}
									>
										{modalInfo?.submitText || "Map to Wallet"}
									</Button>
								</div>
							</div>
						</div>
					) : (
						<>
							<div>
								<label className="mb-2 block text-sm font-semibold text-slate-700">
									{modalInfo?.inputLabel}
								</label>

								<input
									type={inputType}
									inputMode={isOtp ? "numeric" : undefined}
									autoComplete={isOtp ? "one-time-code" : "off"}
									placeholder={modalInfo?.placeholder || ""}
									value={value}
									onChange={handleChange}
									onKeyDown={handleKeyDown}
									disabled={isLoading}
									maxLength={isOtp ? 6 : undefined}
									autoFocus
									className="min-h-[48px] w-full rounded-2xl border border-slate-200 px-4 py-3"
								/>

								{error && <p className="mt-2 text-sm text-red-500">{error}</p>}
							</div>

							<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
								<div className="w-full sm:max-w-[150px]">
									<Button noBackground onClick={onClose}>
										Cancel
									</Button>
								</div>

								<div className="w-full sm:max-w-[180px]">
									<Button
										message={message}
										isLoading={isLoading}
										disabled={isLoading}
										onClick={() => handleSubmit(modalInfo?.platform)}
									>
										Continue
									</Button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
