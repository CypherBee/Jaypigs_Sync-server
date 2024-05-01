import axios from "axios";
import { decodeRentEventLogData, decodeStakeEventLogData, decodeUnstakeEventLogData, rentEvent } from "./blockchain";
import { CovalentMetadata, RentEvent, ShortNft, StakeEvent, UnstakeEvent } from "./types";
import { stakeEvent, unstakeEvent } from "./blockchain";

export const getCovalentEvents = async (
    currentBlock: number,
    timestamp: number,
    step: number,
    contract: string,
    chainId: number
) => {
    const stakeEvents = new Map<string, StakeEvent>();
    const unstakeEvents = new Map<string, UnstakeEvent>();
    const rentEvents = new Map<string, RentEvent>()

    /**
     * Turn around for loop -> from small to latest
     */

    for (
        let i = timestamp;
        i < currentBlock;
        i = i + step
    ) {
        console.log("EVENTS", i, " TO ", i + step)

        const [stakeLogs, unstakeLogs, rentLogs] = await Promise.all([
            axios.get(
                `https://api.covalenthq.com/v1/${chainId
                }/events/topics/${stakeEvent}/?starting-block=${i
                }&ending-block=${i + step >= currentBlock ? "latest" : i + step}&sender-address=${contract}&key=${process.env.COVALENT_API}`
            ),

            axios.get(
                `https://api.covalenthq.com/v1/${chainId
                }/events/topics/${unstakeEvent}/?starting-block=${i
                }&ending-block=${i + step >= currentBlock ? "latest" : i + step}&sender-address=${contract}&key=${process.env.COVALENT_API}`
            ),
            axios.get(
                `https://api.covalenthq.com/v1/${chainId
                }/events/topics/${rentEvent}/?starting-block=${i
                }&ending-block=${i + step >= currentBlock ? "latest" : i + step}&sender-address=${contract}&key=${process.env.COVALENT_API}`
            ),
        ]);

        stakeLogs.data.data.items.forEach((log: Record<string, string>) => {
            const event = decodeStakeEventLogData(
                log.raw_log_data,
                log.block_signed_at
            );

            const nft = `${event.address}+${event.tokenId}+${chainId}`
            const nftEvent = stakeEvents.get(nft);
            if (!nftEvent || nftEvent.timestamp < event.timestamp) {
                stakeEvents.set(nft, event);
            }
        });

        unstakeLogs.data.data.items.forEach((log: Record<string, string>) => {
            const event = decodeUnstakeEventLogData(
                log.raw_log_data,
                log.block_signed_at
            );

            const nft = `${event.address}+${event.tokenId}+${chainId}`
            const nftEvent = unstakeEvents.get(nft);
            if (!nftEvent || nftEvent.timestamp < event.timestamp) {
                unstakeEvents.set(nft, event);
            }
        });

        rentLogs.data.data.items.forEach((log: Record<string, string>) => {
            const event = decodeRentEventLogData(log.raw_log_data, chainId, log.block_signed_at)
            const nft = `${event.contractAddress}+${event.tokenId}+${chainId}`
            if (event.expires > BigInt(parseInt((Date.now() / 1000).toString()))) {
                stakeEvents.delete(nft)
                rentEvents.set(nft, event)
            }
        });
    }

    return { stakeEvents, unstakeEvents, rentEvents }
}

export const getCovalentMetadata = async (chainId: number, tokenId: number | string | bigint, contractAddress: string): Promise<CovalentMetadata | undefined> => {
    try {
        const options = {
            method: 'GET',
            url: `https://api.covalenthq.com/v1/${chainId}/tokens/${contractAddress}/nft_metadata/${tokenId}/?quote-currency=USD&format=JSON&key=${process.env.COVALENT_API}`,
            timeout: 2000,
        };
        console.log(" -- FETCH_COVALENT", chainId, contractAddress, tokenId)

        const res = await axios.request<any>(options);
        const data = res.data.data.items[0];

        console.log(" -- FETCH_COVALENT_DONE", chainId, contractAddress, tokenId)

        const metadata = res.data.data.items[0].nft_data[0];
        return {
            chainId: chainId,
            collectionAddress: contractAddress,
            collectionName: data.contract_name,
            img: metadata.external_data?.image_1024 ?? '',
            tokenId: tokenId,
            tokenName: `${data.contract_name} #${tokenId}`
        }
    } catch (error) {
        return undefined
    }
}