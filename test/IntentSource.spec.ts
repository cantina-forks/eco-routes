import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { expect } from 'chai'
import hre from 'hardhat'
import { TestERC20, IntentSource, TestProver } from '../typechain-types'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { DataHexString } from 'ethers/lib.commonjs/utils/data'
import { Block, keccak256, AbiCoder, BytesLike } from 'ethers'
import { NumberLike } from '@nomicfoundation/hardhat-network-helpers/dist/src/types.js'
// import { ERC20 } from '../typechain-types/@openzeppelin/contracts/token/ERC20/ERC20.js'
const { ethers } = hre

describe('Intent Source Test', (): void => {
  let intentSource: IntentSource
  let tokenA: TestERC20
  let tokenB: TestERC20
  let creator: SignerWithAddress
  let solver: SignerWithAddress
  let dest: SignerWithAddress
  let prover: TestProver
  let hash32: string
  let calldata: DataHexString
  const mintAmount: number = 1000
  const minimumDuration = 1000

  let expiry: number
  let identifier: BytesLike
  let chainId: number
  let targets: string[]
  let data: BytesLike[]
  let rewardTokens: string[]
  let rewardAmounts: number[]

  async function deploySourceFixture(): Promise<{
    intentSource: IntentSource
    tokenA: TestERC20
    tokenB: TestERC20
    creator: SignerWithAddress
    solver: SignerWithAddress
  }> {
    const [creator, solver] = await ethers.getSigners()
    dest = creator

    // deploy prover
    const proverFactory = await ethers.getContractFactory('TestProver')
    prover = await proverFactory.deploy()

    const intentSourceFactory = await ethers.getContractFactory('IntentSource')
    const intentSource = await intentSourceFactory.deploy(
      prover,
      minimumDuration
    )

    // deploy ERC20 test
    const erc20Factory = await ethers.getContractFactory('TestERC20')
    const tokenA = await erc20Factory.deploy('A', 'A')
    const tokenB = await erc20Factory.deploy('B', 'B')

    return {
      intentSource,
      tokenA,
      tokenB,
      creator,
      solver,
    }
  }

  async function mintAndApprove() {
    await tokenA.connect(creator).mint(creator.address, mintAmount)
    await tokenB.connect(creator).mint(creator.address, mintAmount * 2)

    await tokenA.connect(creator).approve(intentSource, mintAmount)
    await tokenB.connect(creator).approve(intentSource, mintAmount * 2)
  }

  async function encodeIdentifier(
    counter: number,
    chainid: NumberLike
  ): Promise<DataHexString> {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    const encodedData = abiCoder.encode(
      ['uint256', 'uint256'],
      [counter, chainid]
    )
    return keccak256(encodedData)
  }

  async function encodeTransfer(
    to: string,
    value: number
  ): Promise<DataHexString> {
    // Contract ABIs
    const erc20ABI = ['function transfer(address to, uint256 value)']
    const abiInterface = new ethers.Interface(erc20ABI)
    const callData = abiInterface.encodeFunctionData('transfer', [to, value])
    return callData
  }

  beforeEach(async (): Promise<void> => {
    ;({ intentSource, tokenA, tokenB, creator, solver } = await loadFixture(
      deploySourceFixture
    ))

    // fund the creator and approve it to create an intent
    await mintAndApprove()
    calldata = await encodeTransfer(dest.address, mintAmount)
    // expiryTime = (await time.latest()) + 2 * minimumDuration
    // const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    // const encodedData = abiCoder.encode(
    //   ['uint256', 'address[]', 'bytes[]', 'uint256'],
    //   [nonce, [erc20Address], [calldata], timeStamp]
    // )
    // hash32 = ethers.keccak256(encodedData)
  })

  describe('constructor', () => {
    it('works', async () => {
      //   expect(true).to.eq(true)
      expect(await intentSource.CHAIN_ID()).to.eq(
        (await ethers.provider.getNetwork()).chainId
      )
      expect(await intentSource.PROVER()).to.eq(await prover.getAddress())
      expect(await intentSource.MINIMUM_DURATION()).to.eq(minimumDuration)
      expect(await intentSource.counter()).to.eq(0)
    })
  })
  describe('intent creation', async () => {
    beforeEach(async (): Promise<void> => {
      expiry = (await time.latest()) + minimumDuration + 10
      identifier = await encodeIdentifier(
        0,
        (
          await ethers.provider.getNetwork()
        ).chainId
      )
      chainId = 1
      targets = [await tokenA.getAddress()]
      data = [await encodeTransfer(creator.address, mintAmount)]
      rewardTokens = [await tokenA.getAddress(), await tokenB.getAddress()]
      rewardAmounts = [mintAmount, mintAmount * 2]
    })
    context('fails if', () => {
      it('targets or data length is 0, or if they are mismatched', async () => {
        // mismatch
        await expect(
          intentSource
            .connect(creator)
            .createIntent(
              1,
              [await tokenA.getAddress(), await tokenB.getAddress()],
              [encodeTransfer(creator.address, mintAmount)],
              [await tokenA.getAddress()],
              [mintAmount],
              (await time.latest()) + minimumDuration
            )
        ).to.be.revertedWithCustomError(intentSource, 'CalldataMismatch')
        // length 0
        await expect(
          intentSource
            .connect(creator)
            .createIntent(
              1,
              [],
              [],
              [await tokenA.getAddress()],
              [mintAmount],
              (await time.latest()) + minimumDuration
            )
        ).to.be.revertedWithCustomError(intentSource, 'CalldataMismatch')
      })
      it('rewardTokens or rewardAmounts is 0, or if they are mismatched', async () => {
        // mismatch
        await expect(
          intentSource
            .connect(creator)
            .createIntent(
              1,
              [await tokenA.getAddress()],
              [encodeTransfer(creator.address, mintAmount)],
              [await tokenA.getAddress(), await tokenB.getAddress()],
              [mintAmount],
              (await time.latest()) + minimumDuration
            )
        ).to.be.revertedWithCustomError(intentSource, 'RewardsMismatch')
        // length 0
        await expect(
          intentSource
            .connect(creator)
            .createIntent(
              1,
              [await tokenA.getAddress()],
              [encodeTransfer(creator.address, mintAmount)],
              [],
              [],
              (await time.latest()) + minimumDuration
            )
        ).to.be.revertedWithCustomError(intentSource, 'RewardsMismatch')
      })
      it('expiryTime is too early', async () => {
        await expect(
          intentSource
            .connect(creator)
            .createIntent(
              1,
              [await tokenA.getAddress()],
              [encodeTransfer(creator.address, mintAmount)],
              [await tokenA.getAddress()],
              [mintAmount],
              (await time.latest()) + minimumDuration - 1
            )
        ).to.be.revertedWithCustomError(intentSource, 'ExpiryTooSoon')
      })
    })
    it('creates properly', async () => {
      await intentSource
        .connect(creator)
        .createIntent(
          chainId,
          targets,
          data,
          rewardTokens,
          rewardAmounts,
          expiry
        )
      const intent = await intentSource.intents(identifier)
      // value types
      expect(intent.creator).to.eq(creator.address)
      expect(intent.destinationChain).to.eq(chainId)
      expect(intent.expiryTime).to.eq(expiry)
      expect(intent.hasBeenWithdrawn).to.eq(false)
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const encodedData = abiCoder.encode(
        ['bytes32', 'address[]', 'bytes[]', 'uint256'],
        [identifier, targets, data, expiry]
      )
      expect(intent.intentHash).to.eq(keccak256(encodedData))
      // reference types
      expect(await intentSource.getTargets(identifier)).to.deep.eq(targets)
      expect(await intentSource.getData(identifier)).to.deep.eq(data)
      expect(await intentSource.getRewardTokens(identifier)).to.deep.eq(
        rewardTokens
      )
      expect(await intentSource.getRewardAmounts(identifier)).to.deep.eq(
        rewardAmounts
      )
    })
    it('increments counter and locks up tokens', async () => {
      const counter = await intentSource.counter()
      const initialBalanceA = await tokenA.balanceOf(
        await intentSource.getAddress()
      )
      const initialBalanceB = await tokenA.balanceOf(
        await intentSource.getAddress()
      )
      await intentSource
        .connect(creator)
        .createIntent(
          chainId,
          targets,
          data,
          rewardTokens,
          rewardAmounts,
          expiry
        )
      expect(await intentSource.counter()).to.eq(Number(counter) + 1)
      expect(await tokenA.balanceOf(await intentSource.getAddress())).to.eq(
        Number(initialBalanceA) + rewardAmounts[0]
      )
      expect(await tokenB.balanceOf(await intentSource.getAddress())).to.eq(
        Number(initialBalanceB) + rewardAmounts[1]
      )
    })
    it('emits events', async () => {
      await expect(
        intentSource
          .connect(creator)
          .createIntent(
            chainId,
            targets,
            data,
            rewardTokens,
            rewardAmounts,
            expiry
          )
      )
        .to.emit(intentSource, 'IntentCreated')
        .withArgs(
          identifier,
          await creator.getAddress(),
          chainId,
          targets,
          data,
          rewardTokens,
          rewardAmounts,
          expiry
        )
    })
  })
})