# English Auction

Single-page web app for on-chain English auctions — a strictly monochrome ("Caliper")
instrument UI over two Solidity contracts, with a hosted shared chain (no Sepolia, no
visitor-side tooling).

| Layer | Tech |
|-------|------|
| Contracts | Foundry · solc **0.8.31** (pinned) · OpenZeppelin **v5.7.0** |
| Frontend | React 19 · Vite · wagmi v3 / viem 2 · Tailwind CSS v4 |
| Backend | Node ≥ 20 · Express 5 — serves SPA, `/api/*`, proxies `/rpc` |
| Chain | Anvil (chainId **2026**), hosted server-side with state persistence |

## Quick start

```bash
npm install
./scripts/start-chain.sh        # terminal 1 — anvil (persistent state)
./scripts/deploy.sh             # one-shot: deploy contracts → backend/.env
npm run dev                     # backend :3000 + frontend :5173
```

Full validation walkthrough: [`specs/001-auction-web-ui/quickstart.md`](specs/001-auction-web-ui/quickstart.md)

## Quality gate

```bash
./scripts/check.sh   # fmt + lint + build + tests + coverage(≥95/90) + palette + bundle budget
```

## Spec-driven workflow (Spec Kit)

Spec → plan → tasks live in [`specs/001-auction-web-ui/`](specs/001-auction-web-ui/);
project principles in [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

> Docs are synced at T067 — run/deploy/validation detail lands there during Polish.
