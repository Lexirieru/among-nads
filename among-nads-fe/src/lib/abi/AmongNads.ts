export const AmongNadsABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "AlreadyBet",
    type: "error",
    inputs: [
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    name: "AlreadyClaimed",
    type: "error",
    inputs: [
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    name: "BetBelowMinimum",
    type: "error",
    inputs: [
      {
        name: "sent",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minimum",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    name: "BetTokenNotSet",
    type: "error",
    inputs: [],
  },
  {
    name: "InsufficientHouseBalance",
    type: "error",
    inputs: [
      {
        name: "available",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "required",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    name: "InvalidGameId",
    type: "error",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    name: "InvalidGameState",
    type: "error",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "current",
        type: "uint8",
        internalType: "enum IAmongNads.GameState",
      },
    ],
  },
  {
    name: "NoBetToClaim",
    type: "error",
    inputs: [
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    name: "NotOwner",
    type: "error",
    inputs: [],
  },
  {
    name: "TransferFailed",
    type: "error",
    inputs: [],
  },
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "team",
        type: "uint8",
        indexed: false,
        internalType: "enum IAmongNads.Team",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "BetTokenSet",
    type: "event",
    inputs: [
      {
        name: "token",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    name: "Deposited",
    type: "event",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "GameLocked",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "GameSettled",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "winningTeam",
        type: "uint8",
        indexed: false,
        internalType: "enum IAmongNads.Team",
      },
    ],
    anonymous: false,
  },
  {
    name: "PayoutClaimed",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "PoolSeeded",
    type: "event",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "crewAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "impAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "Swept",
    type: "event",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    name: "MIN_BET",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "PROTOCOL_FEE_BPS",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "betToken",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC20",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "bets",
    type: "function",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
      {
        name: "team",
        type: "uint8",
        internalType: "enum IAmongNads.Team",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "claimed",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "claimPayout",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "deposit",
    type: "function",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "games",
    type: "function",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "state",
        type: "uint8",
        internalType: "enum IAmongNads.GameState",
      },
      {
        name: "totalPool",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "crewmatesPool",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "impostorsPool",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "crewmatesSeed",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "impostorsSeed",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "winningTeam",
        type: "uint8",
        internalType: "enum IAmongNads.Team",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "getBet",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "bettor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IAmongNads.Bet",
        components: [
          {
            name: "bettor",
            type: "address",
            internalType: "address",
          },
          {
            name: "team",
            type: "uint8",
            internalType: "enum IAmongNads.Team",
          },
          {
            name: "amount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "claimed",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    name: "getGame",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IAmongNads.Game",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "state",
            type: "uint8",
            internalType: "enum IAmongNads.GameState",
          },
          {
            name: "totalPool",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "crewmatesPool",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "impostorsPool",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "crewmatesSeed",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "impostorsSeed",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "winningTeam",
            type: "uint8",
            internalType: "enum IAmongNads.Team",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    name: "hasBets",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "hasUserBets",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "houseBalance",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "lockGame",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "nextGameId",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "owner",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "placeBet",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "team",
        type: "uint8",
        internalType: "enum IAmongNads.Team",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "seedPool",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "crewAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "impAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setBetToken",
    type: "function",
    inputs: [
      {
        name: "_token",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "settleGame",
    type: "function",
    inputs: [
      {
        name: "gameId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "winningTeam",
        type: "uint8",
        internalType: "enum IAmongNads.Team",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "sweep",
    type: "function",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export default AmongNadsABI;
