import mongoose, { Schema } from "mongoose"

const timeSchema = new Schema({
    chainId: Number,
    timeStamp: Number
}, { timestamps: true })

const NftSchema = new Schema({
    collectionAddress: String,
    tokenId: Number,
    collectionName: String,
    tokenName: String,
    img: String,
    owner: String,
    price: Number,
    deadline: Number,
    minTime: Number,
    maxTime: Number,
    expires: Number,
    destinationChainId: Number,
    chainId: Number,
    staked: Boolean,
    borrower: String
}, { timestamps: true })

export const TimeModel = mongoose.model("Time2", timeSchema)
export const NftModel = mongoose.model("Nft2", NftSchema)