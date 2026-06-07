// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 * Leaf format (OpenZeppelin StandardMerkleTree compatible):
 *   leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))))
 * Nodes are hashed as sorted (commutative) pairs, so proof order doesn't matter.
 *
 * ⚠️ UNAUDITED reference scaffold. Get a security review before escrowing real money.
 * For production prefer OpenZeppelin's SafeERC20 / MerkleProof / Ownable over the
 * minimal inlined versions here (kept inline so the repo needs no Solidity deps).
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract OilPayoutDistributor {
    // ── Immutable config ────────────────────────────────────────────────
    IERC20  public immutable token;        // USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    bytes32 public immutable merkleRoot;   // published off-chain root of (account, amount)
    uint256 public immutable claimDeadline; // unix ts; after this the operator can sweep the remainder
    address public immutable owner;        // operator (can sweep after deadline)

    // ── State ───────────────────────────────────────────────────────────
    mapping(address => bool) public claimed; // one claim per account
    bool private _locked;                     // reentrancy guard

    // ── Events ──────────────────────────────────────────────────────────
    event Claimed(address indexed account, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    error AlreadyClaimed();
    error InvalidProof();
    error TransferFailed();
    error DeadlineNotPassed();
    error NotOwner();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(IERC20 _token, bytes32 _merkleRoot, uint256 _claimDeadline, address _owner) {
        token = _token;
        merkleRoot = _merkleRoot;
        claimDeadline = _claimDeadline;
        owner = _owner;
    }

    /**
     * @notice Claim your season payout. `amount` and `proof` come from the published
     *         oil-merkle.json (keyed by your wallet).
     */
    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        if (claimed[msg.sender]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!_verify(proof, merkleRoot, leaf)) revert InvalidProof();

        claimed[msg.sender] = true; // effects before interaction (checks-effects-interactions)
        _safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice After the claim window closes, the operator withdraws the unclaimed
     *         remainder. This is the on-chain form of "operator keeps unfound oil".
     */
    function sweep(address to) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (block.timestamp <= claimDeadline) revert DeadlineNotPassed();

        uint256 remaining = token.balanceOf(address(this));
        _safeTransfer(to, remaining);

        emit Swept(to, remaining);
    }

    // ── Internal ────────────────────────────────────────────────────────

    /// @dev Sorted-pair (commutative) Merkle proof verification.
    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            computed = computed <= p
                ? keccak256(abi.encodePacked(computed, p))
                : keccak256(abi.encodePacked(p, computed));
        }
        return computed == root;
    }

    /// @dev Tolerates both bool-returning and void ERC20s (USDC returns true).
    function _safeTransfer(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
