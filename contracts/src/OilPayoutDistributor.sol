// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OilPayoutDistributor
 * @notice Merkle-based, pull-payment USDC distributor for an oil-game season.
 *
 * Settlement rail for the OFF-CHAIN fixed-rate payout (payout = (banked+tank) oil ×
 * pot/OIL_FIELD_UNITS). The operator computes amounts off-chain (scripts/oil-payout.js
 * → scripts/oil-build-merkle.js), publishes the Merkle root here, and funds the
 * contract with the pot. Players CLAIM their own payout with a proof — the operator
 * never pushes N transfers and holds no hot wallet during distribution.
 *
 *   • Escrow:        the pot sits in this contract; anyone can verify it's funded.
 *   • Non-custodial: each player pays their own claim gas.
 *   • Bounded:       you only ever fund what you intend to pay.
 *   • Operator keeps remainder: unclaimed funds are swept back after `claimDeadline`
 *                    (matches the "operator keeps unfound/unclaimed oil" rule).
 *
 * Leaf format (OpenZeppelin StandardMerkleTree compatible — same as the JS builder):
 *   leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))))
 * OZ MerkleProof hashes internal nodes as sorted (commutative) pairs.
 *
 * Built on OpenZeppelin 5.6.1 (SafeERC20 / MerkleProof / Ownable / ReentrancyGuard).
 * ⚠️ Still get an independent security review before escrowing real money.
 */
contract OilPayoutDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutable config ────────────────────────────────────────────────
    IERC20  public immutable token;        // USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    bytes32 public immutable merkleRoot;   // published off-chain root of (account, amount)
    uint256 public immutable claimDeadline; // unix ts; after this the owner can sweep the remainder

    // ── State ───────────────────────────────────────────────────────────
    mapping(address => bool) public claimed; // one claim per account

    // ── Events ──────────────────────────────────────────────────────────
    event Claimed(address indexed account, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    error AlreadyClaimed();
    error InvalidProof();
    error DeadlineNotPassed();

    constructor(IERC20 _token, bytes32 _merkleRoot, uint256 _claimDeadline, address _owner)
        Ownable(_owner)
    {
        token = _token;
        merkleRoot = _merkleRoot;
        claimDeadline = _claimDeadline;
    }

    /**
     * @notice Claim your season payout. `amount` and `proof` come from the published
     *         oil-merkle.json (keyed by your wallet).
     */
    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        if (claimed[msg.sender]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        claimed[msg.sender] = true; // effects before interaction (checks-effects-interactions)
        token.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice After the claim window closes, the operator withdraws the unclaimed
     *         remainder. On-chain form of "operator keeps unfound oil".
     */
    function sweep(address to) external onlyOwner nonReentrant {
        if (block.timestamp <= claimDeadline) revert DeadlineNotPassed();

        uint256 remaining = token.balanceOf(address(this));
        if (remaining > 0) token.safeTransfer(to, remaining);

        emit Swept(to, remaining);
    }
}
