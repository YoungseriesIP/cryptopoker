// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcPokerTournament is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    uint256 public constant MAX_FEE_BPS = 500;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 9;

    enum TournamentStatus {
        Created,
        Active,
        Completed,
        Cancelled
    }

    struct Tournament {
        uint256 id;
        uint256 buyIn;
        uint8 maxPlayers;
        TournamentStatus status;
        uint8 playerCount;
        uint256 pot;
        address winner;
        address creatorAddress;
        uint256 startTime;
    }

    IERC20 public immutable usdcToken;

    uint256 public tournamentCounter;
    uint256 public platformFeeBps;
    address public treasury;

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => mapping(address => bool)) public hasEntered;
    mapping(uint256 => address[]) private tournamentPlayers;

    mapping(uint256 => bool) public supportedBuyIn;
    uint256[] private supportedBuyInList;
    mapping(uint256 => uint256) private supportedBuyInIndexPlusOne;

    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, uint256 buyIn, uint8 maxPlayers);
    event PlayerEntered(uint256 indexed tournamentId, address indexed player);
    event PlayerLeft(uint256 indexed tournamentId, address indexed player);
    event TournamentSettled(
        uint256 indexed tournamentId,
        address indexed winner,
        uint256 grossPot,
        uint256 feeAmount,
        bytes32 gameResultHash
    );
    event TournamentCancelled(uint256 indexed tournamentId);
    event EmergencyRefund(uint256 indexed tournamentId);

    event FeeUpdated(uint256 newFeeBps);
    event TreasuryUpdated(address indexed newTreasury);
    event SupportedBuyInUpdated(uint256 amount, bool supported);

    error ZeroAddress();
    error InvalidFeeBps();
    error InvalidBuyIn();
    error InvalidMaxPlayers();
    error TournamentNotFound();
    error InvalidTournamentState();
    error AlreadyEntered();
    error NotEntered();
    error TournamentFull();
    error InvalidWinner();
    error UnauthorizedCancellation();

    constructor(address usdc, address admin, address settler, address feeTreasury) {
        if (usdc == address(0) || admin == address(0) || settler == address(0) || feeTreasury == address(0)) {
            revert ZeroAddress();
        }

        usdcToken = IERC20(usdc);
        treasury = feeTreasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
    }

    function setFee(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > MAX_FEE_BPS) revert InvalidFeeBps();
        platformFeeBps = bps;
        emit FeeUpdated(bps);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setSupportedBuyIn(uint256 amount, bool supported) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount == 0) revert InvalidBuyIn();

        bool currentlySupported = supportedBuyIn[amount];
        if (currentlySupported == supported) {
            emit SupportedBuyInUpdated(amount, supported);
            return;
        }

        supportedBuyIn[amount] = supported;

        if (supported) {
            supportedBuyInIndexPlusOne[amount] = supportedBuyInList.length + 1;
            supportedBuyInList.push(amount);
        } else {
            uint256 indexPlusOne = supportedBuyInIndexPlusOne[amount];
            uint256 index = indexPlusOne - 1;
            uint256 lastIndex = supportedBuyInList.length - 1;

            if (index != lastIndex) {
                uint256 lastAmount = supportedBuyInList[lastIndex];
                supportedBuyInList[index] = lastAmount;
                supportedBuyInIndexPlusOne[lastAmount] = index + 1;
            }

            supportedBuyInList.pop();
            delete supportedBuyInIndexPlusOne[amount];
        }

        emit SupportedBuyInUpdated(amount, supported);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function createTournament(uint256 buyIn, uint8 maxPlayers) external whenNotPaused returns (uint256 tournamentId) {
        if (!supportedBuyIn[buyIn]) revert InvalidBuyIn();
        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) revert InvalidMaxPlayers();

        tournamentId = ++tournamentCounter;

        tournaments[tournamentId] = Tournament({
            id: tournamentId,
            buyIn: buyIn,
            maxPlayers: maxPlayers,
            status: TournamentStatus.Created,
            playerCount: 0,
            pot: 0,
            winner: address(0),
            creatorAddress: msg.sender,
            startTime: 0
        });

        emit TournamentCreated(tournamentId, msg.sender, buyIn, maxPlayers);
    }

    function enterTournament(uint256 tournamentId) external nonReentrant whenNotPaused {
        Tournament storage tournament = _getTournament(tournamentId);

        if (tournament.status != TournamentStatus.Created) revert InvalidTournamentState();
        if (hasEntered[tournamentId][msg.sender]) revert AlreadyEntered();
        if (tournament.playerCount >= tournament.maxPlayers) revert TournamentFull();

        hasEntered[tournamentId][msg.sender] = true;
        tournamentPlayers[tournamentId].push(msg.sender);

        unchecked {
            tournament.playerCount += 1;
        }
        tournament.pot += tournament.buyIn;

        usdcToken.safeTransferFrom(msg.sender, address(this), tournament.buyIn);

        if (tournament.playerCount == tournament.maxPlayers) {
            tournament.status = TournamentStatus.Active;
            tournament.startTime = block.timestamp;
        }

        emit PlayerEntered(tournamentId, msg.sender);
    }

    function leaveTournament(uint256 tournamentId) external nonReentrant whenNotPaused {
        Tournament storage tournament = _getTournament(tournamentId);

        if (tournament.status != TournamentStatus.Created) revert InvalidTournamentState();
        if (!hasEntered[tournamentId][msg.sender]) revert NotEntered();

        hasEntered[tournamentId][msg.sender] = false;
        _removePlayer(tournamentId, msg.sender);

        unchecked {
            tournament.playerCount -= 1;
        }
        tournament.pot -= tournament.buyIn;

        usdcToken.safeTransfer(msg.sender, tournament.buyIn);

        emit PlayerLeft(tournamentId, msg.sender);
    }

    function settleTournament(
        uint256 tournamentId,
        address winner,
        bytes32 gameResultHash
    ) external nonReentrant whenNotPaused onlyRole(SETTLER_ROLE) {
        Tournament storage tournament = _getTournament(tournamentId);

        if (tournament.status != TournamentStatus.Active) revert InvalidTournamentState();
        if (winner == address(0)) revert ZeroAddress();
        if (!hasEntered[tournamentId][winner]) revert InvalidWinner();

        uint256 grossPot = tournament.pot;
        uint256 feeAmount = (grossPot * platformFeeBps) / 10_000;
        uint256 winnerPayout = grossPot - feeAmount;

        tournament.status = TournamentStatus.Completed;
        tournament.winner = winner;
        tournament.pot = 0;

        _clearParticipants(tournamentId);

        if (feeAmount > 0) {
            usdcToken.safeTransfer(treasury, feeAmount);
        }
        usdcToken.safeTransfer(winner, winnerPayout);

        emit TournamentSettled(tournamentId, winner, grossPot, feeAmount, gameResultHash);
    }

    function cancelTournament(uint256 tournamentId) external nonReentrant whenNotPaused {
        Tournament storage tournament = _getTournament(tournamentId);

        if (msg.sender != tournament.creatorAddress && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedCancellation();
        }
        if (tournament.status != TournamentStatus.Created) revert InvalidTournamentState();

        tournament.status = TournamentStatus.Cancelled;
        _refundAll(tournamentId, tournament);

        emit TournamentCancelled(tournamentId);
    }

    function emergencyRefund(uint256 tournamentId) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        Tournament storage tournament = _getTournament(tournamentId);

        if (tournament.status == TournamentStatus.Completed || tournament.status == TournamentStatus.Cancelled) {
            revert InvalidTournamentState();
        }

        tournament.status = TournamentStatus.Cancelled;
        _refundAll(tournamentId, tournament);

        emit EmergencyRefund(tournamentId);
    }

    function getTournamentPlayers(uint256 tournamentId) external view returns (address[] memory) {
        return tournamentPlayers[tournamentId];
    }

    function getSupportedBuyIns() external view returns (uint256[] memory) {
        return supportedBuyInList;
    }

    function _refundAll(uint256 tournamentId, Tournament storage tournament) internal {
        address[] storage players = tournamentPlayers[tournamentId];
        uint256 playerLength = players.length;

        for (uint256 i = 0; i < playerLength; ++i) {
            address player = players[i];
            if (hasEntered[tournamentId][player]) {
                hasEntered[tournamentId][player] = false;
                usdcToken.safeTransfer(player, tournament.buyIn);
            }
        }

        delete tournamentPlayers[tournamentId];
        tournament.playerCount = 0;
        tournament.pot = 0;
    }

    function _clearParticipants(uint256 tournamentId) internal {
        address[] storage players = tournamentPlayers[tournamentId];
        uint256 playerLength = players.length;

        for (uint256 i = 0; i < playerLength; ++i) {
            hasEntered[tournamentId][players[i]] = false;
        }

        delete tournamentPlayers[tournamentId];
    }

    function _removePlayer(uint256 tournamentId, address player) internal {
        address[] storage players = tournamentPlayers[tournamentId];
        uint256 playerLength = players.length;

        for (uint256 i = 0; i < playerLength; ++i) {
            if (players[i] == player) {
                uint256 lastIndex = playerLength - 1;
                if (i != lastIndex) {
                    players[i] = players[lastIndex];
                }
                players.pop();
                break;
            }
        }
    }

    function _getTournament(uint256 tournamentId) internal view returns (Tournament storage tournament) {
        tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentNotFound();
    }
}
