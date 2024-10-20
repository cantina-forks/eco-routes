import {
  AbiCoder,
  Block,
  Contract,
  encodeRlp,
  getAddress,
  getBytes,
  hexlify,
  keccak256,
  solidityPackedKeccak256,
  stripZerosLeft,
  toBeArray,
  toQuantity,
  toNumber,
  zeroPadValue,
  toBeHex,
} from 'ethers'
import {
  networkIds,
  networks,
  actors,
  // intent,
} from '../../config/preprod/config'
import { s } from '../../config/preprod/setup'
// import { version } from 'os'
// import { latestBlock } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time'
// import { intent } from '../../test/testData'

type SourceChainInfo = {
  sourceChain: number
  lastProvenBlock: BigInt
  needNewProvenState: boolean
}
// type SourceChains = SourceChainInfo[]

type Intent = {
  sourceChain: number
  intentHash: string
  claimant: string
  blockNumber: BigInt
}
// type Intents = Intent[]

async function getRLPEncodedBlock(block) {
  console.log('In getRLPEncodedBlock')

  const rlpEncodedBlockData = encodeRlp([
    block.parentHash,
    block.sha3Uncles,
    block.miner,
    block.stateRoot,
    block.transactionsRoot,
    block.receiptsRoot,
    block.logsBloom,
    stripZerosLeft(toBeHex(block.difficulty)), // Add stripzeros left here
    toBeHex(block.number),
    toBeHex(block.gasLimit),
    toBeHex(block.gasUsed),
    block.timestamp,
    block.extraData,
    block.mixHash,
    block.nonce,
    toBeHex(block.baseFeePerGas),
    block.withdrawalsRoot,
    // stripZerosLeft(toBeHex(block.blobGasUsed || 0x0)),
    // stripZerosLeft(toBeHex(block.excessBlobGas || 0x0)),
    block.parentBeaconBlockRoot,
  ])
  return rlpEncodedBlockData
}

// export async function getBatchSettledCannon() {
//   // Get the Latest Batch Settled for Base to Ethereum
//   // Get the latest resolved fault dispute game
//   // Get the GameId information for the fault dispute game
//   // return faultDisputeGame address, gameId, blockNumber
//   // Recommend making approximateUnsettledGames configurable and could go as high as 84 but safest is zero.
//   // Get the Output Index and Block Number from L2 OUTPUT ORACLE that was sent before this block
//   console.log('In getBatchSettled')
//   const disputeGameFactoryContract = s.mainnetSettlementContractBase
//   const approximateUnsettledGames = 70n // Initial Test on Mainnet gave 327
//   let blockNumber, gameIndex, faultDisputeGameAddress, faultDisputeGameContract
//   gameIndex =
//     (await disputeGameFactoryContract.gameCount()) -
//     1n -
//     approximateUnsettledGames
//   // lastGame = 1712n
//   while (gameIndex > 0) {
//     const gameData = await disputeGameFactoryContract.gameAtIndex(gameIndex)
//     faultDisputeGameAddress = gameData.proxy_
//     faultDisputeGameContract = new Contract(
//       faultDisputeGameAddress,
//       FaultDisputeGameArtifact.abi,
//       s.mainnetProvider,
//     )
//     const faultDisputeGameResolvedEvents =
//       await faultDisputeGameContract.queryFilter(
//         faultDisputeGameContract.getEvent('Resolved'),
//       )
//     if (faultDisputeGameResolvedEvents.length !== 0) {
//       blockNumber = await faultDisputeGameContract.l2BlockNumber()
//       break
//     }
//     gameIndex -= 1n
//   }
//   // Get the Output Index and Block Number from L2 OUTPUT ORACLE that was sent before this block
//   // Get the event from the latest Block checking transaction hash
//   console.log('BlockNumber from Base L2 OutputOracle: ', blockNumber)
//   const l2OutputOracleEvents = await s.baseSettlementContractHelix.queryFilter(
//     s.baseSettlementContractHelix.getEvent('OutputProposed'),
//     toQuantity(blockNumber - 200n),
//     toQuantity(blockNumber),
//   )
//   const l3OutputIndex = toNumber(
//     l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[2],
//   )
//   const l3BlockNumber = BigInt(
//     l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[3],
//   )

//   return {
//     blockNumber,
//     gameIndex,
//     faultDisputeGameAddress,
//     faultDisputeGameContract,
//     l3OutputIndex,
//     l3BlockNumber,
//   }
// }

export async function getBatchSettledBaseBedrock() {
  console.log('In getBatchSettled')
  // Get the Output Index and Block Number from L2 OUTPUT ORACLE that was sent before this block
  // Get the event from the latest Block checking transaction hash
  const blockNumber = BigInt(await s.mainnetProvider.getBlockNumber())
  const l2OutputOracleEvents =
    await s.mainnetSettlementContractBase.queryFilter(
      s.mainnetSettlementContractBase.getEvent('OutputProposed'),
      toQuantity(blockNumber - 2000n),
      toQuantity(blockNumber),
    )
  console.log(
    'l2OuputOraclEvent: ',
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].blockNumber,
  )
  const endBatchBlockData = await s.mainnetProvider.getBlock(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].blockNumber,
  )
  const l2OutputIndex = toNumber(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[2],
  )
  const l2BlockNumber = BigInt(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[3],
  )

  return {
    endBatchBlockData,
    l2OutputIndex,
    l2BlockNumber,
  }
}

export async function getBatchSettledHelixBedrock(l2BlockNumber) {
  console.log('In getBatchSettled')
  // Get the Output Index and Block Number from L2 OUTPUT ORACLE that was sent before this block
  // Get the event from the latest Block checking transaction hash
  // const blockNumber = BigInt(await s.mainnetProvider.getBlockNumber())
  const l2OutputOracleEvents = await s.baseSettlementContractHelix.queryFilter(
    s.mainnetSettlementContractBase.getEvent('OutputProposed'),
    toQuantity(l2BlockNumber - 2000n),
    toQuantity(l2BlockNumber),
  )
  console.log(
    'l2OuputOraclEvent: ',
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].blockNumber,
  )
  const l3endBatchBlockData = await s.mainnetProvider.getBlock(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].blockNumber,
  )
  const l3OutputIndex = toNumber(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[2],
  )
  const l3BlockNumber = BigInt(
    l2OutputOracleEvents[l2OutputOracleEvents.length - 1].topics[3],
  )

  return {
    l3endBatchBlockData,
    l3OutputIndex,
    l3BlockNumber,
  }
}

export async function getIntentsToProve(
  settlementBlockNumber: BigInt,
  proveAll: boolean,
) {
  // get Base Last OptimimsmMainnet BlockNumber from WorldState

  const sourceChainConfig = networks.helix.sourceChains
  const sourceChains: Record<number, SourceChainInfo> = {}
  // get the starting block to scan for intents
  let helixProvenState
  let scanAllIntentsForInbox = false
  // TODO change to use contract factory for deploys then can use ethers deploymentTransaction to get the blockNumber
  let startingBlockNumber = networks.helix.inbox.deploymentBlock || 0n
  const inboxDeploymentBlock = networks.helix.inbox.deploymentBlock || 0n
  // TODO: Parmaeterize the calls to provenStates and remove switch
  for (const sourceChain of sourceChainConfig) {
    const sourceChainInfo: SourceChainInfo = {} as SourceChainInfo
    try {
      sourceChainInfo.sourceChain = networkIds[sourceChain]
      // @ts-ignore
      const proverContract = s[`${sourceChain}ProverContract`] as Contract
      helixProvenState = await proverContract.provenStates(networkIds.helix)
      sourceChainInfo.lastProvenBlock = helixProvenState.blockNumber
      if (proveAll) {
        sourceChainInfo.lastProvenBlock = inboxDeploymentBlock
        sourceChainInfo.needNewProvenState = true
        startingBlockNumber = inboxDeploymentBlock
        scanAllIntentsForInbox = true
      } else {
        if (helixProvenState.blockNumber > inboxDeploymentBlock) {
          sourceChainInfo.lastProvenBlock = helixProvenState.blockNumber
          if (helixProvenState.blockNumber < startingBlockNumber) {
            startingBlockNumber = helixProvenState.blockNumber
          }
        } else {
          sourceChainInfo.lastProvenBlock = inboxDeploymentBlock
          scanAllIntentsForInbox = true
        }
      }
      sourceChainInfo.needNewProvenState = false
      sourceChains[networkIds[sourceChain]] = sourceChainInfo
    } catch (e) {
      sourceChainInfo.lastProvenBlock = inboxDeploymentBlock
      sourceChainInfo.needNewProvenState = false
      sourceChains[networkIds[sourceChain]] = sourceChainInfo
      scanAllIntentsForInbox = true
      startingBlockNumber = inboxDeploymentBlock
      console.log('Error in getIntentsToProve: ', e.message)
    }
  }
  if (scanAllIntentsForInbox) {
    startingBlockNumber = inboxDeploymentBlock
  }
  // Get the event from the latest Block checking transaction hash
  const intentHashEvents = await s.helixInboxContractSolver.queryFilter(
    s.helixInboxContractSolver.getEvent('Fulfillment'),
    toQuantity(startingBlockNumber),
    toQuantity(settlementBlockNumber),
  )
  // Filter out intents that have already been proven
  // Note this can use the proventStates from the Prover Contract
  // but also need to cater for the case where the proven World state is updated but the intents not proven
  // also mark needProvenState as true for the chains which have new intents to prove
  const intentsToProve = intentHashEvents
    .map((intentHashEvent) => {
      const intentToProve: Intent = {} as Intent
      intentToProve.sourceChain = toNumber(intentHashEvent.topics[2])
      intentToProve.intentHash = intentHashEvent.topics[1]
      intentToProve.claimant = getAddress(
        stripZerosLeft(intentHashEvent.topics[3]),
      )
      intentToProve.blockNumber = BigInt(intentHashEvent.blockNumber)
      return intentToProve
    })
    .filter((intentToProve) => {
      if (
        intentToProve.blockNumber >
          sourceChains[intentToProve.sourceChain].lastProvenBlock &&
        intentToProve.blockNumber <= settlementBlockNumber
      ) {
        sourceChains[intentToProve.sourceChain].needNewProvenState = true
      }
      // False removes it true keeps it
      return (
        intentToProve.blockNumber >
        sourceChains[intentToProve.sourceChain].lastProvenBlock
      )
    })

  return { sourceChains, intentsToProve }
  // return [chainId, intentHash, intentFulfillTransaction]
}

// Include individual proving Mechanisms for each sourceChain

// TODO: Consolidate the multiple functions into a parameterized function

async function proveMainnetSettlementLayerStateOnBase() {
  console.log('In proveSettlementLayerState on Base')
  const setlementBlock = await s.basel1Block.number()
  const settlementBlockTag = toQuantity(setlementBlock)

  const block: Block = await s.mainnetProvider.send('eth_getBlockByNumber', [
    settlementBlockTag,
    false,
  ])

  let tx
  let settlementWorldStateRoot
  try {
    const rlpEncodedBlockData = encodeRlp([
      block.parentHash,
      block.sha3Uncles,
      block.miner,
      block.stateRoot,
      block.transactionsRoot,
      block.receiptsRoot,
      block.logsBloom,
      stripZerosLeft(toBeHex(block.difficulty)), // Add stripzeros left here
      toBeHex(block.number),
      toBeHex(block.gasLimit),
      toBeHex(block.gasUsed),
      block.timestamp,
      block.extraData,
      block.mixHash,
      block.nonce,
      toBeHex(block.baseFeePerGas),
      block.withdrawalsRoot,
      stripZerosLeft(toBeHex(block.blobGasUsed)),
      stripZerosLeft(toBeHex(block.excessBlobGas)),
      block.parentBeaconBlockRoot,
    ])
    tx = await s.baseProverContract.proveSettlementLayerState(
      getBytes(hexlify(rlpEncodedBlockData)),
    )
    await tx.wait()
    console.log('Prove Settlement world state tx: ', tx.hash)
    settlementWorldStateRoot = block.stateRoot
    console.log(
      'Proven L1 world state block: ',
      setlementBlock,
      settlementBlockTag,
    )
    console.log(
      'Proven Settlement world state root base:',
      settlementWorldStateRoot,
    )
    return { settlementBlockTag, settlementWorldStateRoot }
  } catch (e) {
    if (e.data && s.optimismProverContract) {
      const decodedError = s.optimismProverContract.interface.parseError(e.data)
      console.log(`Transaction failed: ${decodedError?.name}`)
      console.log(
        `Error in proveSettlementLayerState Optimism:`,
        e.shortMessage,
      )
    } else {
      console.log(`Error in proveSettlementLayerState Optimism:`, e)
    }
  }
  //   have successfully proven L1 state
}

async function proveMainnetSettlementLayerStateOnOptimism() {
  console.log('In proveSettlementLayerState on Optimism')
  const setlementBlock = await s.optimisml1Block.number()
  const settlementBlockTag = toQuantity(setlementBlock)

  const block: Block = await s.mainnetProvider.send('eth_getBlockByNumber', [
    settlementBlockTag,
    false,
  ])

  let tx
  let settlementWorldStateRoot
  try {
    const rlpEncodedBlockData = encodeRlp([
      block.parentHash,
      block.sha3Uncles,
      block.miner,
      block.stateRoot,
      block.transactionsRoot,
      block.receiptsRoot,
      block.logsBloom,
      stripZerosLeft(toBeHex(block.difficulty)), // Add stripzeros left here
      toBeHex(block.number),
      toBeHex(block.gasLimit),
      toBeHex(block.gasUsed),
      block.timestamp,
      block.extraData,
      block.mixHash,
      block.nonce,
      toBeHex(block.baseFeePerGas),
      block.withdrawalsRoot,
      stripZerosLeft(toBeHex(block.blobGasUsed)),
      stripZerosLeft(toBeHex(block.excessBlobGas)),
      block.parentBeaconBlockRoot,
    ])
    tx = await s.optimismProverContract.proveSettlementLayerState(
      getBytes(hexlify(rlpEncodedBlockData)),
    )
    await tx.wait()
    console.log('Prove Settlement world state tx: ', tx.hash)
    settlementWorldStateRoot = block.stateRoot
    console.log(
      'Proven L1 world state block: ',
      setlementBlock,
      settlementBlockTag,
    )
    console.log(
      'Proven Settlement world state root optimism:',
      settlementWorldStateRoot,
    )
    return { settlementBlockTag, settlementWorldStateRoot }
  } catch (e) {
    if (e.data && s.optimismProverContract) {
      const decodedError = s.optimismProverContract.interface.parseError(e.data)
      console.log(`Transaction failed: ${decodedError?.name}`)
      console.log(
        `Error in proveSettlementLayerState Optimism:`,
        e.shortMessage,
      )
    } else {
      console.log(`Error in proveSettlementLayerState Optimism:`, e)
    }
  }
  //   have successfully proven L1 state
}

// async function proveWorldStateBaseOnBase(
//   settlementBlockTag,
//   settlementStateRoot,
//   faultDisputeGameAddress,
//   faultDisputeGameContract,
//   gameIndex,
// ) {
//   console.log('In proveWorldStateBaseOnBase')
//   // For more information on how DisputeGameFactory utility functions, see the following code
//   // https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/lib/LibUDT.sol#L82
//   // get the endBatchBlockData

//   // Note: For all proofs we use two block numbers
//   // For anything related to the settlement chain we use settlementBlockTag
//   // For anything related to the destination chain we use endBatchBlockHex
//   // Get the faultDisputeGame game data
//   const faultDisputeGameData = await faultDisputeGameContract.gameData()
//   const faultDisputeGameCreatedAt = await faultDisputeGameContract.createdAt()
//   const faultDisputeGameResolvedAt = await faultDisputeGameContract.resolvedAt()
//   const faultDisputeGameGameStatus = await faultDisputeGameContract.status()
//   const faultDisputeGameInitialized = true
//   const faultDisputeGameL2BlockNumberChallenged = false
//   const faultDisputeGameL2BlockNumber =
//     await faultDisputeGameContract.l2BlockNumber()
//   const endBatchBlockHex = toQuantity(faultDisputeGameL2BlockNumber)
//   const endBatchBlockData = await s.baseProvider.send('eth_getBlockByNumber', [
//     endBatchBlockHex,
//     false,
//   ])
//   const rlpEncodedEndBatchBlockData =
//     await getRLPEncodedBlock(endBatchBlockData)

//   // Get the Message Parser State Root at the end block of the batch
//   const l2MesagePasserProof = await s.baseProvider.send('eth_getProof', [
//     networks.base.proving.l2l1MessageParserAddress,
//     [],
//     endBatchBlockHex,
//   ])

//   // Get the DisputeGameFactory data GameId
//   const faultDisputeGameId = await s.baseProverContract.pack(
//     faultDisputeGameData.gameType_,
//     faultDisputeGameCreatedAt,
//     faultDisputeGameAddress,
//   )

//   // disputeGameFactoryStorageSlot is where the gameId is stored
//   // In solidity
//   // uint256(keccak256(abi.encode(L2_DISPUTE_GAME_FACTORY_LIST_SLOT_NUMBER)))
//   //                       + disputeGameFactoryProofData.gameIndex
//   const disputeGameFactorySlotNumber = 104
//   const disputeGameFactoryGameIndex = gameIndex
//   const arrayLengthSlot = zeroPadValue(
//     toBeArray(disputeGameFactorySlotNumber),
//     32,
//   )
//   const firstElementSlot = solidityPackedKeccak256(
//     ['bytes32'],
//     [arrayLengthSlot],
//   )
//   const disputeGameFactoryStorageSlot = toBeHex(
//     BigInt(firstElementSlot) + BigInt(Number(disputeGameFactoryGameIndex)),
//     32,
//   )
//   const disputeGameFactoryProof = await s.mainnetProvider.send('eth_getProof', [
//     networks.mainnet.settlementContracts.base,
//     [disputeGameFactoryStorageSlot],
//     settlementBlockTag,
//   ])
//   const disputeGameFactoryContractData = [
//     toBeHex(disputeGameFactoryProof.nonce), // nonce
//     stripZerosLeft(toBeHex(disputeGameFactoryProof.balance)), // balance
//     disputeGameFactoryProof.storageHash, // storageHash
//     disputeGameFactoryProof.codeHash, // CodeHash
//   ]
//   const RLPEncodedDisputeGameFactoryData =
//     await s.baseProverContract.rlpEncodeDataLibList(
//       disputeGameFactoryContractData,
//     )
//   // populate fields for the DisputeGameFactory proof
//   const disputeGameFactoryProofData = {
//     messagePasserStateRoot: l2MesagePasserProof.storageHash,
//     latestBlockHash: endBatchBlockData.hash,
//     gameIndex: disputeGameFactoryGameIndex,
//     gameId: faultDisputeGameId,
//     disputeFaultGameStorageProof: disputeGameFactoryProof.storageProof[0].proof,
//     rlpEncodedDisputeGameFactoryData: RLPEncodedDisputeGameFactoryData,
//     disputeGameFactoryAccountProof: disputeGameFactoryProof.accountProof,
//   }

//   // populate fields for the FaultDisputeGame rootclaim proof
//   // Storage proof for faultDisputeGame root claim
//   // rootClaimSlot - hardcooded value for the slot which is a keecak256 hash  the slot for rootClaim

//   const faultDisputeGameRootClaimStorageSlot =
//     '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
//   const faultDisputeGameRootClaimProof = await s.mainnetProvider.send(
//     'eth_getProof',
//     [
//       faultDisputeGameAddress,
//       [faultDisputeGameRootClaimStorageSlot],
//       settlementBlockTag,
//     ],
//   )
//   // Storage proof for faultDisputeGame resolved
//   // rootClaimSlot - hardcoded value for slot zero which is where the status is stored
//   const faultDisputeGameResolvedStorageSlot =
//     '0x0000000000000000000000000000000000000000000000000000000000000000'
//   // '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
//   const faultDisputeGameRootResolvedProof = await s.mainnetProvider.send(
//     'eth_getProof',
//     [
//       faultDisputeGameAddress,
//       [faultDisputeGameResolvedStorageSlot],
//       settlementBlockTag,
//     ],
//   )
//   const faultDisputeGameContractData = [
//     toBeHex(faultDisputeGameRootClaimProof.nonce), // nonce
//     stripZerosLeft(toBeHex(faultDisputeGameRootClaimProof.balance)), // balance
//     faultDisputeGameRootClaimProof.storageHash, // storageHash
//     faultDisputeGameRootClaimProof.codeHash, // CodeHash
//   ]
//   const RLPEncodedFaultDisputeGameContractData =
//     await s.baseProverContract.rlpEncodeDataLibList(
//       faultDisputeGameContractData,
//     )
//   const faultDisputeGameProofData = {
//     // faultDisputeGameStateRoot: endBatchBlockData.stateRoot,
//     faultDisputeGameStateRoot: faultDisputeGameRootClaimProof.storageHash,
//     faultDisputeGameRootClaimStorageProof:
//       faultDisputeGameRootClaimProof.storageProof[0].proof,
//     faultDisputeGameStatusSlotData: {
//       createdAt: faultDisputeGameCreatedAt,
//       resolvedAt: faultDisputeGameResolvedAt,
//       gameStatus: faultDisputeGameGameStatus,
//       initialized: faultDisputeGameInitialized,
//       l2BlockNumberChallenged: faultDisputeGameL2BlockNumberChallenged,
//     },
//     // populate fields for the FaultDisputeGame resolved proof
//     faultDisputeGameStatusStorageProof:
//       faultDisputeGameRootResolvedProof.storageProof[0].proof,
//     rlpEncodedFaultDisputeGameData: RLPEncodedFaultDisputeGameContractData,
//     faultDisputeGameAccountProof: faultDisputeGameRootClaimProof.accountProof,
//   }

//   // try {
//   // Note: ProveStorage and ProveAccount are pure functions and included here just for unit testing
//   const { gameProxy_ } = await s.baseProverContract.unpack(
//     disputeGameFactoryProofData.gameId,
//   )
//   // proveStorageDisputeGameFactory
//   await s.baseProverContract.proveStorage(
//     disputeGameFactoryStorageSlot,
//     encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameId))),
//     // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
//     disputeGameFactoryProof.storageProof[0].proof,
//     disputeGameFactoryProof.storageHash,
//   )
//   // proveAccountDisputeGameFactory
//   await s.baseProverContract.proveAccount(
//     networks.mainnet.settlementContracts.base,
//     disputeGameFactoryProofData.rlpEncodedDisputeGameFactoryData,
//     disputeGameFactoryProofData.disputeGameFactoryAccountProof,
//     settlementStateRoot,
//   )
//   // proveStorageFaultDisputeGameRootClaim
//   await s.baseProverContract.proveStorage(
//     faultDisputeGameRootClaimStorageSlot,
//     encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameData.rootClaim_))),
//     // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
//     faultDisputeGameRootClaimProof.storageProof[0].proof,
//     faultDisputeGameRootClaimProof.storageHash,
//   )
//   // proveStorageFaultDisputeGameResolved
//   await s.baseProverContract.proveStorage(
//     faultDisputeGameResolvedStorageSlot,
//     await s.baseProverContract.assembleGameStatusStorage(
//       faultDisputeGameCreatedAt,
//       faultDisputeGameResolvedAt,
//       faultDisputeGameGameStatus,
//       faultDisputeGameInitialized,
//       faultDisputeGameL2BlockNumberChallenged,
//     ),
//     faultDisputeGameRootResolvedProof.storageProof[0].proof,
//     faultDisputeGameRootResolvedProof.storageHash,
//   )
//   // proveAccountFaultDisputeGame
//   await s.baseProverContract.proveAccount(
//     // faultDisputeGameAddress,
//     // '0x4D664dd0f78673034b29E4A51177333D1131Ac44',
//     gameProxy_,
//     faultDisputeGameProofData.rlpEncodedFaultDisputeGameData,
//     faultDisputeGameProofData.faultDisputeGameAccountProof,
//     settlementStateRoot,
//   )
//   try {
//     const proveWorldStateCannonTx =
//       await s.baseProverContract.proveWorldStateCannon(
//         networkIds.base,
//         rlpEncodedEndBatchBlockData,
//         endBatchBlockData.stateRoot,
//         disputeGameFactoryProofData,
//         faultDisputeGameProofData,
//         settlementStateRoot,
//       )
//     await proveWorldStateCannonTx.wait()
//     console.log('ProveWorldStateCannon Base to Base')
//     return endBatchBlockData
//   } catch (e) {
//     if (e.data && s.baseProverContract) {
//       const decodedError = s.baseProverContract.interface.parseError(e.data)
//       console.log(`Transaction failed: ${decodedError?.name}`)
//       console.log(`Error in ProveWorldStateCannon base:`, e.shortMessage)
//     } else {
//       console.log(`Error in ProveWorldStateCannon base:`, e)
//     }
//   }
// }

async function proveWorldStateBedrockOnBaseforHelix(
  l3OutputIndex,
  l3BlockNumber,
  settlementBlockTag,
  settlementWorldStateRoot,
) {
  console.log('In proveWorldStateBedrockOnBaseforHelix')
  const endBatchBlockHex = toQuantity(l3BlockNumber)
  // const endBatchBlockHex = l3BlockNumber
  console.log('End Batch Block Number: ', endBatchBlockHex)
  const endBatchBlockData = await s.helixProvider.send('eth_getBlockByNumber', [
    endBatchBlockHex,
    false,
  ])
  const rlpEncodedBlockData = await getRLPEncodedBlock(endBatchBlockData)
  const l1BatchIndex = l3OutputIndex
  console.log('l1BatchIndex: ', l1BatchIndex)
  // Get the Message Parser State Root at the end block of the batch
  const l2MesagePasserProof = await s.helixProvider.send('eth_getProof', [
    networks.helix.proving.l2l1MessageParserAddress,
    [],
    endBatchBlockHex,
  ])
  // Get the storage Slot information
  // l1BatchSlot = calculated from the batch number *2 + output slot 3
  // In Solidity
  // bytes32 outputRootStorageSlot =
  // bytes32(abi.encode((uint256(keccak256(abi.encode(L2_OUTPUT_SLOT_NUMBER))) + l2OutputIndex * 2)));
  const arrayLengthSlot = zeroPadValue(
    toBeArray(networks.helix.proving.l2OutputOracleSlotNumber),
    32,
  )
  const firstElementSlot = solidityPackedKeccak256(
    ['bytes32'],
    [arrayLengthSlot],
  )
  const l1BatchSlot = toBeHex(
    BigInt(firstElementSlot) + BigInt(Number(l1BatchIndex) * 2),
    32,
  )

  const layer1HelixOutputOracleProof = await s.baseProvider.send(
    'eth_getProof',
    [
      networks.base.settlementContracts.helix,
      [l1BatchSlot],
      settlementBlockTag,
    ],
  )
  const layer1HelixOutputOracleContractData = [
    toBeHex(layer1HelixOutputOracleProof.nonce), // nonce
    stripZerosLeft(toBeHex(layer1HelixOutputOracleProof.balance)), // balance
    layer1HelixOutputOracleProof.storageHash, // storageHash
    layer1HelixOutputOracleProof.codeHash, // CodeHash
  ]
  try {
    const proveOutputTX = await s.baseProverContract.proveWorldStateBedrock(
      networkIds.helix,
      rlpEncodedBlockData,
      endBatchBlockData.stateRoot,
      l2MesagePasserProof.storageHash,
      // endBatchBlockData.hash,
      l1BatchIndex,
      layer1HelixOutputOracleProof.storageProof[0].proof,
      await s.baseProverContract.rlpEncodeDataLibList(
        layer1HelixOutputOracleContractData,
      ),
      layer1HelixOutputOracleProof.accountProof,
      settlementWorldStateRoot,
    )
    await proveOutputTX.wait()
    console.log('Prove Bedrock L3 World State base tx: ', proveOutputTX.hash)
    return endBatchBlockData
  } catch (e) {
    if (e.data && s.baseProverContract) {
      const decodedError = s.baseProverContract.interface.parseError(e.data)
      console.log(
        `Transaction failed in proveWorldStateBedrock base: ${decodedError?.name}`,
      )
      console.log('Error: ', e)
      console.log(`Error in proveWorldStateBedrock base:`, e.shortMessage)
    } else {
      console.log(`Error in proveWorldStateBedrock base:`, e)
    }
  }
}

// async function proveWorldStateBaseOnOptimism(
//   settlementBlockTag,
//   settlementStateRoot,
//   faultDisputeGameAddress,
//   faultDisputeGameContract,
//   gameIndex,
// ) {
//   console.log('In proveWorldStateCannonBaseToOptimism')
//   // For more information on how DisputeGameFactory utility functions, see the following code
//   // https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/lib/LibUDT.sol#L82
//   // get the endBatchBlockData

//   // Note: For all proofs we use two block numbers
//   // For anything related to the settlement chain we use settlementBlockTag
//   // For anything related to the destination chain we use endBatchBlockHex
//   // Get the faultDisputeGame game data
//   const faultDisputeGameData = await faultDisputeGameContract.gameData()
//   const faultDisputeGameCreatedAt = await faultDisputeGameContract.createdAt()
//   const faultDisputeGameResolvedAt = await faultDisputeGameContract.resolvedAt()
//   const faultDisputeGameGameStatus = await faultDisputeGameContract.status()
//   const faultDisputeGameInitialized = true
//   const faultDisputeGameL2BlockNumberChallenged = false
//   const faultDisputeGameL2BlockNumber =
//     await faultDisputeGameContract.l2BlockNumber()
//   const endBatchBlockHex = toQuantity(faultDisputeGameL2BlockNumber)
//   const endBatchBlockData = await s.baseProvider.send('eth_getBlockByNumber', [
//     endBatchBlockHex,
//     false,
//   ])
//   const rlpEncodedEndBatchBlockData =
//     await getRLPEncodedBlock(endBatchBlockData)

//   // Get the Message Parser State Root at the end block of the batch
//   const l2MesagePasserProof = await s.baseProvider.send('eth_getProof', [
//     networks.base.proving.l2l1MessageParserAddress,
//     [],
//     endBatchBlockHex,
//   ])

//   // Get the DisputeGameFactory data GameId
//   const faultDisputeGameId = await s.optimismProverContract.pack(
//     faultDisputeGameData.gameType_,
//     faultDisputeGameCreatedAt,
//     faultDisputeGameAddress,
//   )

//   // disputeGameFactoryStorageSlot is where the gameId is stored
//   // In solidity
//   // uint256(keccak256(abi.encode(L2_DISPUTE_GAME_FACTORY_LIST_SLOT_NUMBER)))
//   //                       + disputeGameFactoryProofData.gameIndex
//   const disputeGameFactorySlotNumber = 104
//   const disputeGameFactoryGameIndex = gameIndex
//   const arrayLengthSlot = zeroPadValue(
//     toBeArray(disputeGameFactorySlotNumber),
//     32,
//   )
//   const firstElementSlot = solidityPackedKeccak256(
//     ['bytes32'],
//     [arrayLengthSlot],
//   )
//   const disputeGameFactoryStorageSlot = toBeHex(
//     BigInt(firstElementSlot) + BigInt(Number(disputeGameFactoryGameIndex)),
//     32,
//   )
//   const disputeGameFactoryProof = await s.mainnetProvider.send('eth_getProof', [
//     networks.mainnet.settlementContracts.base,
//     [disputeGameFactoryStorageSlot],
//     settlementBlockTag,
//   ])
//   const disputeGameFactoryContractData = [
//     toBeHex(disputeGameFactoryProof.nonce), // nonce
//     stripZerosLeft(toBeHex(disputeGameFactoryProof.balance)), // balance
//     disputeGameFactoryProof.storageHash, // storageHash
//     disputeGameFactoryProof.codeHash, // CodeHash
//   ]
//   const RLPEncodedDisputeGameFactoryData =
//     await s.optimismProverContract.rlpEncodeDataLibList(
//       disputeGameFactoryContractData,
//     )
//   // populate fields for the DisputeGameFactory proof
//   const disputeGameFactoryProofData = {
//     messagePasserStateRoot: l2MesagePasserProof.storageHash,
//     latestBlockHash: endBatchBlockData.hash,
//     gameIndex: disputeGameFactoryGameIndex,
//     gameId: faultDisputeGameId,
//     disputeFaultGameStorageProof: disputeGameFactoryProof.storageProof[0].proof,
//     rlpEncodedDisputeGameFactoryData: RLPEncodedDisputeGameFactoryData,
//     disputeGameFactoryAccountProof: disputeGameFactoryProof.accountProof,
//   }

//   // populate fields for the FaultDisputeGame rootclaim proof
//   // Storage proof for faultDisputeGame root claim
//   // rootClaimSlot - hardcooded value for the slot which is a keecak256 hash  the slot for rootClaim

//   const faultDisputeGameRootClaimStorageSlot =
//     '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
//   const faultDisputeGameRootClaimProof = await s.mainnetProvider.send(
//     'eth_getProof',
//     [
//       faultDisputeGameAddress,
//       [faultDisputeGameRootClaimStorageSlot],
//       settlementBlockTag,
//     ],
//   )
//   // Storage proof for faultDisputeGame resolved
//   // rootClaimSlot - hardcoded value for slot zero which is where the status is stored
//   const faultDisputeGameResolvedStorageSlot =
//     '0x0000000000000000000000000000000000000000000000000000000000000000'
//   // '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
//   const faultDisputeGameRootResolvedProof = await s.mainnetProvider.send(
//     'eth_getProof',
//     [
//       faultDisputeGameAddress,
//       [faultDisputeGameResolvedStorageSlot],
//       settlementBlockTag,
//     ],
//   )
//   const faultDisputeGameContractData = [
//     toBeHex(faultDisputeGameRootClaimProof.nonce), // nonce
//     stripZerosLeft(toBeHex(faultDisputeGameRootClaimProof.balance)), // balance
//     faultDisputeGameRootClaimProof.storageHash, // storageHash
//     faultDisputeGameRootClaimProof.codeHash, // CodeHash
//   ]
//   const RLPEncodedFaultDisputeGameContractData =
//     await s.optimismProverContract.rlpEncodeDataLibList(
//       faultDisputeGameContractData,
//     )
//   const faultDisputeGameProofData = {
//     // faultDisputeGameStateRoot: endBatchBlockData.stateRoot,
//     faultDisputeGameStateRoot: faultDisputeGameRootClaimProof.storageHash,
//     faultDisputeGameRootClaimStorageProof:
//       faultDisputeGameRootClaimProof.storageProof[0].proof,
//     faultDisputeGameStatusSlotData: {
//       createdAt: faultDisputeGameCreatedAt,
//       resolvedAt: faultDisputeGameResolvedAt,
//       gameStatus: faultDisputeGameGameStatus,
//       initialized: faultDisputeGameInitialized,
//       l2BlockNumberChallenged: faultDisputeGameL2BlockNumberChallenged,
//     },
//     // populate fields for the FaultDisputeGame resolved proof
//     faultDisputeGameStatusStorageProof:
//       faultDisputeGameRootResolvedProof.storageProof[0].proof,
//     rlpEncodedFaultDisputeGameData: RLPEncodedFaultDisputeGameContractData,
//     faultDisputeGameAccountProof: faultDisputeGameRootClaimProof.accountProof,
//   }

//   // try {
//   // Note: ProveStorage and ProveAccount are pure functions and included here just for unit testing
//   const { gameProxy_ } = await s.optimismProverContract.unpack(
//     disputeGameFactoryProofData.gameId,
//   )
//   // proveStorageDisputeGameFactory
//   await s.optimismProverContract.proveStorage(
//     disputeGameFactoryStorageSlot,
//     encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameId))),
//     // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
//     disputeGameFactoryProof.storageProof[0].proof,
//     disputeGameFactoryProof.storageHash,
//   )
//   // proveAccountDisputeGameFactory
//   await s.optimismProverContract.proveAccount(
//     networks.mainnet.settlementContracts.base,
//     disputeGameFactoryProofData.rlpEncodedDisputeGameFactoryData,
//     disputeGameFactoryProofData.disputeGameFactoryAccountProof,
//     settlementStateRoot,
//   )
//   // proveStorageFaultDisputeGameRootClaim
//   await s.optimismProverContract.proveStorage(
//     faultDisputeGameRootClaimStorageSlot,
//     encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameData.rootClaim_))),
//     // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
//     faultDisputeGameRootClaimProof.storageProof[0].proof,
//     faultDisputeGameRootClaimProof.storageHash,
//   )
//   // proveStorageFaultDisputeGameResolved
//   await s.optimismProverContract.proveStorage(
//     faultDisputeGameResolvedStorageSlot,
//     await s.optimismProverContract.assembleGameStatusStorage(
//       faultDisputeGameCreatedAt,
//       faultDisputeGameResolvedAt,
//       faultDisputeGameGameStatus,
//       faultDisputeGameInitialized,
//       faultDisputeGameL2BlockNumberChallenged,
//     ),
//     faultDisputeGameRootResolvedProof.storageProof[0].proof,
//     faultDisputeGameRootResolvedProof.storageHash,
//   )
//   // proveAccountFaultDisputeGame
//   await s.optimismProverContract.proveAccount(
//     // faultDisputeGameAddress,
//     // '0x4D664dd0f78673034b29E4A51177333D1131Ac44',
//     gameProxy_,
//     faultDisputeGameProofData.rlpEncodedFaultDisputeGameData,
//     faultDisputeGameProofData.faultDisputeGameAccountProof,
//     settlementStateRoot,
//   )
//   try {
//     const proveWorldStateCannonTx =
//       await s.optimismProverContract.proveWorldStateCannon(
//         networkIds.base,
//         rlpEncodedEndBatchBlockData,
//         endBatchBlockData.stateRoot,
//         disputeGameFactoryProofData,
//         faultDisputeGameProofData,
//         settlementStateRoot,
//       )
//     await proveWorldStateCannonTx.wait()
//     console.log('ProveWorldStateCannon Base to Optimism')
//     return endBatchBlockData
//   } catch (e) {
//     if (e.data && s.optimismProverContract) {
//       const decodedError = s.optimismProverContract.interface.parseError(e.data)
//       console.log(`Transaction failed: ${decodedError?.name}`)
//       console.log(`Error in ProveWorldStateCannon base:`, e.shortMessage)
//     } else {
//       console.log(`Error in ProveWorldStateCannon base:`, e)
//     }
//   }
// }

async function proveWorldStateBedrockOnOptimismForBase(
  l2OutputIndex,
  l2BlockNumber,
  settlementBlockTag,
  settlementWorldStateRoot,
) {
  console.log('In proveWorldStateBedrockOnOptimismForBase')
  const endBatchBlockHex = toQuantity(l2BlockNumber)
  // const endBatchBlockHex = l3BlockNumber
  console.log('End Batch Block Number: ', endBatchBlockHex)
  const l2EndBatchBlockData = await s.baseProvider.send(
    'eth_getBlockByNumber',
    [endBatchBlockHex, false],
  )
  const rlpEncodedBlockData = await getRLPEncodedBlock(l2EndBatchBlockData)
  const l1BatchIndex = l2OutputIndex
  console.log('l1BatchIndex: ', l1BatchIndex)
  // Get the Message Parser State Root at the end block of the batch
  const l2MesagePasserProof = await s.baseProvider.send('eth_getProof', [
    networks.base.proving.l2l1MessageParserAddress,
    [],
    endBatchBlockHex,
  ])
  // Get the storage Slot information
  // l1BatchSlot = calculated from the batch number *2 + output slot 3
  // In Solidity
  // bytes32 outputRootStorageSlot =
  // bytes32(abi.encode((uint256(keccak256(abi.encode(L2_OUTPUT_SLOT_NUMBER))) + l2OutputIndex * 2)));
  const arrayLengthSlot = zeroPadValue(
    toBeArray(networks.base.proving.l2OutputOracleSlotNumber),
    32,
  )
  const firstElementSlot = solidityPackedKeccak256(
    ['bytes32'],
    [arrayLengthSlot],
  )
  const l1BatchSlot = toBeHex(
    BigInt(firstElementSlot) + BigInt(Number(l1BatchIndex) * 2),
    32,
  )

  const layer1BaseOutputOracleProof = await s.mainnetProvider.send(
    'eth_getProof',
    [
      networks.mainnet.settlementContracts.base,
      [l1BatchSlot],
      settlementBlockTag,
    ],
  )
  const layer1BaseOutputOracleContractData = [
    toBeHex(layer1BaseOutputOracleProof.nonce), // nonce
    stripZerosLeft(toBeHex(layer1BaseOutputOracleProof.balance)), // balance
    layer1BaseOutputOracleProof.storageHash, // storageHash
    layer1BaseOutputOracleProof.codeHash, // CodeHash
  ]
  try {
    console.log('Proving World State Bedrock on Optimism')
    console.log('Network ID: ', networkIds.base)
    console.log('RLP Encoded Block Data: ', rlpEncodedBlockData)
    console.log('End Batch Block Data: ', l2EndBatchBlockData.stateRoot)
    console.log('Message Passer Proof: ', l2MesagePasserProof.storageHash)
    console.log('L1 Batch Index: ', l1BatchIndex)
    console.log(
      'Layer1 Base Output Oracle Proof: ',
      layer1BaseOutputOracleProof.storageProof[0].proof,
    )
    console.log(
      'Layer1 Base Output Oracle Contract Data: ',
      await s.optimismProverContract.rlpEncodeDataLibList(
        layer1BaseOutputOracleContractData,
      ),
    )
    console.log(
      'Layer1 Base Output Oracle Proof: ',
      layer1BaseOutputOracleProof.accountProof,
    )
    console.log('Settlement World State Root: ', settlementWorldStateRoot)
    const proveOutputTX = await s.optimismProverContract.proveWorldStateBedrock(
      networkIds.base,
      rlpEncodedBlockData,
      l2EndBatchBlockData.stateRoot,
      l2MesagePasserProof.storageHash,
      // endBatchBlockData.hash,
      l1BatchIndex,
      layer1BaseOutputOracleProof.storageProof[0].proof,
      await s.optimismProverContract.rlpEncodeDataLibList(
        layer1BaseOutputOracleContractData,
      ),
      layer1BaseOutputOracleProof.accountProof,
      settlementWorldStateRoot,
    )
    await proveOutputTX.wait()
    console.log(
      'Prove Bedrock L2 World State base on Optimism tx: ',
      proveOutputTX.hash,
    )
    return l2EndBatchBlockData
  } catch (e) {
    if (e.data && s.optimismProverContract) {
      const decodedError = s.optimismProverContract.interface.parseError(e.data)
      console.log(
        `Transaction failed in proveWorldStateBedrock base on Optimism: ${decodedError?.name}`,
      )
      console.log('Error: ', e)
      console.log(
        `Error in proveWorldStateBedrock base on Optimism:`,
        e.shortMessage,
      )
    } else {
      console.log(`Error in proveWorldStateBedrock baseon Optimism:`, e)
    }
  }
}

async function proveWorldStateBedrockOnOptimismForHelix(
  l3OutputIndex,
  l3BlockNumber,
  settlementBlockTag,
  settlementWorldStateRoot,
) {
  console.log('In proveWorldStateBedrockOnOptimismforHelix')
  const endBatchBlockHex = toQuantity(l3BlockNumber)
  // const endBatchBlockHex = l3BlockNumber
  console.log('End Batch Block Number: ', endBatchBlockHex)
  const l3endBatchBlockData = await s.helixProvider.send(
    'eth_getBlockByNumber',
    [endBatchBlockHex, false],
  )
  const rlpEncodedBlockData = await getRLPEncodedBlock(l3endBatchBlockData)
  const l1BatchIndex = l3OutputIndex
  console.log('l1BatchIndex: ', l1BatchIndex)
  // Get the Message Parser State Root at the end block of the batch
  const l2MesagePasserProof = await s.helixProvider.send('eth_getProof', [
    networks.helix.proving.l2l1MessageParserAddress,
    [],
    endBatchBlockHex,
  ])
  // Get the storage Slot information
  // l1BatchSlot = calculated from the batch number *2 + output slot 3
  // In Solidity
  // bytes32 outputRootStorageSlot =
  // bytes32(abi.encode((uint256(keccak256(abi.encode(L2_OUTPUT_SLOT_NUMBER))) + l2OutputIndex * 2)));
  const arrayLengthSlot = zeroPadValue(
    toBeArray(networks.helix.proving.l2OutputOracleSlotNumber),
    32,
  )
  const firstElementSlot = solidityPackedKeccak256(
    ['bytes32'],
    [arrayLengthSlot],
  )
  const l1BatchSlot = toBeHex(
    BigInt(firstElementSlot) + BigInt(Number(l1BatchIndex) * 2),
    32,
  )

  const layer1HelixOutputOracleProof = await s.baseProvider.send(
    'eth_getProof',
    [
      networks.base.settlementContracts.helix,
      [l1BatchSlot],
      settlementBlockTag,
    ],
  )
  const layer1HelixOutputOracleContractData = [
    toBeHex(layer1HelixOutputOracleProof.nonce), // nonce
    stripZerosLeft(toBeHex(layer1HelixOutputOracleProof.balance)), // balance
    layer1HelixOutputOracleProof.storageHash, // storageHash
    layer1HelixOutputOracleProof.codeHash, // CodeHash
  ]
  try {
    const proveOutputTX = await s.optimismProverContract.proveWorldStateBedrock(
      networkIds.helix,
      rlpEncodedBlockData,
      l3endBatchBlockData.stateRoot,
      l2MesagePasserProof.storageHash,
      // endBatchBlockData.hash,
      l1BatchIndex,
      layer1HelixOutputOracleProof.storageProof[0].proof,
      await s.optimismProverContract.rlpEncodeDataLibList(
        layer1HelixOutputOracleContractData,
      ),
      layer1HelixOutputOracleProof.accountProof,
      settlementWorldStateRoot,
    )
    await proveOutputTX.wait()
    console.log(
      'Prove Bedrock L3 World State optimism tx: ',
      proveOutputTX.hash,
    )
    return l3endBatchBlockData
  } catch (e) {
    if (e.data && s.optimismProverContract) {
      const decodedError = s.optimismProverContract.interface.parseError(e.data)
      console.log(
        `Transaction failed in proveWorldStateBedrock optimism: ${decodedError?.name}`,
      )
      console.log('Error: ', e)
      console.log(`Error in proveWorldStateBedrock optimism:`, e.shortMessage)
    } else {
      console.log(`Error in proveWorldStateBedrock optimism:`, e)
    }
  }
}

async function proveWorldStatesBedrockL3L2Base(
  faultDisputeGameAddress,
  faultDisputeGameContract,
  gameIndex,
  l3OutputIndex,
  l3BlockNumber,
) {
  console.log('In proveWorldStatesBedrockL3L2Base')
  const { settlementBlockTag, settlementWorldStateRoot } =
    await proveMainnetSettlementLayerStateOnBase() // Prove the Mainnet Settlement Layer State

  // Prove Base World State on Base Mainnet
  const endBatchBlockDataL2 = await proveWorldStateBaseOnBase(
    settlementBlockTag,
    settlementWorldStateRoot,
    faultDisputeGameAddress,
    faultDisputeGameContract,
    gameIndex,
  )
  // Prove ECO TestNet World State on Base Mainnet
  console.log('Base endBatchBlockData.number: ', endBatchBlockDataL2.number)
  console.log(
    'Base endBatchBlockData.stateRoot: ',
    endBatchBlockDataL2.stateRoot,
  )
  const endBatchBlockData = await proveWorldStateBedrockOnBaseforHelix(
    l3OutputIndex,
    l3BlockNumber,
    endBatchBlockDataL2.number,
    endBatchBlockDataL2.stateRoot,
  )

  return endBatchBlockData
}

async function proveWorldStatesBedrockL3L2Optimism(
  l2OutputIndex,
  l2BlockNumber,
  l3OutputIndex,
  l3BlockNumber,
) {
  console.log('In proveWorldStatesBedrockL3L2Optimism')
  const { settlementBlockTag, settlementWorldStateRoot } =
    await proveMainnetSettlementLayerStateOnOptimism() // Prove the Mainnet Settlement Layer State

  // Prove Base World State on Optimism Mainnet
  const l2endBatchBlockData = await proveWorldStateBedrockOnOptimismForBase(
    l2OutputIndex,
    l2BlockNumber,
    settlementBlockTag,
    settlementWorldStateRoot,
  )
  // Prove ECO TestNet World State on Optimism Mainnet
  console.log('Base endBatchBlockData.number: ', l2endBatchBlockData.number)
  console.log(
    'Base endBatchBlockData.stateRoot: ',
    l2endBatchBlockData.stateRoot,
  )
  const l3endBatchBlockData = await proveWorldStateBedrockOnOptimismForHelix(
    l3OutputIndex,
    l3BlockNumber,
    l2endBatchBlockData.number,
    l2endBatchBlockData.stateRoot,
  )
  return l3endBatchBlockData
}

export async function proveDestinationChainBatchSettled(
  l2OutputIndex,
  l2BlockNumber,
  sourceChains,
  l3OutputIndex,
  l3BlockNumber,
) {
  console.log('In proveDestinationChainBatchSettled')
  await Promise.all(
    await Object.entries(sourceChains).map(
      async ([sourceChainkey, sourceChain]) => {
        if (sourceChain.needNewProvenState) {
          // TODO: remove switch statement and use the sourceChain Layer to get the correct proving mechanism
          switch (sourceChain.sourceChain) {
            case networkIds.base: {
              // endBatchBlockData = await proveWorldStatesBedrockL3L2Base(
              //   faultDisputeGameAddress,
              //   faultDisputeGameContract,
              //   gameIndex,
              //   l3OutputIndex,
              //   l3BlockNumber,
              // )
              break
            }
            case networkIds.optimism: {
              endBatchBlockData = await proveWorldStatesBedrockL3L2Optimism(
                // faultDisputeGameAddress,
                // faultDisputeGameContract,
                // gameIndex,
                l2OutputIndex,
                l2BlockNumber,
                l3OutputIndex,
                l3BlockNumber,
              )
              break
            }
            case networkIds.helix: {
              break
            }
            default: {
              break
            }
          }
        }
      },
    ),
  )
  return endBatchBlockData
}

async function proveIntentBase(intentHash, endBatchBlockData) {
  console.log('In proveIntentBase')
  const inboxStorageSlot = solidityPackedKeccak256(
    ['bytes'],
    [s.abiCoder.encode(['bytes32', 'uint256'], [intentHash, 1])],
  )
  const intentInboxProof = await s.helixProvider.send('eth_getProof', [
    networks.helix.inbox.address,
    [inboxStorageSlot],
    endBatchBlockData.number,
  ])

  const intentInfo =
    await s.baseIntentSourceContractClaimant.getIntent(intentHash)

  const abiCoder = AbiCoder.defaultAbiCoder()
  const intermediateHash = keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'address[]', 'bytes[]', 'uint256', 'bytes32'],
      [
        networkIds.base, // sourceChainID
        intentInfo[1], // destinationChainID
        intentInfo[2], // targetTokens
        intentInfo[3], // callData
        intentInfo[6], // expiryTime
        getBytes(intentInfo[8]), // nonce),
      ],
    ),
  )
  try {
    const proveIntentTx = await s.baseProverContract.proveIntent(
      networkIds.helix,
      actors.claimant,
      networks.helix.inbox.address,
      intermediateHash,
      intentInboxProof.storageProof[0].proof,
      await s.baseProverContract.rlpEncodeDataLibList([
        toBeHex(intentInboxProof.nonce), // nonce
        stripZerosLeft(toBeHex(intentInboxProof.balance)),
        intentInboxProof.storageHash,
        intentInboxProof.codeHash,
      ]),
      intentInboxProof.accountProof,
      endBatchBlockData.stateRoot,
    )
    await proveIntentTx.wait()
    console.log('Prove Intent tx:', proveIntentTx.hash)
    return proveIntentTx.hash
  } catch (e) {
    if (e.data && s.baseProverContract) {
      const decodedError = s.baseProverContract.interface.parseError(e.data)
      console.log(`Transaction failed in proveIntent : ${decodedError?.name}`)
      console.log('proveIntent decodedError: ', decodedError)
    } else {
      console.log(`Error in proveIntent:`, e)
    }
  }
}

async function proveIntentOptimism(intentHash, endBatchBlockData) {
  console.log('In proveIntentOptimism')
  const inboxStorageSlot = solidityPackedKeccak256(
    ['bytes'],
    [s.abiCoder.encode(['bytes32', 'uint256'], [intentHash, 1])],
  )
  const intentInboxProof = await s.helixProvider.send('eth_getProof', [
    networks.helix.inbox.address,
    [inboxStorageSlot],
    endBatchBlockData.number,
  ])

  const intentInfo =
    await s.optimismIntentSourceContractClaimant.getIntent(intentHash)

  const abiCoder = AbiCoder.defaultAbiCoder()
  const intermediateHash = keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'address[]', 'bytes[]', 'uint256', 'bytes32'],
      [
        networkIds.optimism, // sourceChainID
        intentInfo[1], // destinationChainID
        intentInfo[2], // targetTokens
        intentInfo[3], // callData
        intentInfo[6], // expiryTime
        getBytes(intentInfo[8]), // nonce),
      ],
    ),
  )

  try {
    const proveIntentTx = await s.optimismProverContract.proveIntent(
      networkIds.helix,
      actors.claimant,
      networks.helix.inbox.address,
      intermediateHash,
      intentInboxProof.storageProof[0].proof,
      await s.optimismProverContract.rlpEncodeDataLibList([
        toBeHex(intentInboxProof.nonce), // nonce
        stripZerosLeft(toBeHex(intentInboxProof.balance)),
        intentInboxProof.storageHash,
        intentInboxProof.codeHash,
      ]),
      intentInboxProof.accountProof,
      endBatchBlockData.stateRoot,
    )
    await proveIntentTx.wait()
    console.log('Prove Intent tx:', proveIntentTx.hash)
    return proveIntentTx.hash
  } catch (e) {
    if (e.data && s.optimismProverContract) {
      const decodedError = s.optimismProverContract.interface.parseError(e.data)
      console.log(`Transaction failed in proveIntent : ${decodedError?.name}`)
      console.log('proveIntent decodedError: ', decodedError)
    } else {
      console.log(`Error in proveIntent:`, e)
    }
  }
}

async function proveIntentHelix(intentHash, endBatchBlockData) {
  console.log('In proveIntentHelix')
  const inboxStorageSlot = solidityPackedKeccak256(
    ['bytes'],
    [s.abiCoder.encode(['bytes32', 'uint256'], [intentHash, 1])],
  )
  const intentInboxProof = await s.baseProvider.send('eth_getProof', [
    networks.base.inbox.address,
    [inboxStorageSlot],
    endBatchBlockData.number,
  ])

  const intentInfo =
    await s.helixIntentSourceContractClaimant.getIntent(intentHash)

  const abiCoder = AbiCoder.defaultAbiCoder()
  const intermediateHash = keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'address[]', 'bytes[]', 'uint256', 'bytes32'],
      [
        networkIds.helix, // sourceChainID
        intentInfo[1], // destinationChainID
        intentInfo[2], // targetTokens
        intentInfo[3], // callData
        intentInfo[6], // expiryTime
        getBytes(intentInfo[8]), // nonce),
      ],
    ),
  )

  try {
    const proveIntentTx = await s.helixProverContract.proveIntent(
      networkIds.base,
      actors.claimant,
      networks.base.inbox.address,
      intermediateHash,
      intentInboxProof.storageProof[0].proof,
      await s.helixProverContract.rlpEncodeDataLibList([
        toBeHex(intentInboxProof.nonce), // nonce
        stripZerosLeft(toBeHex(intentInboxProof.balance)),
        intentInboxProof.storageHash,
        intentInboxProof.codeHash,
      ]),
      intentInboxProof.accountProof,
      endBatchBlockData.stateRoot,
    )
    await proveIntentTx.wait()
    console.log('Prove Intent tx:', proveIntentTx.hash)
    return proveIntentTx.hash
  } catch (e) {
    if (e.data && s.helixProverContract) {
      const decodedError = s.helixProverContract.interface.parseError(e.data)
      console.log(`Transaction failed in proveIntent : ${decodedError?.name}`)
      console.log('proveIntent decodedError: ', decodedError)
    } else {
      console.log(`Error in proveIntent:`, e)
    }
  }
}

export async function proveIntents(intentsToProve, endBatchBlockData) {
  // loop through chainIds and intents
  // prove each intent
  console.log('In proveIntents')
  for (const intent of intentsToProve) {
    switch (intent.sourceChain) {
      case networkIds.base: {
        // await proveIntentBase(intent.intentHash, endBatchBlockData)
        break
      }
      case networkIds.optimism: {
        await proveIntentOptimism(intent.intentHash, endBatchBlockData)
        break
      }
      case networkIds.helix: {
        // await proveIntentHelix(intent.intentHash, endBatchBlockData)
        break
      }
    }
  }
}

async function withdrawRewardBase(intentHash) {
  console.log('In withdrawReward')
  try {
    const withdrawTx =
      await s.baseIntentSourceContractClaimant.withdrawRewards(intentHash)
    await withdrawTx.wait()
    console.log('Withdrawal tx: ', withdrawTx.hash)
    return withdrawTx.hash
  } catch (e) {
    if (e.data && s.baseIntentSourceContractClaimant) {
      const decodedError =
        s.baseIntentSourceContractClaimant.interface.parseError(e.data)
      console.log(
        `Transaction failed in withdrawReward : ${decodedError?.name}`,
      )
    } else {
      console.log(`Error in withdrawReward:`, e)
    }
  }
}

async function withdrawRewardOptimism(intentHash) {
  console.log('In withdrawReward')
  try {
    const withdrawTx =
      await s.optimismIntentSourceContractClaimant.withdrawRewards(intentHash)
    await withdrawTx.wait()
    console.log('Withdrawal tx: ', withdrawTx.hash)
    return withdrawTx.hash
  } catch (e) {
    if (e.data && s.optimismIntentSourceContractClaimant) {
      const decodedError =
        s.optimismIntentSourceContractClaimant.interface.parseError(e.data)
      console.log(
        `Transaction failed in withdrawReward : ${decodedError?.name}`,
      )
    } else {
      console.log(`Error in withdrawReward:`, e)
    }
  }
}

async function withdrawRewardHelix(intentHash) {
  console.log('In withdrawReward')
  try {
    const withdrawTx =
      await s.helixIntentSourceContractClaimant.withdrawRewards(intentHash)
    await withdrawTx.wait()
    console.log('Withdrawal tx: ', withdrawTx.hash)
    return withdrawTx.hash
  } catch (e) {
    if (e.data && s.helixIntentSourceContractClaimant) {
      const decodedError =
        s.helixIntentSourceContractClaimant.interface.parseError(e.data)
      console.log(
        `Transaction failed in withdrawReward : ${decodedError?.name}`,
      )
    } else {
      console.log(`Error in withdrawReward:`, e)
    }
  }
}

export async function withdrawFunds(intentsToProve) {
  console.log('In withdrawFunds')
  for (const intent of intentsToProve) {
    switch (intent.sourceChain) {
      case networkIds.base: {
        // await withdrawRewardBase(intent.intentHash)
        break
      }
      case networkIds.optimism: {
        await withdrawRewardOptimism(intent.intentHash)
        break
      }
      case networkIds.helix: {
        // await withdrawRewardHelix(intent.intentHash)
        break
      }
    }
  }
}

async function main() {
  const proveAll: boolean = true
  // define the variables used for each state of the intent lifecycle
  // Point in time proving for latest batch
  try {
    console.log('In Main')
    console.log('Batch Settle of Eco Testnet')
    // Get the latest Batch Settled for Base Mainnet
    // const {
    //   blockNumber,
    //   gameIndex, // latest Output Index from L2OutputOracle
    //   faultDisputeGameAddress,
    //   faultDisputeGameContract,
    //   l3OutputIndex,
    //   l3BlockNumber,
    // } = await getBatchSettled()
    // Get the latest Batch Settled for
    const { l2OutputIndex, l2BlockNumber } = await getBatchSettledBaseBedrock()

    const { l3OutputIndex, l3BlockNumber } =
      await getBatchSettledHelixBedrock(l2BlockNumber)

    // Get all the intents that can be proven for the batch by destination chain
    const { sourceChains, intentsToProve } = await getIntentsToProve(
      l3BlockNumber,
      proveAll,
    )
    console.log('intentsToProve: ', intentsToProve)
    // Prove the latest batch settled
    const l3endBatchBlockData = await proveDestinationChainBatchSettled(
      l2OutputIndex,
      l2BlockNumber,
      sourceChains,
      l3OutputIndex,
      l3BlockNumber,
    )
    // Prove all the intents
    await proveIntents(intentsToProve, l3endBatchBlockData)
    await withdrawFunds(intentsToProve)
  } catch (e) {
    console.log(e)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
