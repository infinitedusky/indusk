# Solidity

You are working with Solidity smart contracts. Follow these patterns.

## Security First

- Check-Effects-Interactions pattern: check conditions, update state, then make external calls
- Use `ReentrancyGuard` for any function that makes external calls
- Never use `tx.origin` for authorization — use `msg.sender`
- Use `SafeMath` or Solidity 0.8+ built-in overflow protection
- Mark functions as `view` or `pure` when they don't modify state
- Use `private` or `internal` by default — only `public`/`external` when needed

## Gas Optimization

- Use `calldata` instead of `memory` for read-only function parameters
- Pack storage variables — `uint128` next to `uint128` uses one slot, not two
- Use `mapping` over arrays when you don't need iteration
- Short-circuit expensive operations with early `require` checks
- Use events for data that doesn't need on-chain access

## Patterns

- Use OpenZeppelin contracts as base — don't reimplement ERC20, ERC721, access control
- Proxy patterns (UUPS, Transparent) for upgradeable contracts — but only if you genuinely need upgradeability
- Use `immutable` for values set in the constructor that never change
- Use `constant` for compile-time constants

## Common Gotchas

- `msg.value` persists across internal calls — don't assume it's zero in a called function
- `delegatecall` preserves `msg.sender` and `msg.value` — this is a feature, not a bug, but it surprises people
- Division truncates — `7 / 2 = 3`, not 3.5. Use fixed-point libraries for precision
- `block.timestamp` can be manipulated by miners within ~15 seconds — don't use for precise timing
- Always test with Foundry (`forge test`) — it's faster and more capable than Hardhat for contract testing
