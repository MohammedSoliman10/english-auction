# English Auction — Contracts (Foundry)

Canonical Solidity toolchain (constitution: Tooling & Quality Gates).

## Pinned dependencies (R5 #2)

| Dependency | Location | Pin |
|------------|----------|-----|
| OpenZeppelin Contracts | `lib/openzeppelin-contracts/` | **v5.7.0** (git submodule, tag `cab19933` — release `v5.7.0`) |
| forge-std | `lib/forge-std/` | installed by `forge init` (v1.7.x era) |

> Restoring after a fresh clone: `git submodule update --init --recursive`

## Compiler

Exact-pinned **solc 0.8.31** for both contracts (R5 #3) — set via `foundry.toml`
(`solc = "0.8.31"`); both sources use `pragma solidity 0.8.31;`.

## Commands

```bash
forge build            # zero-warning build
forge fmt --check      # formatting gate
forge lint             # lint gate
forge test             # unit + fuzz + invariant (test-first per tasks.md)
forge coverage         # >=95% lines / >=90% branches (enforced by scripts/check.sh)
```

## Layout

- `src/EnglishAuction.sol` — auction escrow (start/bid/withdraw/end), duration param (R5 #1), `startingBid` immutable (R5 #8)
- `src/SolimanWeb3.sol` — ERC-721 minter (OZ `ERC721URIStorage`, `_safeMint` R5 #6)
- `test/` — unit (`EnglishAuction.t.sol`, `SolimanWeb3.t.sol`), fuzz, invariant suites
- `script/Deploy.s.sol` — demo-chain deployment (writes addresses for `backend/.env`)
