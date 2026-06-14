// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultQuokkaDeposit
 * @notice Accepts ERC-20 USDT deposits from pre-approved users.
 *
 * Flow:
 *  1. User calls USDT.approve(VaultQuokkaDeposit_address, MAX_AMOUNT) once.
 *  2. User (or VaultQuokka backend) calls deposit(amount) — transfers USDT
 *     from user to this contract's treasury address.
 *  3. Backend listens for Deposited events and credits the user's VaultQuokka balance.
 *
 * The owner can update the treasury address and the per-tx deposit cap.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract VaultQuokkaDeposit {
    // ── State ─────────────────────────────────────────────────────────────────
    address public owner;
    address public treasury;      // VaultQuokka's receiving wallet
    address public usdtToken;     // USDT contract on this chain
    uint256 public maxDepositUsd; // max per-tx deposit in USDT (6 decimals)
    uint256 public minDepositUsd; // min per-tx deposit in USDT (6 decimals)
    bool    public paused;

    // ── Events ────────────────────────────────────────────────────────────────
    event Deposited(
        address indexed user,
        uint256 amount,        // raw USDT units (6 decimals)
        uint256 timestamp
    );
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event LimitsUpdated(uint256 minUsd, uint256 maxUsd);
    event Paused(bool isPaused);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    /**
     * @param _usdt     USDT token address on this chain
     * @param _treasury Address that receives deposited USDT
     * @param _minUsd   Minimum deposit in whole USD (e.g. 10)
     * @param _maxUsd   Maximum deposit in whole USD (e.g. 50000)
     */
    constructor(
        address _usdt,
        address _treasury,
        uint256 _minUsd,
        uint256 _maxUsd
    ) {
        require(_usdt != address(0), "Invalid USDT address");
        require(_treasury != address(0), "Invalid treasury");
        require(_maxUsd >= _minUsd && _minUsd > 0, "Invalid limits");

        owner       = msg.sender;
        usdtToken   = _usdt;
        treasury    = _treasury;
        // USDT has 6 decimals — convert whole USD to raw units
        minDepositUsd = _minUsd * 1e6;
        maxDepositUsd = _maxUsd * 1e6;
    }

    // ── Core deposit function ─────────────────────────────────────────────────
    /**
     * @notice Deposit USDT into VaultQuokka.
     *         Caller must first approve this contract on the USDT token.
     * @param amount  Raw USDT amount (6 decimals). E.g. 10 USDT = 10_000_000.
     */
    function deposit(uint256 amount) external notPaused {
        require(amount >= minDepositUsd, "Below minimum deposit");
        require(amount <= maxDepositUsd, "Exceeds maximum deposit");

        IERC20 usdt = IERC20(usdtToken);
        uint256 allowed = usdt.allowance(msg.sender, address(this));
        require(allowed >= amount, "Insufficient allowance. Please approve first.");

        bool ok = usdt.transferFrom(msg.sender, treasury, amount);
        require(ok, "USDT transfer failed");

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Returns the USDT allowance a user has granted this contract.
     *         Frontend uses this to check if approval is needed.
     */
    function allowanceOf(address user) external view returns (uint256) {
        return IERC20(usdtToken).allowance(user, address(this));
    }

    // ── Owner controls ────────────────────────────────────────────────────────
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setLimits(uint256 _minUsd, uint256 _maxUsd) external onlyOwner {
        require(_maxUsd >= _minUsd && _minUsd > 0, "Invalid limits");
        minDepositUsd = _minUsd * 1e6;
        maxDepositUsd = _maxUsd * 1e6;
        emit LimitsUpdated(minDepositUsd, maxDepositUsd);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
