# Official Protocol Migration Plan

## Goal

Migrate the client so that core wallet functionality no longer depends on any
CoinSpace backend.

Core flows that must work without CoinSpace backend services:

- wallet creation
- wallet unlock and decryption
- balance loading
- transaction history loading
- fee estimation
- transaction signing
- transaction broadcast

Optional features that may still use our own server:

- market prices
- charts
- exchange
- fiat ramps
- app update metadata

Social features are out of scope and should be removed entirely.

## Supported Chains

Initial scope is limited to:

- Bitcoin
- Tron
- Ethereum
- Polygon

No other chains will be migrated in the first phase.

## Product Requirements

### 1. No CoinSpace backend dependency

The client must not depend on:

- CoinSpace main site server
- CoinSpace price service
- CoinSpace swap service
- CoinSpace ramp service
- CoinSpace chain API services such as `btc.*`, `trx.*`, `eth.*`, or
  `polygon.*`

### 2. Official protocol approach

Chain access must use official protocols or compatible public/private nodes.

Examples:

- Bitcoin: Esplora-compatible API
- Tron: TRON HTTP API / TronGrid-compatible API
- Ethereum: JSON-RPC
- Polygon: JSON-RPC

### 3. Explorer support is allowed

Blockchain explorers are allowed for:

- transaction history queries where official node APIs are insufficient
- deep links to transaction and address pages

### 4. Optional server features

Market and price features will move to our own server API and must be fully
optional.

The client must provide an `Offline Mode` switch that disables all server-backed
features in one action.

## Target Architecture

### Local-only core

Introduce a local-first wallet architecture:

- `LocalVault`
  - stores encrypted seed locally
  - derives unlock key from PIN or device keystore
  - replaces `/api/v4/register` and `/api/v4/token/*`
- `LocalProfileStore`
  - stores settings, wallet metadata, and per-chain local state
  - replaces current server-backed settings/details/storage flows
- `StaticCryptoCatalog`
  - ships supported asset metadata with the app
  - remote updates are optional and must not block startup
- `ChainAdapter`
  - one adapter per supported chain
  - speaks official protocol or explorer/indexer APIs directly
- `ExplorerService`
  - generates explorer URLs for transactions and addresses

### Optional online services

Introduce optional feature services that can be disabled globally:

- `MarketService`
- `ChartService`
- `ExchangeService`
- `RampService`
- `UpdateService`

## Chain Connection Model

Each supported chain needs a configurable connection profile.

Example shape:

```ts
type ChainConnection =
  | {
      chain: 'btc';
      apiType: 'esplora';
      apiBase: string;
      explorerBase: string;
    }
  | {
      chain: 'trx';
      apiType: 'tron';
      rpcBase: string;
      historyBase?: string;
      explorerBase: string;
    }
  | {
      chain: 'eth' | 'polygon';
      apiType: 'evm-rpc';
      rpcBase: string;
      historyBase?: string;
      explorerBase: string;
    };
```

Notes:

- `rpcBase` is for balance, nonce, gas, fee data, and broadcast
- `historyBase` is optional because history often comes from explorer/indexer
  APIs rather than node RPC
- `explorerBase` is for external links only

## Settings UX

Add a new settings section for chain connections.

### Per-chain settings

For each supported chain:

- select a predefined data source
- select a predefined explorer
- add a custom node or API endpoint
- test connectivity
- set as active source
- reset to recommended defaults

### Predefined sources

Ship several validated options for each chain.

Examples:

- Bitcoin
  - mempool.space
  - Blockstream Esplora
- Tron
  - TronGrid
  - another TronGrid-compatible endpoint
- Ethereum
  - public JSON-RPC endpoints we approve
- Polygon
  - public JSON-RPC endpoints we approve

### Custom source support

Users can add custom endpoints with a `+` action.

Required validation:

- endpoint URL format
- API compatibility check
- minimal health check before save

## Offline Mode

Add a global `Offline Mode` switch.

When enabled, the client must disable all features that require our own server:

- prices
- charts
- exchange
- ramps
- update checks
- any feature discovery that depends on our server

Expected behavior:

- hide entry points in the UI
- short-circuit related network requests
- do not block wallet startup on disabled services

Offline Mode must not disable chain-node traffic. It only disables our own
server-backed features.

## Features To Remove

Remove all social and server-bound identity features, including:

- Mecto
- invitation flows
- username-driven discovery
- server-side profile requirements that only exist for social features

## Migration Scope By Layer

### Layer A: local auth and storage

Replace:

- server registration
- server-issued unlock tokens
- server-backed settings
- server-backed details
- server-backed wallet storage
- server-backed exchange storage

With:

- local encrypted vault
- local settings store
- local wallet metadata store

### Layer B: chain adapters

Replace CoinSpace-specific wallet transport logic with our own adapters for:

- BTC
- TRX
- ETH
- Polygon

Adapters must own:

- account loading
- balance loading
- history loading
- fee estimation
- transaction build
- signing handoff
- broadcast
- explorer URL generation

### Layer C: optional services

Move price and market features to our own server APIs and gate them behind:

- feature toggle
- Offline Mode

## Recommended Implementation Order

### Phase 1: local foundation

- build `LocalVault`
- build `LocalProfileStore`
- replace server token flow
- replace server settings/details/storage flow
- make app startup local-first

### Phase 2: settings and configuration

- add `Connections` settings screen
- add per-chain source selection
- add custom endpoint management
- add `Offline Mode`

### Phase 3: first chain migration

Start with Tron.

Reason:

- protocol surface is manageable
- direct user value is clear
- node and explorer boundaries are easier to test than Bitcoin UTXO support

Deliverables:

- TRX balance
- TRX send
- TRX broadcast
- TRX history
- configurable node and explorer support

### Phase 4: EVM migration

Migrate Ethereum and Polygon next.

Deliverables:

- ETH balance, send, history
- Polygon balance, send, history
- shared EVM RPC adapter with per-chain explorer configuration

### Phase 5: Bitcoin migration

Migrate Bitcoin with an Esplora-compatible adapter.

Deliverables:

- BTC balance
- BTC UTXOs
- BTC fee estimation
- BTC send
- BTC history

## Risks

### 1. History is not a pure RPC problem

For TRX, ETH, and Polygon, transaction history may need explorer/indexer APIs
instead of only node RPC.

### 2. Existing CoinSpace wallet packages are not a drop-in fit

Current `@coinspace/cs-*wallet` packages are tightly coupled to CoinSpace-style
API contracts. They should not remain the primary transport layer for migrated
chains.

### 3. Startup flow must be redesigned

Current account initialization assumes server availability. This must become
local-first before the chain migration is complete.

### 4. Feature hiding must be strict

Offline Mode and disabled server features must affect:

- routes
- settings entries
- startup requests
- background refreshes
- error messages

## Success Criteria

The migration is successful when all of the following are true:

- the app can create and unlock a wallet without any CoinSpace backend
- BTC, TRX, ETH, and Polygon core flows work through official or compatible
  public/private endpoints
- users can choose predefined endpoints or add custom ones
- users can choose a block explorer per supported chain
- server-backed market features can be disabled cleanly
- social features are fully removed

## Immediate Next Step

Implement the local foundation first:

1. local vault
2. local settings/details/storage
3. startup refactor to remove server dependency
4. connection settings model
5. TRX adapter as the first migrated chain
