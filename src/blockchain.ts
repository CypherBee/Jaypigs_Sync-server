import { Contract, ethers } from "ethers";
import { ChainMetadata, LendingInfo, RentEvent, StakeEvent, UnstakeEvent } from "./types";

export const getProvider = (chainId: number) => {
  let url = "";

  if (chainId === 43113) {
    url = `https://avalanche-fuji.infura.io/v3/` + process.env.INFURA_API;
  }
  if (chainId === 97) {
    url = 'https://radial-flashy-panorama.bsc-testnet.discover.quiknode.pro/' + process.env.QUICKNODE_API;
  }
  if (chainId === 80001) {
    url = 'https://polygon-mumbai.infura.io/v3/' + process.env.INFURA_API;
  }
  if (chainId === 1287) {
    url = 'https://moonbase-alpha.public.blastapi.io';
  }

  return new ethers.providers.JsonRpcProvider(url);
};

export const stakeEvent =
  '0xf65271afc35201e83c229b7b581d7fde59bfe7b7dd943e8719fc8c5f5ada63f6';
export const unstakeEvent =
  '0xd8654fcc8cf5b36d30b3f5e4688fc78118e6d68de60b9994e09902268b57c3e3';
export const rentEvent = "0x08422351c77c03e13bc2eeb8ad60e95389eb3831a73b5068e825c71a4eab04ff"


export const avax_testnet_contract =
  '0x51b258c1D67F0Cc04d7cf9Fe9dE911DB1427947F';

export const bnb_testnet_contract =
  '0x51b258c1D67F0Cc04d7cf9Fe9dE911DB1427947F';

export const mumbai_testnet_contract =
  '0xE22a8363E4Ed66d436D6521b176A8Ad3034018c6';

export const moonbase_testnet_contract =
  '0x7F7c6B8B9a9a9100818A6D189d3b44F72d7E6D6B';

export const blockchains = [
  {
    id: 43113,
    contract: avax_testnet_contract,
    provider: getProvider(43113),
    deployTime: 17851497,
    name: "avalanche-fuji",
    axelar: "Avalanche"
  },
  {
    id: 97,
    contract: bnb_testnet_contract,
    provider: getProvider(97),
    deployTime: 26205129,
    name: "bsc-testnet",
    axelar: "binance"
  },
  {
    id: 80001,
    contract: mumbai_testnet_contract,
    provider: getProvider(80001),
    deployTime: 30751818,
    name: "maticmum",
    axelar: "Polygon"
  },
  {
    id: 1287,
    contract: moonbase_testnet_contract,
    provider: getProvider(1287),
    deployTime: 3731376,
    name: "moonbase-alpha",
    axelar: "Moonbeam"
  },
]

export const axelarToChainId = (chain: string): number => {
  return blockchains.find(it => it.axelar === chain)?.id ?? 0
};

export const decodeStakeEventLogData = (input: string, date?: string): StakeEvent => {

  const [address, tokenId, owner, price] = ethers.utils.defaultAbiCoder.decode(
    ['address', 'uint', 'address', 'uint'],
    input
  );
  const timestamp = date ? BigInt(Date.parse(date)) : BigInt(0)

  return { address, tokenId, owner, price, timestamp };
};

export const decodeRentEventLogData = (input: string, chainId: number, date?: string): RentEvent => {

  const [user, contractAddress, tokenId, expires, destinationChain] = ethers.utils.defaultAbiCoder.decode(
    ['address', "address", 'uint', "uint", 'string'],
    input
  );
  const timestamp = date ? BigInt(Date.parse(date)) : BigInt(0)

  return { contractAddress, tokenId, user, expires, destinationChain, timestamp, chainId };
};

export const decodeUnstakeEventLogData = (
  input: string,
  date?: string
): UnstakeEvent => {

  const [owner, address, tokenId] = ethers.utils.defaultAbiCoder.decode(
    ['address', 'address', 'uint'],
    input
  );
  const timestamp = date ? BigInt(Date.parse(date)) : BigInt(0)
  return { address, owner, tokenId, timestamp };
};


export const getBlockchainMetadata = async (
  tokenAddress: string,
  tokenId: string | number | bigint,
  provider: ethers.providers.JsonRpcProvider,
  chainId: number,
  contractAddress: string
): Promise<ChainMetadata | undefined> => {
  try {

    const contract = new Contract(contractAddress, infoAbi, provider);
    console.log(" -- FETCH_CHAIN", chainId, tokenAddress, tokenId)

    const info: LendingInfo = await contract.lendingInfo(tokenAddress, tokenId)
    console.log(" -- FETCH_CHAIN_DONE", chainId, tokenAddress, tokenId)

    const destinationChainId = info.chain.length > 0 ? axelarToChainId(info.chain) : undefined
    return {
      borrower: info.borrower,
      chainId: chainId,
      collectionAddress: tokenAddress,
      deadline: info.deadline,
      expires: info.expires,
      maxTime: info.maxTime,
      minTime: info.minTime,
      owner: info.owner,
      price: info.price,
      tokenId: tokenId,
      destinationChainId
    }
  } catch (error) {
    return undefined
  }

}

export const getContractEvents = async (
  contractAddress: string,
  provider: ethers.providers.JsonRpcProvider,
  currentBlock: number,
  timestamp: number,
  minus: number,
  chainId: number
) => {

  const contract = new Contract(contractAddress, eventsAbi, provider);

  const stakeEvents = new Map<string, StakeEvent>();
  const unstakeEvents = new Map<string, UnstakeEvent>();

  for (
    let i = currentBlock;
    i > timestamp;
    i = i - minus
  ) {
    console.log("Get events from ", i - minus, " to ", i)

    const [stakeLogs, unstakeLogs] = await Promise.all([
      await contract.queryFilter(stakeEvent, i - minus, i),
      await contract.queryFilter(unstakeEvent, i - minus, i),
    ]);


    for (let i = 0; i < stakeLogs.length; i++) {
      const log = stakeLogs[i];
      const event = decodeStakeEventLogData(log.data);

      const timestamp = (await log.getBlock()).timestamp
      event.timestamp = BigInt(timestamp)

      const nft = `${event.address}+${event.tokenId}+${chainId}`
      const nftEvent = stakeEvents.get(nft);
      if (!nftEvent || nftEvent.timestamp < event.timestamp) {
        stakeEvents.set(nft, event);
      }
    }

    for (let i = 0; i < unstakeLogs.length; i++) {
      const log = unstakeLogs[i];
      const event = decodeUnstakeEventLogData(log.data);

      const timestamp = (await log.getBlock()).timestamp
      event.timestamp = BigInt(timestamp)

      const nft = `${event.address}+${event.tokenId}+${chainId}`
      const nftEvent = unstakeEvents.get(nft);
      if (!nftEvent || nftEvent.timestamp < event.timestamp) {
        unstakeEvents.set(nft, event);
      }
    }
  }

  return { stakeEvents, unstakeEvents }
}

const infoAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'lendingInfo',
    outputs: [
      {
        internalType: 'string',
        name: 'chain',
        type: 'string',
      },
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'borrower',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'price',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'totalRewards',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'latestReward',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint64',
        name: 'minTime',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'maxTime',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'expires',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'deadline',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'timestamp',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const eventsAbi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "previousAdmin",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "AdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "beacon",
        "type": "address"
      }
    ],
    "name": "BeaconUpgraded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountRefunded",
        "type": "uint256"
      }
    ],
    "name": "Refunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "originalContractAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "expires",
        "type": "uint64"
      }
    ],
    "name": "RentTokenMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "contractAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "expires",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "destinationChain",
        "type": "string"
      }
    ],
    "name": "Rented",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountReceived",
        "type": "uint256"
      }
    ],
    "name": "RewardsClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "contractAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      }
    ],
    "name": "Staked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "contractAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Unstaked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "Upgraded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "contractAddress",
        "type": "address"
      }
    ],
    "name": "WhitelistRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "contractAddress",
        "type": "address"
      }
    ],
    "name": "Whitelisted",
    "type": "event"
  },
]