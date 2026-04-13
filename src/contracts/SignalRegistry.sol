// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SignalRegistry
/// @notice On-chain reputation layer for agent price predictions on X Layer.
///         Agents stake OKB behind predictions; Uniswap V3 prices settle verdicts.
contract SignalRegistry {
    struct Signal {
        address agent;
        string pair;
        int16 basisPoints;       // predicted change in bps (+200 = +2%)
        uint256 windowSeconds;
        uint256 stakedOKB;       // in wei
        uint256 createdAt;
        uint256 priceAtCreation; // scaled 1e18
        bool settled;
        bool correct;
    }

    mapping(uint256 => Signal) public signals;
    mapping(address => int256) public reputation;
    mapping(address => uint256) public signalCount;
    mapping(address => uint256) public correctCount;

    uint256 public nextSignalId;
    address public owner;

    int256 public constant REP_CORRECT  =  10;
    int256 public constant REP_WRONG    = -15;

    event SignalPublished(
        uint256 indexed signalId,
        address indexed agent,
        string pair,
        int16 basisPoints,
        uint256 windowSeconds,
        uint256 stakedOKB
    );

    event SignalSettled(
        uint256 indexed signalId,
        address indexed agent,
        bool correct,
        uint256 stakedOKB,
        int256 reputationDelta
    );

    constructor() {
        owner = msg.sender;
    }

    /// @notice Publish a prediction and stake OKB.
    function publishSignal(
        string calldata pair,
        int16 basisPoints,
        uint256 windowSeconds,
        uint256 priceAtCreation
    ) external payable returns (uint256 signalId) {
        require(msg.value > 0, "Must stake OKB");
        require(windowSeconds >= 300, "Min window 5 min");
        require(basisPoints != 0, "basisPoints cannot be zero");

        signalId = nextSignalId++;
        signals[signalId] = Signal({
            agent: msg.sender,
            pair: pair,
            basisPoints: basisPoints,
            windowSeconds: windowSeconds,
            stakedOKB: msg.value,
            createdAt: block.timestamp,
            priceAtCreation: priceAtCreation,
            settled: false,
            correct: false
        });

        signalCount[msg.sender]++;

        emit SignalPublished(signalId, msg.sender, pair, basisPoints, windowSeconds, msg.value);
    }

    /// @notice Settle an expired signal. Anyone can call; verdict determined off-chain.
    function settleSignal(uint256 signalId, bool correct) external {
        Signal storage s = signals[signalId];
        require(s.agent != address(0), "Signal not found");
        require(!s.settled, "Already settled");
        require(block.timestamp >= s.createdAt + s.windowSeconds, "Window not elapsed");

        s.settled = true;
        s.correct = correct;

        int256 delta;
        if (correct) {
            delta = REP_CORRECT;
            correctCount[s.agent]++;
            // Return stake to agent
            (bool sent,) = s.agent.call{value: s.stakedOKB}("");
            require(sent, "Stake return failed");
        } else {
            delta = REP_WRONG;
            // Burn stake
            (bool sent,) = address(0xdead).call{value: s.stakedOKB}("");
            require(sent, "Burn failed");
        }

        reputation[s.agent] += delta;

        emit SignalSettled(signalId, s.agent, correct, s.stakedOKB, delta);
    }

    /// @notice Leaderboard helper — returns reputation for a batch of addresses.
    function getReputations(address[] calldata agents)
        external view returns (int256[] memory scores)
    {
        scores = new int256[](agents.length);
        for (uint256 i = 0; i < agents.length; i++) {
            scores[i] = reputation[agents[i]];
        }
    }

    receive() external payable {}
}
