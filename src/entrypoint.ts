// EntryPoint v0.7 ABI — only the functions the bundler needs

export const EP_ABI = [
  {
    name: "handleOps",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "ops", type: "tuple[]",
        components: [
          { name: "sender",             type: "address" },
          { name: "nonce",              type: "uint256" },
          { name: "initCode",           type: "bytes"   },
          { name: "callData",           type: "bytes"   },
          { name: "accountGasLimits",   type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees",            type: "bytes32" },
          { name: "paymasterAndData",   type: "bytes"   },
          { name: "signature",          type: "bytes"   },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getUserOpHash",
    type: "function",
    stateMutability: "view",
    inputs: [{
      name: "userOp", type: "tuple",
      components: [
        { name: "sender",             type: "address" },
        { name: "nonce",              type: "uint256" },
        { name: "initCode",           type: "bytes"   },
        { name: "callData",           type: "bytes"   },
        { name: "accountGasLimits",   type: "bytes32" },
        { name: "preVerificationGas", type: "uint256" },
        { name: "gasFees",            type: "bytes32" },
        { name: "paymasterAndData",   type: "bytes"   },
        { name: "signature",          type: "bytes"   },
      ],
    }],
    outputs: [{ type: "bytes32" }],
  },
] as const;
