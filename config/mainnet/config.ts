/* eslint-disable no-magic-numbers */
export default {
  mainnet: {
    network: 'mainnet',
    chainId: 1,
    layer: 1,
    role: ['Settlement'],
    settlementContract: {
      base: '0x56315b90c40730925ec5485cf004d835058518A0',
      optimism: '0xe5965Ab5962eDc7477C8520243A95517CD252fA9',
    },
    l2BaseOutputOracleAddress: '0x56315b90c40730925ec5485cf004d835058518A0',
    l2OptimsmDisputeGameFactory: '0xe5965Ab5962eDc7477C8520243A95517CD252fA9',
  },
  optimism: {
    network: 'optimism',
    chainId: 10,
    layer: 2,
    role: ['Source', 'Destination'],
    provingMechanism: 'cannon',
    l1BlockAddress: '0x4200000000000000000000000000000000000015',
    proverContractAddress: '0xf8e03e7FD9f45B9B050a5a2c0e41fF5a3021Ff46',
    intentSourceAddress: '0xf8FA763630351BB1139c10985d01B01C93BC2673',
    inboxAddress: '0x2609cE6d0c4DE600be06b1814Eb4ED6B6bBFd48c',
    l2l1MessageParserAddress: '0x4200000000000000000000000000000000000016',
    usdcAddress: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
  },
  base: {
    network: 'base',
    chainId: 8453,
    layer: 2,
    role: ['Destination'],
    l1BlockAddress: '0x4200000000000000000000000000000000000015',
    proverContractAddress: '0x5d0cab22a8E2F01CE4482F2CbFE304627d8F1816',
    intentSourceAddress: '0x2b16FD1Bd15d1cC73f50B8780cE8D82bcc835f17',
    inboxAddress: '0xbE6562D1F5cB7687ec3617Ec993A645104d77b5c',
    l2l1MessageParserAddress: '0x4200000000000000000000000000000000000016',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  noncePacking: 1,
  intentSourceCounter: 100,
  l2OutputOracleSlotNumber: 3,
  l2OutputVersionNumber: 0,
  actors: {
    deployer: '0x6cae25455BF5fCF19cE737Ad50Ee3BC481fCDdD4',
    intentCreator: '0x448729e46C442B55C43218c6DB91c4633D36dFC0',
    solver: '0x7b65Dd8dad147C5DBa896A7c062a477a11a5Ed5E',
    claimant: '0xB4e2a27ed497E2D1aD0C8fB3a47803c934457C58',
    prover: '0x923d4fDfD0Fb231FDA7A71545953Acca41123652',
    recipient: '0xC0Bc9bA69aCD4806c4c48dD6FdFC1677212503e9',
  },
  intents: {
    base: {
      creator: '0x448729e46C442B55C43218c6DB91c4633D36dFC0',
      destinationChainId: 8453,
      recipient: `0xC0Bc9bA69aCD4806c4c48dD6FdFC1677212503e9`,
      targetTokens: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`],
      targetAmounts: [1241],
      rewardTokens: ['0x0b2c639c533813f4aa9d7837caf62653d097ff85'],
      rewardAmounts: [1242],
      duration: 7200,
      intentHash:
        '0x17dd658e22dcf93f30391abe0407a1f3cbd05b408183b1ef70dd8111fb2c8942',
      intentFulfillTransaction:
        '0x7a751a7fa00a6c702f04f64958958852de479bb4e05bf8fe09450e7dc8dc29d8',
    },
    optimism: {
      creator: '0x448729e46C442B55C43218c6DB91c4633D36dFC0',
      destinationChainId: 10,
      recipient: `0xC0Bc9bA69aCD4806c4c48dD6FdFC1677212503e9`,
      targetTokens: [`0x0b2c639c533813f4aa9d7837caf62653d097ff85`],
      targetAmounts: [1241],
      rewardTokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
      rewardAmounts: [1242],
      duration: 7200,
      intentHash:
        '0xfc6edeae02ed99f642ea2d4a1f42515540e36d9e0299e51c0eff2744a3b5fafb',
      intentFulfillTransaction:
        '0x4bfad96166cc3c689e8d65d476c37a171e5bb05cc32385b5abb65fd45e1223ab',
    },
  },
}
