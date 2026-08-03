# SocketFi

**SocketFi** is a smart account and DeFi gateway for the Stellar ecosystem, enabling users to seamlessly interact with decentralized applications through a unified wallet experience.

SocketFi abstracts away blockchain complexity by providing secure smart accounts, intuitive transaction flows, and integrated access to leading Stellar protocols such as Aquarius, Blend, Soroswap, and cross-chain infrastructure.

---

## Features

### Smart Account Wallet

- Passkey authentication (WebAuthn)
- Stellar wallet authentication
- EVM wallet authentication
- Unified multi-network wallet experience
- Secure transaction signing
- Session-based authorization

---

### Integrated DeFi

Interact with popular Stellar protocols directly from a single interface.

Current integrations include:

- **Aquarius**

  - Token swaps
  - Liquidity pools
  - Liquidity management

- **Blend**

  - Lending markets
  - Supply assets
  - Borrow assets
  - Repay loans
  - Portfolio management

- **Soroswap**
  - Decentralized token swaps
  - Aggregated routing

---

### Cross-Chain Transfers

Bridge assets between supported blockchain networks through integrated cross-chain infrastructure.

Supported integrations include:

- Circle CCTP
- NEAR Intents
- Allbridge

---

### Portfolio Management

- View balances across supported assets
- Transaction history
- Token management
- Network-aware asset discovery

---

### Developer-Friendly

SocketFi is designed as a reusable wallet infrastructure that can be integrated into decentralized applications with minimal effort.

Features include:

- Smart account SDK
- Wallet authentication
- Transaction authorization
- Contract interaction
- Multi-wallet support
- Session management

---

## Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Wagmi
- Viem
- Stellar SDK
- Soroban

---

## Supported Networks

### Stellar

- Public Network
- Testnet

### EVM

- Ethereum
- Base
- Arbitrum
- Optimism
- Polygon
- BNB Chain
- Avalanche
- Sepolia
- BNB Testnet

---

## Development

Install dependencies

```bash
pnpm install
```

Run the development server

```bash
pnpm dev
```

Build for production

```bash
pnpm build
```

Run type checking

```bash
pnpm tsc --noEmit
```

---

## Project Structure

```
src/
├── components/
├── context/
├── pages/
├── services/
├── hooks/
├── utils/
├── sdk/
└── assets/
```

---

## Vision

SocketFi aims to make decentralized finance accessible by providing a unified, secure, and intuitive interface for interacting with the Stellar ecosystem and connected blockchain networks.

Rather than requiring users to understand wallets, contracts, and blockchain mechanics, SocketFi enables them to focus on the financial actions they want to perform while the platform securely manages the underlying complexity.

---

## License

MIT
