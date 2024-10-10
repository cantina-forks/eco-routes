// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {SecureMerkleTrie} from "@eth-optimism/contracts-bedrock/src/libraries/trie/SecureMerkleTrie.sol";
import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {RLPWriter} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPWriter.sol";

abstract contract AbstractProver {
    function proveStorage(bytes memory _key, bytes memory _val, bytes[] memory _proof, bytes32 _root) public pure {
        require(SecureMerkleTrie.verifyInclusionProof(_key, _val, _proof, _root), "failed to prove storage");
    }

    function proveAccount(bytes memory _address, bytes memory _data, bytes[] memory _proof, bytes32 _root)
        public
        pure
    {
        require(SecureMerkleTrie.verifyInclusionProof(_address, _data, _proof, _root), "failed to prove account");
    }

    function generateOutputRoot(
        uint256 provingVersion,
        bytes32 worldStateRoot,
        bytes32 messagePasserStateRoot,
        bytes32 latestBlockHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(provingVersion, worldStateRoot, messagePasserStateRoot, latestBlockHash));
    }

    // helper function for getting all rlp data encoded
    function rlpEncodeDataLibList(bytes[] memory dataList) public pure returns (bytes memory) {
        for (uint256 i = 0; i < dataList.length; ++i) {
            dataList[i] = RLPWriter.writeBytes(dataList[i]);
        }

        return RLPWriter.writeList(dataList);
    }
    /// @notice Packs values into a 32 byte GameId type.
    /// @param _gameType The game type.
    /// @param _timestamp The timestamp of the game's creation.
    /// @param _gameProxy The game proxy address.
    /// @return gameId_ The packed GameId.

    function pack(uint32 _gameType, uint64 _timestamp, address _gameProxy) public pure returns (bytes32 gameId_) {
        assembly {
            gameId_ := or(or(shl(224, _gameType), shl(160, _timestamp)), _gameProxy)
        }
    }

    /// @notice Unpacks values from a 32 byte GameId type.
    /// @param _gameId The packed GameId.
    /// @return gameType_ The game type.
    /// @return timestamp_ The timestamp of the game's creation.
    /// @return gameProxy_ The game proxy address.
    function unpack(bytes32 _gameId) public pure returns (uint32 gameType_, uint64 timestamp_, address gameProxy_) {
        assembly {
            gameType_ := shr(224, _gameId)
            timestamp_ := and(shr(160, _gameId), 0xFFFFFFFFFFFFFFFF)
            gameProxy_ := and(_gameId, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
    }

    function bytesToUint(bytes memory b) public pure returns (uint256) {
        uint256 number;
        for (uint256 i = 0; i < b.length; i++) {
            number = number + uint256(uint8(b[i])) * (2 ** (8 * (b.length - (i + 1))));
        }
        return number;
    }

    function assembleGameStatusStorage(
        uint64 createdAt,
        uint64 resolvedAt,
        uint8 gameStatus,
        bool initialized,
        bool l2BlockNumberChallenged
    ) public pure returns (bytes memory gameStatusStorageSlotRLP) {
        // The if test is to remove leaing zeroes from the bytes
        // Assumption is that initialized is always true
        if (l2BlockNumberChallenged) {
            gameStatusStorageSlotRLP = bytes.concat(
                RLPWriter.writeBytes(
                    abi.encodePacked(
                        abi.encodePacked(l2BlockNumberChallenged),
                        abi.encodePacked(initialized),
                        abi.encodePacked(gameStatus),
                        abi.encodePacked(resolvedAt),
                        abi.encodePacked(createdAt)
                    )
                )
            );
        } else {
            gameStatusStorageSlotRLP = bytes.concat(
                RLPWriter.writeBytes(
                    abi.encodePacked(
                        // abi.encodePacked(l2BlockNumberChallenged),
                        abi.encodePacked(initialized),
                        abi.encodePacked(gameStatus),
                        abi.encodePacked(resolvedAt),
                        abi.encodePacked(createdAt)
                    )
                )
            );
        }
    }
}
