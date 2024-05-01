require('dotenv').config();

import { schedule } from "node-cron"
import mongoose from "mongoose"
import { RentEvent, ShortNft } from "./types";
import { blockchains, getBlockchainMetadata, getContractEvents } from "./blockchain";
import { NftModel, TimeModel } from "./schemas";
import { getCovalentEvents, getCovalentMetadata } from "./covalent";
import fs from "fs"


const handlerFn = async () => {

    console.log("")
    console.log("+++ START +++")

    await mongoose.connect(process.env.DATABASE_URL ?? "")

    console.log("MONGO_CONNECTED")

    const currentNfts = await NftModel.find()

    console.log("NFTS_IN_DB", currentNfts.length)

    for (let index = 0; index < blockchains.length; index++) {
        const chain = blockchains[index];

        console.log("CHAIN", chain.name)

        const dbTime = await TimeModel.findOneAndDelete({ chainId: chain.id })
        const timestamp = dbTime?.timeStamp ?? chain.deployTime

        const currentBlock = (await chain.provider.getBlockNumber()) - 15; //timestamp + 20_000// (await chain.provider.getBlockNumber()) - 10;

        const step = currentBlock - timestamp < 900_000 ? currentBlock - timestamp : 900_000;
        // const minus = currentBlock - timestamp < 10_000 ? currentBlock - timestamp : 10_000;

        const nftsForThisChain = currentNfts.filter(it => it.chainId === chain.id)

        const updateStakeQueue: Set<ShortNft> = new Set()
        const updateUnStakeQueue: Set<ShortNft> = new Set()
        const createStakeQueue: Set<ShortNft> = new Set()
        const updateRentQueue: Set<RentEvent> = new Set()

        // const { stakeEvents, unstakeEvents } = await getContractEvents(chain.contract, chain.provider, currentBlock, timestamp, minus, chain.id)
        const { stakeEvents, unstakeEvents, rentEvents } = await getCovalentEvents(currentBlock, timestamp, step, chain.contract, chain.id)

        // console.log("stake event ", stakeEvents.size)
        // console.log("unstake event ", unstakeEvents.size)
        // console.log("rent envent", rentEvents.size)

        stakeEvents.forEach((value, key) => {
            const unstaked = unstakeEvents.get(key);

            if (unstaked && unstaked.timestamp > value.timestamp) {
                stakeEvents.delete(key);
            } else {
                unstakeEvents.delete(key)
            }
        });

        for (let i = 0; i < nftsForThisChain.length; i++) {
            const elem = nftsForThisChain[i];
            const nft = `${elem.collectionAddress}+${elem.tokenId}+${elem.chainId}`

            if (stakeEvents.delete(nft)) {
                updateStakeQueue.add({ address: elem.collectionAddress ?? "", tokenId: BigInt(elem.tokenId ?? 0), chainId: elem.chainId ?? 0 })
            }

            if (unstakeEvents.delete(nft)) {
                updateUnStakeQueue.add({ address: elem.collectionAddress ?? "", tokenId: BigInt(elem.tokenId ?? 0), chainId: elem.chainId ?? 0 })
            }

            const rent = rentEvents.get(nft)
            if (rent) {
                updateRentQueue.add(rent)
                rentEvents.delete(nft)
            }
        }

        stakeEvents.forEach((value, key) => {
            createStakeQueue.add({ address: value.address, chainId: chain.id, tokenId: value.tokenId })
        })

        rentEvents.forEach((value, key) => {
            createStakeQueue.add({ address: value.contractAddress, chainId: chain.id, tokenId: value.tokenId })
        })

        const operations = []

        if (createStakeQueue.size > 0) {
            console.log("CREATE_QUEUE", createStakeQueue.size)
        }

        if (updateStakeQueue.size > 0) {
            console.log("UPDATE_QUEUE", updateStakeQueue.size)
        }

        if (updateRentQueue.size > 0) {
            console.log("RENT_QUEUE", updateStakeQueue.size)
        }

        if (createStakeQueue.size === 0 && updateStakeQueue.size === 0 && updateRentQueue.size === 0) {
            console.log("NO_EVENTS")
        }


        for (let i = 0; i < Array.from(createStakeQueue).length; i++) {
            const nft = Array.from(createStakeQueue)[i];

            const covalentMetadata = await getCovalentMetadata(chain.id, nft.tokenId, nft.address)
            const blockchainMetadata = await getBlockchainMetadata(nft.address, nft.tokenId, chain.provider, chain.id, chain.contract)

            if (!covalentMetadata) {
                console.error("ERROR_COVALENT", nft.chainId, nft.address, nft.tokenId)
            }

            if (!blockchainMetadata) {
                console.error("ERROR_CHAIN", nft.chainId, nft.address, nft.tokenId)
            }

            if (covalentMetadata && blockchainMetadata) {
                operations.push(
                    {
                        insertOne: {
                            document: new NftModel({
                                chainId: chain.id,
                                collectionAddress: nft.address,
                                collectionName: covalentMetadata.collectionName,
                                deadline: Number(blockchainMetadata.deadline),
                                destinationChainId: blockchainMetadata.destinationChainId,
                                expires: Number(blockchainMetadata.expires),
                                img: covalentMetadata.img,
                                maxTime: Number(blockchainMetadata.maxTime),
                                minTime: Number(blockchainMetadata.minTime),
                                owner: blockchainMetadata.owner,
                                price: Number(blockchainMetadata.price),
                                tokenId: Number(nft.tokenId),
                                tokenName: covalentMetadata.tokenName,
                                borrower: blockchainMetadata.borrower,
                                staked: true
                            })
                        }
                    }
                )
            }

        }

        for (let i = 0; i < Array.from(updateStakeQueue).length; i++) {
            const nft = Array.from(updateStakeQueue)[i];

            const blockchainMetadata = await getBlockchainMetadata(nft.address, nft.tokenId, chain.provider, chain.id, chain.contract)

            if (!blockchainMetadata) {
                console.error("ERROR_CHAIN", nft.chainId, nft.address, nft.tokenId)
                continue
            }

            operations.push({
                updateOne: {
                    filter: {
                        collectionAddress: nft.address,
                        tokenId: Number(nft.tokenId),
                        chainId: nft.chainId
                    },
                    update: {
                        $set: {
                            staked: true,
                            deadline: Number(blockchainMetadata?.deadline),
                            destinationChainId: blockchainMetadata?.destinationChainId,
                            expires: Number(blockchainMetadata?.expires),
                            maxTime: Number(blockchainMetadata?.maxTime),
                            minTime: Number(blockchainMetadata?.minTime),
                            owner: blockchainMetadata?.owner,
                            price: Number(blockchainMetadata?.price),
                            tokenId: Number(nft.tokenId),
                            borrower: blockchainMetadata?.borrower,
                        }
                    }
                }
            })
        }

        for (let i = 0; i < Array.from(updateUnStakeQueue).length; i++) {
            const nft = Array.from(updateUnStakeQueue)[i];

            operations.push({
                updateOne: {
                    filter: {
                        collectionAddress: nft.address,
                        tokenId: Number(nft.tokenId),
                        chainId: nft.chainId
                    },
                    update: { $set: { staked: false } }
                }
            })
        }

        for (let i = 0; i < Array.from(updateRentQueue).length; i++) {
            const nft = Array.from(updateRentQueue)[i];

            operations.push({
                updateOne: {
                    filter: {
                        collectionAddress: nft.contractAddress,
                        tokenId: Number(nft.tokenId),
                        chainId: nft.chainId
                    },
                    update: {
                        $set: {
                            expires: Number(nft.expires),
                            destinationChain: nft.destinationChain,
                            borrower: nft.user
                        }
                    }
                }
            })
        }

        await NftModel.bulkWrite(operations)
        await TimeModel.create({
            chainId: chain.id,
            timeStamp: currentBlock
        })

        // await fs.promises.writeFile(`result-${chain.id}.json`, json)
        // console.log("Saving nfts for " + chain.name + " total: ", Array.from(stakeEvents.values()).length)

        // await NftModel.bulkSave(Array.from(stakeEvents.values())
        //     .map(it => new NftModel({ address: it.address, tokenId: it.tokenId.toString(), owner: it.owner, price: it.price.toString(), chainId: chain.id })))
    }

    // console.log("Saving Times")

    // await TimeModel.bulkSave(blockchains.map(it => new TimeModel({ chainId: it.id, timeStamp: parseInt((Date.now() / 1000).toString()) })))

    console.log("+++ DONE +++")

    mongoose.connection.close()
}


// const handlerFn = () => {
//     console.log("first")
// }

schedule("* * * * *", async () => {
    await handlerFn()
})

// handlerFn().catch(err => {
//     console.error(err)
// })
