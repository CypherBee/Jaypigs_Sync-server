export type StakeEvent = {
    address: string;
    tokenId: bigint;
    owner: string;
    price: bigint;
    timestamp: bigint;
};

export type RentEvent = {
    user: string
    contractAddress: string
    tokenId: bigint
    expires: bigint
    destinationChain: string
    timestamp: bigint
    chainId: number
};

export type UnstakeEvent = {
    owner: string;
    address: string;
    tokenId: bigint;
    timestamp: bigint;
};

export type CovalentMetadata = {
    collectionAddress: string,
    tokenId: number | string | bigint,
    collectionName: string,
    tokenName: string,
    img: string,
    chainId: number,
}

export type ChainMetadata = {
    collectionAddress: string,
    tokenId: number | string | bigint,
    owner: string,
    price: bigint,
    borrower: string,
    deadline: bigint,
    minTime: bigint,
    maxTime: bigint,
    expires: bigint,
    destinationChainId?: number,
    chainId: number,
}

export type ShortNft = {
    address: string;
    tokenId: bigint;
    chainId: number;
}

export type LendingInfo = {
    chain: string;
    owner: string;
    borrower: string;
    price: bigint;
    totalRewards: bigint;
    latestReward: bigint;
    tokenId: bigint;
    minTime: bigint;
    maxTime: bigint;
    expires: bigint;
    deadline: bigint;
    timestamp: bigint;
};