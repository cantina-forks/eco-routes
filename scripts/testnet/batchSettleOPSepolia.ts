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
} from '../../config/testnet/config'
import { s } from '../../config/testnet/setup'
import * as FaultDisputeGameArtifact from '@eth-optimism/contracts-bedrock/forge-artifacts/FaultDisputeGame.sol/FaultDisputeGame.json'
// import { intent } from '../../test/testData'
import { utils } from '../common/utils'

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

export async function getBatchSettled() {
  // Get the latest resolved fault dispute game
  // Get the GameId information for the fault dispute game
  // return faultDisputeGame address, gameId, blockNumber
  // Recommend making approximateUnsettledGames configurable and could go as high as 84 but safest is zero.
  console.log('In getBatchSettled')
  const disputeGameFactoryContract = s.sepoliaSettlementContractOptimism
  const approximateUnsettledGames = 320n // Initial Test on Sepolia gave 327
  let blockNumber, gameIndex, faultDisputeGameAddress, faultDisputeGameContract
  gameIndex =
    (await disputeGameFactoryContract.gameCount()) -
    1n -
    approximateUnsettledGames
  // lastGame = 1712n
  while (gameIndex > 0) {
    const gameData = await disputeGameFactoryContract.gameAtIndex(gameIndex)
    faultDisputeGameAddress = gameData.proxy_
    faultDisputeGameContract = new Contract(
      faultDisputeGameAddress,
      FaultDisputeGameArtifact.abi,
      s.sepoliaProvider,
    )
    const faultDisputeGameResolvedEvents =
      await faultDisputeGameContract.queryFilter(
        faultDisputeGameContract.getEvent('Resolved'),
      )
    if (faultDisputeGameResolvedEvents.length !== 0) {
      blockNumber = await faultDisputeGameContract.l2BlockNumber()
      return {
        blockNumber,
        gameIndex,
        faultDisputeGameAddress,
        faultDisputeGameContract,
      }
    }
    gameIndex -= 1n
  }
}
export async function getIntentsToProve(
  settlementBlockNumber: BigInt,
  proveAll: boolean,
) {
  // get BaseSepolia Last OptimimsmSepolia BlockNumber from WorldState

  const sourceChainConfig = networks.optimismSepolia.sourceChains
  const sourceChains: Record<number, SourceChainInfo> = {}
  // get the starting block to scan for intents
  let optimismSepoliaProvenState
  let scanAllIntentsForInbox = false
  // TODO change to use contract factory for deploys then can use ethers deploymentTransaction to get the blockNumber
  let startingBlockNumber = networks.optimismSepolia.inbox.deploymentBlock || 0n
  const inboxDeploymentBlock = networks.optimismSepolia.inbox.deploymentBlock
  // TODO: Parmaeterize the calls to provenStates and remove switch
  for (const sourceChain of sourceChainConfig) {
    const sourceChainInfo: SourceChainInfo = {} as SourceChainInfo
    try {
      sourceChainInfo.sourceChain = networkIds[sourceChain]
      // @ts-ignore
      const proverContract = s[`${sourceChain}ProverContract`] as Contract
      optimismSepoliaProvenState = await proverContract.provenStates(
        // await s.[sourceChain]ProverContract.provenStates(
        networkIds.optimismSepolia,
      )
      sourceChainInfo.lastProvenBlock = optimismSepoliaProvenState.blockNumber
      if (proveAll) {
        sourceChainInfo.lastProvenBlock = inboxDeploymentBlock
        sourceChainInfo.needNewProvenState = true
        startingBlockNumber = inboxDeploymentBlock
        scanAllIntentsForInbox = true
      } else {
        if (optimismSepoliaProvenState.blockNumber > inboxDeploymentBlock) {
          sourceChainInfo.lastProvenBlock =
            optimismSepoliaProvenState.blockNumber
          if (optimismSepoliaProvenState.blockNumber < startingBlockNumber) {
            startingBlockNumber = optimismSepoliaProvenState.blockNumber
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
  const intentHashEvents =
    await s.optimismSepoliaInboxContractSolver.queryFilter(
      s.optimismSepoliaInboxContractSolver.getEvent('Fulfillment'),
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
async function proveSepoliaSettlementLayerStateOnBaseSepolia() {
  console.log('In proveSettlementLayerState on BaseSepolia')
  let provedSettlementState = false
  let errorCount = 0
  while (!provedSettlementState) {
    const setlementBlock = await s.baseSepolial1Block.number()
    const settlementBlockTag = toQuantity(setlementBlock)

    const block: Block = await s.sepoliaProvider.send('eth_getBlockByNumber', [
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
      tx = await s.baseSepoliaProverContract.proveSettlementLayerState(
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
        'Proven Settlement world state root:',
        settlementWorldStateRoot,
      )
      provedSettlementState = true
      return { settlementBlockTag, settlementWorldStateRoot }
    } catch (e) {
      errorCount += 1
      console.log('ProveSettlementState errorCount: ', errorCount)
    }
  }
  //   have successfully proven L1 state
}

async function proveSepoliaSettlementLayerStateOnEcoTestNet() {
  console.log('In proveSepoliaSettlementLayerStateOnEcoTestNet')
  let provedSettlementState = false
  let errorCount = 0
  while (!provedSettlementState) {
    let tx
    let settlementWorldStateRoot
    try {
      // Get L2 Settlement Block from L3
      // const l2SettlementBlock = await s.ecoTestNetl1Block.number()
      // const l2SettlementBlockTag = toQuantity(l2SettlementBlock)
      // const l2block: Block = await s.baseSepoliaProvider.send(
      //   'eth_getBlockByNumber',
      //   [l2SettlementBlockTag, false],
      // )
      // Get L2 Settlement Block from lastest L2 Bloc
      const l2block: Block = await s.baseSepoliaProvider.send(
        'eth_getBlockByNumber',
        ['latest', false],
      )
      const l2SettlementBlock = BigInt(l2block.number)
      const l2SettlementBlockTag = toQuantity(l2SettlementBlock)
      const l2RlpEncodedBlockData = await utils.getRLPEncodedBlock(l2block)

      console.log('l2SettlementBlock: ', l2SettlementBlock)
      console.log('l2SettlementBlockTag: ', l2SettlementBlockTag)
      // console.log('L2 RLP Encoded Block Data: ', l2RlpEncodedBlockData)
      // Get L1 Settlement Block
      // const l1SettlementBlock = 6839170n // Debug
      const l1SettlementBlock = await s.baseSepolial1Block.number()
      const l1SettlementBlockTag = toQuantity(l1SettlementBlock)
      const l1block: Block = await s.sepoliaProvider.send(
        'eth_getBlockByNumber',
        [l1SettlementBlockTag, false],
      )
      console.log('l1SettlementBlock: ', l1SettlementBlock)
      console.log('l1SettlementBlockTag: ', l1SettlementBlockTag)
      const l1RlpEncodedBlockData = await utils.getRLPEncodedBlock(l1block)
      // console.log('L1 RLP Encoded Block Data: ', l1RlpEncodedBlockData)
      // Get the Message Parser State Root at the l2 current block
      // const l2MesagePasserProof = await s.baseSepoliaProvider.send(
      //   'eth_getProof',
      //   [
      //     networks.baseSepolia.proving.l2l1MessageParserAddress,
      //     [],
      //     l2SettlementBlockTag,
      //   ],
      // )
      // const l2BlockHashSlot = zeroPadValue(
      //   toBeArray(networks.baseSepolia.proving.l1BlockSlotNumber),
      //   32,
      // )
      const l2BlockHashSlot = toBeHex(
        BigInt(networks.baseSepolia.proving.l1BlockSlotNumber),
        32,
      )
      console.log(
        'networks.baseSepolia.proving.l1BlockAddress: ',
        networks.baseSepolia.proving.l1BlockAddress,
      )
      const l2l1BlockProof = await s.baseSepoliaProvider.send('eth_getProof', [
        networks.baseSepolia.proving.l1BlockAddress,
        [l2BlockHashSlot],
        l2SettlementBlockTag,
      ])
      const l2l1BlockContractData = [
        toBeHex(l2l1BlockProof.nonce), // nonce
        stripZerosLeft(toBeHex(l2l1BlockProof.balance)), // balance
        l2l1BlockProof.storageHash, // storageHash
        l2l1BlockProof.codeHash, // CodeHash
      ]
      // Call proveStorage and proveAccount functions for debugging
      console.log('Proving Storage')
      console.log('l2BlockHashSlot: ', l2BlockHashSlot)
      // const blockHashPrefix = 0xa0
      const blockHash = keccak256(l1RlpEncodedBlockData)
      console.log('blockHash      : ', blockHash)
      // const rlpL1BlockHash =
      //   toBeHex(blockHashPrefix) + toBeHex(blockHash).substring(2)
      const rlpL1BlockHash = encodeRlp(toBeHex(stripZerosLeft(blockHash)))
      // toBeHex(blockHashPrefix) + toBeHex(blockHash).substring(2)

      // const rlpL1BlockHash = keccak256(l1RlpEncodedBlockData)
      // console.log('rlpL1BlockHash : ', rlpL1BlockHash)
      // console.log(
      //   'l2l1BlockProof.storageProof[0].proof: ',
      //   l2l1BlockProof.storageProof[0].proof,
      // )
      // console.log('l2l1BlockProof.stateRoot: ', l2block.stateRoot)
      await s.ecoTestNetProverContract.proveStorage(
        l2BlockHashSlot, // abi.encodePacked(blockHashStorageSlot) // bytes memory _address,
        rlpL1BlockHash, // bytes.concat(bytes1(uint8(0xa0)), abi.encodePacked(l1blockProof.blockHash)) // bytes memory _data,
        l2l1BlockProof.storageProof[0].proof, // l2l1StorageProof, // bytes[] memory _proof,
        // l2block.stateRoot, // bytes32(l2blockProof.stateRoot)// bytes32 _root
        l2l1BlockProof.storageHash, // bytes32(l2blockProof.stateRoot)// bytes32 _root
      )
      console.log('Storage Proved now Proving Account')
      console.log(
        'networks.baseSepolia.proving.l1BlockAddress: ',
        networks.baseSepolia.proving.l1BlockAddress,
      )
      console.log(
        'value: ',
        await s.baseSepoliaProverContract.rlpEncodeDataLibList(
          l2l1BlockContractData,
        ),
      )
      console.log('l2l1BlockProof.accountProof: ', l2l1BlockProof.accountProof)
      console.log('l2block.stateRoot: ', l2block.stateRoot)
      // await s.ecoTestNetProverContract.proveAccount(
      //   networks.baseSepolia.proving.l1BlockAddress, // abi.encodePacked(L1_BLOCK_ADDRESS),  L1BlockOracle Address
      //   await s.baseSepoliaProverContract.rlpEncodeDataLibList(
      //     l2l1BlockContractData,
      //   ), // rlpEncodedL2L1BlockData,  RLP Encoded L1BlockData
      //   l2l1BlockProof.accountProof, // l2AccountProof, // Account Proof
      //   l2block.stateRoot, // l2WorldStateRoot // L2WorldStateRoot
      // )
      console.log('Account Proved')
      // end debugging

      // let tx
      // let settlementWorldStateRoot
      // try {
      console.log('Proving L1L3SettlementLayerState')
      console.log(
        'l2l1BlockProof.storageProof[0].proof: ',
        l2l1BlockProof.storageProof[0].proof,
      )
      console.log(
        'rlpEncodedL2L1BlockData: ',
        await s.baseSepoliaProverContract.rlpEncodeDataLibList(
          l2l1BlockContractData,
        ),
      )
      console.log('l2l1BlockProof.accountProof: ', l2l1BlockProof.accountProof)
      console.log('l1block.stateRoot: ', l1block.stateRoot)
      tx = await s.ecoTestNetProverContract.proveL1L3SettlementLayerState(
        getBytes(hexlify(l1RlpEncodedBlockData)),
        getBytes(hexlify(l2RlpEncodedBlockData)),
        l2l1BlockProof.storageProof[0].proof, // bytes[] calldata l2l1StorageProof,
        await s.baseSepoliaProverContract.rlpEncodeDataLibList(
          l2l1BlockContractData,
        ), // bytes calldata rlpEncodedL2L1BlockData,
        l2l1BlockProof.accountProof, // bytes[] calldata l2AccountProof,
        l2block.stateRoot, // bytes32 l2WorldStateRoot
      )
      await tx.wait()
      console.log('Prove L1L3SettlementLayerState tx: ', tx.hash)
      settlementWorldStateRoot = l1block.stateRoot
      console.log(
        'Proven L1L3SettlementLayerState block: ',
        l1SettlementBlock,
        l1SettlementBlockTag,
      )
      console.log(
        'Proven L1L3SettlementLayerState world state root:',
        settlementWorldStateRoot,
      )
      provedSettlementState = true
      return { l1SettlementBlockTag, settlementWorldStateRoot }
    } catch (e) {
      errorCount += 1
      console.log('L1L3SettlementLayerState errorCount: ', errorCount)
      // console.log('Error: ', e)
      console.log(`Error in L1L3SettlementLayerState:`, e.shortMessage)
    }
  }
}

async function proveWorldStateOptimismSepoliaOnEcoTestNet(
  settlementBlockTag,
  settlementStateRoot,
  faultDisputeGameAddress,
  faultDisputeGameContract,
  gameIndex,
) {
  console.log('In proveWorldStateCannonBaseToEcoTestNet')
  // For more information on how DisputeGameFactory utility functions, see the following code
  // https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/lib/LibUDT.sol#L82
  // get the endBatchBlockData

  // Note: For all proofs we use two block numbers
  // For anything related to the settlement chain we use settlementBlockTag
  // For anything related to the destination chain we use endBatchBlockHex
  // Get the faultDisputeGame game data
  const faultDisputeGameData = await faultDisputeGameContract.gameData()
  const faultDisputeGameCreatedAt = await faultDisputeGameContract.createdAt()
  const faultDisputeGameResolvedAt = await faultDisputeGameContract.resolvedAt()
  const faultDisputeGameGameStatus = await faultDisputeGameContract.status()
  const faultDisputeGameInitialized = true
  const faultDisputeGameL2BlockNumberChallenged = false
  const faultDisputeGameL2BlockNumber =
    await faultDisputeGameContract.l2BlockNumber()
  const endBatchBlockHex = toQuantity(faultDisputeGameL2BlockNumber)
  const endBatchBlockData = await s.optimismSepoliaProvider.send(
    'eth_getBlockByNumber',
    [endBatchBlockHex, false],
  )
  const rlpEncodedEndBatchBlockData =
    await utils.getRLPEncodedBlock(endBatchBlockData)

  // Get the Message Parser State Root at the end block of the batch
  const l2MesagePasserProof = await s.optimismSepoliaProvider.send(
    'eth_getProof',
    [
      networks.optimismSepolia.proving.l2l1MessageParserAddress,
      [],
      endBatchBlockHex,
    ],
  )

  // Get the DisputeGameFactory data GameId
  const faultDisputeGameId = await s.ecoTestNetProverContract.pack(
    faultDisputeGameData.gameType_,
    faultDisputeGameCreatedAt,
    faultDisputeGameAddress,
  )

  // disputeGameFactoryStorageSlot is where the gameId is stored
  // In solidity
  // uint256(keccak256(abi.encode(L2_DISPUTE_GAME_FACTORY_LIST_SLOT_NUMBER)))
  //                       + disputeGameFactoryProofData.gameIndex
  const disputeGameFactorySlotNumber = 104
  const disputeGameFactoryGameIndex = gameIndex
  const arrayLengthSlot = zeroPadValue(
    toBeArray(disputeGameFactorySlotNumber),
    32,
  )
  const firstElementSlot = solidityPackedKeccak256(
    ['bytes32'],
    [arrayLengthSlot],
  )
  const disputeGameFactoryStorageSlot = toBeHex(
    BigInt(firstElementSlot) + BigInt(Number(disputeGameFactoryGameIndex)),
    32,
  )
  const disputeGameFactoryProof = await s.sepoliaProvider.send('eth_getProof', [
    networks.sepolia.settlementContracts.optimismSepolia,
    [disputeGameFactoryStorageSlot],
    settlementBlockTag,
  ])
  const disputeGameFactoryContractData = [
    toBeHex(disputeGameFactoryProof.nonce), // nonce
    stripZerosLeft(toBeHex(disputeGameFactoryProof.balance)), // balance
    disputeGameFactoryProof.storageHash, // storageHash
    disputeGameFactoryProof.codeHash, // CodeHash
  ]
  const RLPEncodedDisputeGameFactoryData =
    await s.ecoTestNetProverContract.rlpEncodeDataLibList(
      disputeGameFactoryContractData,
    )
  // populate fields for the DisputeGameFactory proof
  const disputeGameFactoryProofData = {
    messagePasserStateRoot: l2MesagePasserProof.storageHash,
    latestBlockHash: endBatchBlockData.hash,
    gameIndex: disputeGameFactoryGameIndex,
    gameId: faultDisputeGameId,
    disputeFaultGameStorageProof: disputeGameFactoryProof.storageProof[0].proof,
    rlpEncodedDisputeGameFactoryData: RLPEncodedDisputeGameFactoryData,
    disputeGameFactoryAccountProof: disputeGameFactoryProof.accountProof,
  }

  // populate fields for the FaultDisputeGame rootclaim proof
  // Storage proof for faultDisputeGame root claim
  // rootClaimSlot - hardcooded value for the slot which is a keecak256 hash  the slot for rootClaim

  const faultDisputeGameRootClaimStorageSlot =
    '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
  const faultDisputeGameRootClaimProof = await s.sepoliaProvider.send(
    'eth_getProof',
    [
      faultDisputeGameAddress,
      [faultDisputeGameRootClaimStorageSlot],
      settlementBlockTag,
    ],
  )
  // Storage proof for faultDisputeGame resolved
  // rootClaimSlot - hardcoded value for slot zero which is where the status is stored
  const faultDisputeGameResolvedStorageSlot =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  // '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
  const faultDisputeGameRootResolvedProof = await s.sepoliaProvider.send(
    'eth_getProof',
    [
      faultDisputeGameAddress,
      [faultDisputeGameResolvedStorageSlot],
      settlementBlockTag,
    ],
  )
  const faultDisputeGameContractData = [
    toBeHex(faultDisputeGameRootClaimProof.nonce), // nonce
    stripZerosLeft(toBeHex(faultDisputeGameRootClaimProof.balance)), // balance
    faultDisputeGameRootClaimProof.storageHash, // storageHash
    faultDisputeGameRootClaimProof.codeHash, // CodeHash
  ]
  const RLPEncodedFaultDisputeGameContractData =
    await s.ecoTestNetProverContract.rlpEncodeDataLibList(
      faultDisputeGameContractData,
    )
  const faultDisputeGameProofData = {
    // faultDisputeGameStateRoot: endBatchBlockData.stateRoot,
    faultDisputeGameStateRoot: faultDisputeGameRootClaimProof.storageHash,
    faultDisputeGameRootClaimStorageProof:
      faultDisputeGameRootClaimProof.storageProof[0].proof,
    faultDisputeGameStatusSlotData: {
      createdAt: faultDisputeGameCreatedAt,
      resolvedAt: faultDisputeGameResolvedAt,
      gameStatus: faultDisputeGameGameStatus,
      initialized: faultDisputeGameInitialized,
      l2BlockNumberChallenged: faultDisputeGameL2BlockNumberChallenged,
    },
    // populate fields for the FaultDisputeGame resolved proof
    faultDisputeGameStatusStorageProof:
      faultDisputeGameRootResolvedProof.storageProof[0].proof,
    rlpEncodedFaultDisputeGameData: RLPEncodedFaultDisputeGameContractData,
    faultDisputeGameAccountProof: faultDisputeGameRootClaimProof.accountProof,
  }

  // try {
  // Note: ProveStorage and ProveAccount are pure functions and included here just for unit testing
  const { gameProxy_ } = await s.ecoTestNetProverContract.unpack(
    disputeGameFactoryProofData.gameId,
  )
  // proveStorageDisputeGameFactory
  await s.ecoTestNetProverContract.proveStorage(
    disputeGameFactoryStorageSlot,
    encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameId))),
    // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
    disputeGameFactoryProof.storageProof[0].proof,
    disputeGameFactoryProof.storageHash,
  )
  // proveAccountDisputeGameFactory
  await s.ecoTestNetProverContract.proveAccount(
    networks.sepolia.settlementContracts.optimismSepolia,
    disputeGameFactoryProofData.rlpEncodedDisputeGameFactoryData,
    disputeGameFactoryProofData.disputeGameFactoryAccountProof,
    settlementStateRoot,
  )
  // proveStorageFaultDisputeGameRootClaim
  await s.ecoTestNetProverContract.proveStorage(
    faultDisputeGameRootClaimStorageSlot,
    encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameData.rootClaim_))),
    // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
    faultDisputeGameRootClaimProof.storageProof[0].proof,
    faultDisputeGameRootClaimProof.storageHash,
  )
  // proveStorageFaultDisputeGameResolved
  await s.ecoTestNetProverContract.proveStorage(
    faultDisputeGameResolvedStorageSlot,
    await s.ecoTestNetProverContract.assembleGameStatusStorage(
      faultDisputeGameCreatedAt,
      faultDisputeGameResolvedAt,
      faultDisputeGameGameStatus,
      faultDisputeGameInitialized,
      faultDisputeGameL2BlockNumberChallenged,
    ),
    faultDisputeGameRootResolvedProof.storageProof[0].proof,
    faultDisputeGameRootResolvedProof.storageHash,
  )
  // proveAccountFaultDisputeGame
  await s.ecoTestNetProverContract.proveAccount(
    // faultDisputeGameAddress,
    // '0x4D664dd0f78673034b29E4A51177333D1131Ac44',
    gameProxy_,
    faultDisputeGameProofData.rlpEncodedFaultDisputeGameData,
    faultDisputeGameProofData.faultDisputeGameAccountProof,
    settlementStateRoot,
  )
  try {
    const proveWorldStateCannonTx =
      await s.ecoTestNetProverContract.proveWorldStateCannon(
        networkIds.optimismSepolia,
        rlpEncodedEndBatchBlockData,
        endBatchBlockData.stateRoot,
        disputeGameFactoryProofData,
        faultDisputeGameProofData,
        settlementStateRoot,
      )
    await proveWorldStateCannonTx.wait()
    console.log('ProveWorldStateCannon Base to EcoTestNet')
    return endBatchBlockData
  } catch (e) {
    if (e.data && s.ecoTestNetProverContract) {
      const decodedError = s.ecoTestNetProverContract.interface.parseError(
        e.data,
      )
      console.log(`Transaction failed: ${decodedError?.name}`)
      console.log(`Error in ProveWorldStateCannon ecoTestNet:`, e.shortMessage)
    } else {
      console.log(`Error in ProveWorldStateCannon ecoTestNet:`, e)
    }
  }
}

async function proveWorldStateOptimismSepoliaOnBaseSepolia(
  settlementBlockTag,
  settlementStateRoot,
  faultDisputeGameAddress,
  faultDisputeGameContract,
  gameIndex,
) {
  console.log('In proveWorldStateCannonBaseToBaseSepolia')
  // For more information on how DisputeGameFactory utility functions, see the following code
  // https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/lib/LibUDT.sol#L82
  // get the endBatchBlockData

  // Note: For all proofs we use two block numbers
  // For anything related to the settlement chain we use settlementBlockTag
  // For anything related to the destination chain we use endBatchBlockHex
  // Get the faultDisputeGame game data
  const faultDisputeGameData = await faultDisputeGameContract.gameData()
  const faultDisputeGameCreatedAt = await faultDisputeGameContract.createdAt()
  const faultDisputeGameResolvedAt = await faultDisputeGameContract.resolvedAt()
  const faultDisputeGameGameStatus = await faultDisputeGameContract.status()
  const faultDisputeGameInitialized = true
  const faultDisputeGameL2BlockNumberChallenged = false
  const faultDisputeGameL2BlockNumber =
    await faultDisputeGameContract.l2BlockNumber()
  const endBatchBlockHex = toQuantity(faultDisputeGameL2BlockNumber)
  const endBatchBlockData = await s.optimismSepoliaProvider.send(
    'eth_getBlockByNumber',
    [endBatchBlockHex, false],
  )
  const rlpEncodedEndBatchBlockData =
    await utils.getRLPEncodedBlock(endBatchBlockData)

  // Get the Message Parser State Root at the end block of the batch
  const l2MesagePasserProof = await s.optimismSepoliaProvider.send(
    'eth_getProof',
    [
      networks.optimismSepolia.proving.l2l1MessageParserAddress,
      [],
      endBatchBlockHex,
    ],
  )

  // Get the DisputeGameFactory data GameId
  const faultDisputeGameId = await s.baseSepoliaProverContract.pack(
    faultDisputeGameData.gameType_,
    faultDisputeGameCreatedAt,
    faultDisputeGameAddress,
  )

  // disputeGameFactoryStorageSlot is where the gameId is stored
  // In solidity
  // uint256(keccak256(abi.encode(L2_DISPUTE_GAME_FACTORY_LIST_SLOT_NUMBER)))
  //                       + disputeGameFactoryProofData.gameIndex
  const disputeGameFactorySlotNumber = 104
  const disputeGameFactoryGameIndex = gameIndex
  const arrayLengthSlot = zeroPadValue(
    toBeArray(disputeGameFactorySlotNumber),
    32,
  )
  const firstElementSlot = solidityPackedKeccak256(
    ['bytes32'],
    [arrayLengthSlot],
  )
  const disputeGameFactoryStorageSlot = toBeHex(
    BigInt(firstElementSlot) + BigInt(Number(disputeGameFactoryGameIndex)),
    32,
  )
  const disputeGameFactoryProof = await s.sepoliaProvider.send('eth_getProof', [
    networks.sepolia.settlementContracts.optimismSepolia,
    [disputeGameFactoryStorageSlot],
    settlementBlockTag,
  ])
  const disputeGameFactoryContractData = [
    toBeHex(disputeGameFactoryProof.nonce), // nonce
    stripZerosLeft(toBeHex(disputeGameFactoryProof.balance)), // balance
    disputeGameFactoryProof.storageHash, // storageHash
    disputeGameFactoryProof.codeHash, // CodeHash
  ]
  const RLPEncodedDisputeGameFactoryData =
    await s.baseSepoliaProverContract.rlpEncodeDataLibList(
      disputeGameFactoryContractData,
    )
  // populate fields for the DisputeGameFactory proof
  const disputeGameFactoryProofData = {
    messagePasserStateRoot: l2MesagePasserProof.storageHash,
    latestBlockHash: endBatchBlockData.hash,
    gameIndex: disputeGameFactoryGameIndex,
    gameId: faultDisputeGameId,
    disputeFaultGameStorageProof: disputeGameFactoryProof.storageProof[0].proof,
    rlpEncodedDisputeGameFactoryData: RLPEncodedDisputeGameFactoryData,
    disputeGameFactoryAccountProof: disputeGameFactoryProof.accountProof,
  }

  // populate fields for the FaultDisputeGame rootclaim proof
  // Storage proof for faultDisputeGame root claim
  // rootClaimSlot - hardcooded value for the slot which is a keecak256 hash  the slot for rootClaim

  const faultDisputeGameRootClaimStorageSlot =
    '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
  const faultDisputeGameRootClaimProof = await s.sepoliaProvider.send(
    'eth_getProof',
    [
      faultDisputeGameAddress,
      [faultDisputeGameRootClaimStorageSlot],
      settlementBlockTag,
    ],
  )
  // Storage proof for faultDisputeGame resolved
  // rootClaimSlot - hardcoded value for slot zero which is where the status is stored
  const faultDisputeGameResolvedStorageSlot =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  // '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ad1'
  const faultDisputeGameRootResolvedProof = await s.sepoliaProvider.send(
    'eth_getProof',
    [
      faultDisputeGameAddress,
      [faultDisputeGameResolvedStorageSlot],
      settlementBlockTag,
    ],
  )
  const faultDisputeGameContractData = [
    toBeHex(faultDisputeGameRootClaimProof.nonce), // nonce
    stripZerosLeft(toBeHex(faultDisputeGameRootClaimProof.balance)), // balance
    faultDisputeGameRootClaimProof.storageHash, // storageHash
    faultDisputeGameRootClaimProof.codeHash, // CodeHash
  ]
  const RLPEncodedFaultDisputeGameContractData =
    await s.baseSepoliaProverContract.rlpEncodeDataLibList(
      faultDisputeGameContractData,
    )
  const faultDisputeGameProofData = {
    // faultDisputeGameStateRoot: endBatchBlockData.stateRoot,
    faultDisputeGameStateRoot: faultDisputeGameRootClaimProof.storageHash,
    faultDisputeGameRootClaimStorageProof:
      faultDisputeGameRootClaimProof.storageProof[0].proof,
    faultDisputeGameStatusSlotData: {
      createdAt: faultDisputeGameCreatedAt,
      resolvedAt: faultDisputeGameResolvedAt,
      gameStatus: faultDisputeGameGameStatus,
      initialized: faultDisputeGameInitialized,
      l2BlockNumberChallenged: faultDisputeGameL2BlockNumberChallenged,
    },
    // populate fields for the FaultDisputeGame resolved proof
    faultDisputeGameStatusStorageProof:
      faultDisputeGameRootResolvedProof.storageProof[0].proof,
    rlpEncodedFaultDisputeGameData: RLPEncodedFaultDisputeGameContractData,
    faultDisputeGameAccountProof: faultDisputeGameRootClaimProof.accountProof,
  }

  // try {
  // Note: ProveStorage and ProveAccount are pure functions and included here just for unit testing
  const { gameProxy_ } = await s.baseSepoliaProverContract.unpack(
    disputeGameFactoryProofData.gameId,
  )
  // proveStorageDisputeGameFactory
  await s.baseSepoliaProverContract.proveStorage(
    disputeGameFactoryStorageSlot,
    encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameId))),
    // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
    disputeGameFactoryProof.storageProof[0].proof,
    disputeGameFactoryProof.storageHash,
  )
  // proveAccountDisputeGameFactory
  await s.baseSepoliaProverContract.proveAccount(
    networks.sepolia.settlementContracts.optimismSepolia,
    disputeGameFactoryProofData.rlpEncodedDisputeGameFactoryData,
    disputeGameFactoryProofData.disputeGameFactoryAccountProof,
    settlementStateRoot,
  )
  // proveStorageFaultDisputeGameRootClaim
  await s.baseSepoliaProverContract.proveStorage(
    faultDisputeGameRootClaimStorageSlot,
    encodeRlp(toBeHex(stripZerosLeft(faultDisputeGameData.rootClaim_))),
    // encodeRlp(cannon.faultDisputeGameRootClaimStorage),
    faultDisputeGameRootClaimProof.storageProof[0].proof,
    faultDisputeGameRootClaimProof.storageHash,
  )
  // proveStorageFaultDisputeGameResolved
  await s.baseSepoliaProverContract.proveStorage(
    faultDisputeGameResolvedStorageSlot,
    await s.baseSepoliaProverContract.assembleGameStatusStorage(
      faultDisputeGameCreatedAt,
      faultDisputeGameResolvedAt,
      faultDisputeGameGameStatus,
      faultDisputeGameInitialized,
      faultDisputeGameL2BlockNumberChallenged,
    ),
    faultDisputeGameRootResolvedProof.storageProof[0].proof,
    faultDisputeGameRootResolvedProof.storageHash,
  )
  // proveAccountFaultDisputeGame
  await s.baseSepoliaProverContract.proveAccount(
    // faultDisputeGameAddress,
    // '0x4D664dd0f78673034b29E4A51177333D1131Ac44',
    gameProxy_,
    faultDisputeGameProofData.rlpEncodedFaultDisputeGameData,
    faultDisputeGameProofData.faultDisputeGameAccountProof,
    settlementStateRoot,
  )
  try {
    const proveWorldStateCannonTx =
      await s.baseSepoliaProverContract.proveWorldStateCannon(
        networkIds.optimismSepolia,
        rlpEncodedEndBatchBlockData,
        endBatchBlockData.stateRoot,
        disputeGameFactoryProofData,
        faultDisputeGameProofData,
        settlementStateRoot,
      )
    await proveWorldStateCannonTx.wait()
    console.log('ProveWorldStateCannon Base to Optimism')
    return endBatchBlockData
  } catch (e) {
    if (e.data && s.baseSepoliaProverContract) {
      const decodedError = s.baseSepoliaProverContract.interface.parseError(
        e.data,
      )
      console.log(`Transaction failed: ${decodedError?.name}`)
      console.log(`Error in ProveWorldStateCannon baseSepolia:`, e.shortMessage)
    } else {
      console.log(`Error in ProveWorldStateCannon baseSepolia:`, e)
    }
  }
}

async function proveWorldStatesCannonL2L3(
  faultDisputeGameAddress,
  faultDisputeGameContract,
  gameIndex,
) {
  console.log('In proveWorldStatesCannonL2L3')
  const { settlementBlockTag, settlementWorldStateRoot } =
    await proveSepoliaSettlementLayerStateOnEcoTestNet() // Prove the Sepolia Settlement Layer State

  const endBatchBlockData = await proveWorldStateOptimismSepoliaOnEcoTestNet(
    settlementBlockTag,
    settlementWorldStateRoot,
    faultDisputeGameAddress,
    faultDisputeGameContract,
    gameIndex,
  )
  return endBatchBlockData
}

async function proveWorldStatesCannon(
  faultDisputeGameAddress,
  faultDisputeGameContract,
  gameIndex,
) {
  console.log('In proveWorldStatesCannon')
  const { settlementBlockTag, settlementWorldStateRoot } =
    await proveSepoliaSettlementLayerStateOnBaseSepolia() // Prove the Sepolia Settlement Layer State

  const endBatchBlockData = await proveWorldStateOptimismSepoliaOnBaseSepolia(
    settlementBlockTag,
    settlementWorldStateRoot,
    faultDisputeGameAddress,
    faultDisputeGameContract,
    gameIndex,
  )
  return endBatchBlockData
}

export async function proveDestinationChainBatchSettled(
  gameIndex,
  faultDisputeGameAddress,
  faultDisputeGameContract,
  sourceChains,
) {
  console.log('In proveDestinationChainBatchSettled')
  let endBatchBlockData
  await Promise.all(
    await Object.entries(sourceChains).map(
      async ([sourceChainkey, sourceChain]) => {
        if (sourceChain.needNewProvenState) {
          // TODO: remove switch statement and use the sourceChain Layer to get the correct proving mechanism
          switch (sourceChain.sourceChain) {
            case networkIds.baseSepolia: {
              endBatchBlockData = await proveWorldStatesCannon(
                faultDisputeGameAddress,
                faultDisputeGameContract,
                gameIndex,
              )
              break
            }
            case networkIds.optimismSepolia: {
              break
            }
            case networkIds.ecoTestNet: {
              endBatchBlockData = await proveWorldStatesCannonL2L3(
                faultDisputeGameAddress,
                faultDisputeGameContract,
                gameIndex,
              )
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

async function proveIntentBaseSepolia(intentHash, endBatchBlockData) {
  console.log('In proveIntentBaseSepolia')
  const inboxStorageSlot = solidityPackedKeccak256(
    ['bytes'],
    [s.abiCoder.encode(['bytes32', 'uint256'], [intentHash, 1])],
  )
  const intentInboxProof = await s.optimismSepoliaProvider.send(
    'eth_getProof',
    [
      networks.optimismSepolia.inbox.address,
      [inboxStorageSlot],
      endBatchBlockData.number,
    ],
  )

  const intentInfo =
    await s.baseSepoliaIntentSourceContractClaimant.getIntent(intentHash)

  const abiCoder = AbiCoder.defaultAbiCoder()
  const intermediateHash = keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'address[]', 'bytes[]', 'uint256', 'bytes32'],
      [
        networkIds.baseSepolia, // sourceChainID
        intentInfo[1], // destinationChainID
        intentInfo[2], // targetTokens
        intentInfo[3], // callData
        intentInfo[6], // expiryTime
        getBytes(intentInfo[8]), // nonce),
      ],
    ),
  )

  try {
    const proveIntentTx = await s.baseSepoliaProverContract.proveIntent(
      networkIds.optimismSepolia,
      actors.claimant,
      networks.optimismSepolia.inbox.address,
      intermediateHash,
      intentInboxProof.storageProof[0].proof,
      await s.baseSepoliaProverContract.rlpEncodeDataLibList([
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
    if (e.data && s.baseSepoliaProverContract) {
      const decodedError = s.baseSepoliaProverContract.interface.parseError(
        e.data,
      )
      console.log(`Transaction failed in proveIntent : ${decodedError?.name}`)
      console.log('proveIntent decodedError: ', decodedError)
    } else {
      console.log(`Error in proveIntent:`, e)
    }
  }
}

async function proveIntentEcoTestNet(intentHash, endBatchBlockData) {
  console.log('In proveIntentEcoTestNet')
  const inboxStorageSlot = solidityPackedKeccak256(
    ['bytes'],
    [s.abiCoder.encode(['bytes32', 'uint256'], [intentHash, 1])],
  )
  const intentInboxProof = await s.optimismSepoliaProvider.send(
    'eth_getProof',
    [
      networks.optimismSepolia.inbox.address,
      [inboxStorageSlot],
      endBatchBlockData.number,
    ],
  )

  const intentInfo =
    await s.ecoTestNetIntentSourceContractClaimant.getIntent(intentHash)

  const abiCoder = AbiCoder.defaultAbiCoder()
  const intermediateHash = keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'address[]', 'bytes[]', 'uint256', 'bytes32'],
      [
        networkIds.ecoTestNet, // sourceChainID
        intentInfo[1], // destinationChainID
        intentInfo[2], // targetTokens
        intentInfo[3], // callData
        intentInfo[6], // expiryTime
        getBytes(intentInfo[8]), // nonce),
      ],
    ),
  )

  try {
    const proveIntentTx = await s.ecoTestNetProverContract.proveIntent(
      networkIds.optimismSepolia,
      actors.claimant,
      networks.optimismSepolia.inbox.address,
      intermediateHash,
      intentInboxProof.storageProof[0].proof,
      await s.ecoTestNetProverContract.rlpEncodeDataLibList([
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
    if (e.data && s.ecoTestNetProverContract) {
      const decodedError = s.ecoTestNetProverContract.interface.parseError(
        e.data,
      )
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
      case networkIds.baseSepolia: {
        await proveIntentBaseSepolia(intent.intentHash, endBatchBlockData)
        break
      }
      case networkIds.optimismSepolia: {
        break
      }
      case networkIds.ecoTestNet: {
        await proveIntentEcoTestNet(intent.intentHash, endBatchBlockData)
        break
      }
    }
  }
}

async function withdrawRewardBaseSepolia(intentHash) {
  console.log('In withdrawReward')
  try {
    const withdrawTx =
      await s.baseSepoliaIntentSourceContractClaimant.withdrawRewards(
        intentHash,
      )
    await withdrawTx.wait()
    console.log('Withdrawal tx: ', withdrawTx.hash)
    return withdrawTx.hash
  } catch (e) {
    if (e.data && s.baseSepoliaIntentSourceContractClaimant) {
      const decodedError =
        s.baseSepoliaIntentSourceContractClaimant.interface.parseError(e.data)
      console.log(
        `Transaction failed in withdrawReward : ${decodedError?.name}`,
      )
    } else {
      console.log(`Error in withdrawReward:`, e)
    }
  }
}

async function withdrawRewardEcoTestNet(intentHash) {
  console.log('In withdrawReward')
  try {
    const withdrawTx =
      await s.ecoTestNetIntentSourceContractClaimant.withdrawRewards(intentHash)
    await withdrawTx.wait()
    console.log('Withdrawal tx: ', withdrawTx.hash)
    return withdrawTx.hash
  } catch (e) {
    if (e.data && s.ecoTestNetIntentSourceContractClaimant) {
      const decodedError =
        s.ecoTestNetIntentSourceContractClaimant.interface.parseError(e.data)
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
    console.log('intent: ', intent)
    switch (intent.sourceChain) {
      case networkIds.baseSepolia: {
        await withdrawRewardBaseSepolia(intent.intentHash)
        break
      }
      case networkIds.optimismSepolia: {
        break
      }
      case networkIds.ecoTestNet: {
        await withdrawRewardEcoTestNet(intent.intentHash)
        break
      }
    }
  }
}

async function main() {
  const { l1SettlementBlockTag, settlementWorldStateRoot } =
    await proveSepoliaSettlementLayerStateOnEcoTestNet()
  console.log('l1SettlementBlockTag: ', l1SettlementBlockTag)
  console.log('settlementWorldStateRoot: ', settlementWorldStateRoot)
  // const proveAll: boolean = true
  // // define the variables used for each state of the intent lifecycle
  // // Point in time proving for latest batch
  // // let intentHash, intentFulfillTransaction
  // try {
  //   console.log('In Main')
  //   console.log('Batch Settle of OP Sepolia')
  //   // Get the latest Batch Settled for OP Sepolia
  //   const {
  //     blockNumber,
  //     gameIndex,
  //     faultDisputeGameAddress,
  //     faultDisputeGameContract,
  //   } = await getBatchSettled()

  //   // Get all the intents that can be proven for the batch by destination chain
  //   const { sourceChains, intentsToProve } = await getIntentsToProve(
  //     blockNumber,
  //     proveAll,
  //   )
  //   // Prove the latest batch settled
  //   const endBatchBlockData = await proveDestinationChainBatchSettled(
  //     gameIndex,
  //     faultDisputeGameAddress,
  //     faultDisputeGameContract,
  //     sourceChains,
  //   )
  //   // Prove all the intents
  //   await proveIntents(intentsToProve, endBatchBlockData)
  //   await withdrawFunds(intentsToProve)
  // } catch (e) {
  //   console.log(e)
  // }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})