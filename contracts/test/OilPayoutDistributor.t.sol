// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OilPayoutDistributor } from "../src/OilPayoutDistributor.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal Foundry cheatcode interface (avoids a forge-std dependency).
interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4 selector) external;           // matches selector-only (no-arg) reverts
    function expectPartialRevert(bytes4 selector) external;     // matches selector prefix, ignores args
}

/// @dev Minimal ERC20 mock (USDC-like: transfer returns bool).
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amt) external { balanceOf[to] += amt; }
    function transfer(address to, uint256 amt) external returns (bool) {
        require(balanceOf[msg.sender] >= amt, "insufficient");
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

contract OilPayoutDistributorTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    MockUSDC usdc;
    OilPayoutDistributor dist;

    // Same fixed inputs used in the JS cross-check (scripts/oil-build-merkle.js hashing).
    address constant alice = address(1);
    address constant bob   = address(2);
    address constant carol = address(3);
    address constant dave  = address(4);
    uint256 constant aAmt = 10_000000;  // 10 USDC (6 dp)
    uint256 constant bAmt = 25_000000;
    uint256 constant cAmt = 5_000000;
    uint256 constant dAmt = 60_000000;
    uint256 constant TOTAL = 100_000000;

    // Root produced by the JS builder for the identical, identically-ordered leaves.
    bytes32 constant JS_ROOT = 0x751ca89f9a9f867f4813ed0a39f7188a93c233ed449555d96949af3fe8a612e8;

    uint256 deadline;
    bytes32 root;
    bytes32 l0; bytes32 l1; bytes32 l2; bytes32 l3;
    bytes32 n01; bytes32 n23;

    function setUp() public {
        usdc = new MockUSDC();

        // 4-leaf tree, same order as the JS builder.
        l0 = _leaf(alice, aAmt);
        l1 = _leaf(bob,   bAmt);
        l2 = _leaf(carol, cAmt);
        l3 = _leaf(dave,  dAmt);
        n01 = _hashPair(l0, l1);
        n23 = _hashPair(l2, l3);
        root = _hashPair(n01, n23);

        deadline = block.timestamp + 1 days;
        dist = new OilPayoutDistributor(IERC20(address(usdc)), root, deadline, address(this));
        usdc.mint(address(dist), TOTAL);
    }

    /// Cross-check: the Solidity-built root equals the JS builder's root for identical input.
    function test_RootMatchesJsBuilder() public view {
        require(root == JS_ROOT, "root mismatch JS<>SOL");
    }

    function test_ClaimHappyPath() public {
        vm.prank(alice);
        dist.claim(aAmt, _proof(l1, n23));
        require(usdc.balanceOf(alice) == aAmt, "alice not paid");
        require(dist.claimed(alice), "claimed flag not set");
        require(usdc.balanceOf(address(dist)) == TOTAL - aAmt, "dist balance wrong");

        vm.prank(bob);
        dist.claim(bAmt, _proof(l0, n23));
        require(usdc.balanceOf(bob) == bAmt, "bob not paid");
    }

    function test_DoubleClaimReverts() public {
        vm.prank(alice);
        dist.claim(aAmt, _proof(l1, n23));

        vm.prank(alice);
        vm.expectRevert(OilPayoutDistributor.AlreadyClaimed.selector);
        dist.claim(aAmt, _proof(l1, n23));
    }

    function test_BadProofReverts() public {
        // alice's amount with the wrong proof (bob's sibling layout)
        vm.prank(alice);
        vm.expectRevert(OilPayoutDistributor.InvalidProof.selector);
        dist.claim(aAmt, _proof(l0, n23));
    }

    function test_WrongAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(OilPayoutDistributor.InvalidProof.selector);
        dist.claim(aAmt + 1, _proof(l1, n23));
    }

    function test_WrongClaimantReverts() public {
        // carol replays alice's (amount, proof) — the leaf binds to msg.sender, so it fails.
        vm.prank(carol);
        vm.expectRevert(OilPayoutDistributor.InvalidProof.selector);
        dist.claim(aAmt, _proof(l1, n23));
    }

    function test_SweepBeforeDeadlineReverts() public {
        vm.expectRevert(OilPayoutDistributor.DeadlineNotPassed.selector);
        dist.sweep(address(this));
    }

    function test_SweepByNonOwnerReverts() public {
        vm.warp(deadline + 1);
        vm.prank(bob);
        // OwnableUnauthorizedAccount carries an address arg → match the selector prefix.
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        dist.sweep(bob);
    }

    function test_SweepAfterDeadlineReturnsRemainder() public {
        vm.prank(alice);
        dist.claim(aAmt, _proof(l1, n23));

        vm.warp(deadline + 1);
        dist.sweep(address(this));
        require(usdc.balanceOf(address(this)) == TOTAL - aAmt, "sweep amount wrong");
        require(usdc.balanceOf(address(dist)) == 0, "dist not emptied");
    }

    // ── helpers (mirror the contract's hashing exactly) ──
    function _leaf(address a, uint256 amt) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a, amt))));
    }
    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
    function _proof(bytes32 x, bytes32 y) internal pure returns (bytes32[] memory p) {
        p = new bytes32[](2);
        p[0] = x;
        p[1] = y;
    }
}
