import { Pair, ParsedTokenFromPair, TokenInfo } from "./interface";

const axios = require("axios");

export const API_ENDPOINT = "https://data.titanx.org";

export const getApiUrl = (uri: string) => `${API_ENDPOINT}${uri}`;

export const parseSwapLog = (log: any, tokenInfo: any) => {
    if (tokenInfo === undefined) {
        return {
            amount0:
                parseFloat(log.returnValues.amount0In) +
                parseFloat(log.returnValues.amount0Out),
            amount1:
                parseFloat(log.returnValues.amount1In) +
                parseFloat(log.returnValues.amount1Out),
            price:
                (parseFloat(log.returnValues.amount1In) +
                    parseFloat(log.returnValues.amount1Out)) /
                (parseFloat(log.returnValues.amount0In) +
                    parseFloat(log.returnValues.amount0Out)),
        };
    }
    const result = {
        amount0:
            parseFloat(log.returnValues.amount0In) +
            parseFloat(log.returnValues.amount0Out),
        amount1:
            parseFloat(log.returnValues.amount1In) +
            parseFloat(log.returnValues.amount1Out),
        price:
            (parseFloat(log.returnValues.amount1In) +
                parseFloat(log.returnValues.amount1Out)) /
            (parseFloat(log.returnValues.amount0In) +
                parseFloat(log.returnValues.amount0Out)),
    };
    if (tokenInfo.isBUSDPaired === true) {
        if (tokenInfo.isToken1BUSD === true) {
            result.amount0 = result.amount0 / 10 ** tokenInfo.decimals;
            result.amount1 = result.amount1 / 10 ** 18; //WBNB - decimals
        } else {
            result.amount0 = result.amount0 / 10 ** 18; //WBNB - decimals
            result.amount1 = result.amount1 / 10 ** tokenInfo.decimals;
        }
    } else {
        if (tokenInfo.isToken1BNB === true) {
            result.amount0 = result.amount0 / 10 ** tokenInfo.decimals;
            result.amount1 = result.amount1 / 10 ** 18; //WBNB - decimals
        } else {
            result.amount0 = result.amount0 / 10 ** 18; //WBNB - decimals
            result.amount1 = result.amount1 / 10 ** tokenInfo.decimals;
        }
    }
    return result;
};

export const parseTxSwapLog = (
    logs: any,
    tokenInfo: any,
    coinPrice: number
) => {
    if (!logs || !tokenInfo) return [];
    return logs.map((log: any) => {
        let side = "";
        let totalUSD = 0;
        let priceUSD = 0;
        let quoteAmount = 0;
        const result = parseSwapLog(log, tokenInfo);

        if (tokenInfo.isBUSDPaired === true) {
            if (tokenInfo.isToken1BUSD === true) {
                totalUSD = result.amount1;
                priceUSD = totalUSD / result.amount0;
                quoteAmount = result.amount0;
                log.returnValues.amount0In > 0
                    ? (side = "SELL")
                    : (side = "BUY");
            } else {
                totalUSD = result.amount0;
                priceUSD = totalUSD / result.amount1;
                quoteAmount = result.amount1;
                log.returnValues.amount1In > 0
                    ? (side = "SELL")
                    : (side = "BUY");
            }
        } else {
            if (tokenInfo.isToken1BNB === true) {
                totalUSD = result.amount1 * coinPrice;
                priceUSD = totalUSD / result.amount0;
                quoteAmount = result.amount0;
                log.returnValues.amount0In > 0
                    ? (side = "SELL")
                    : (side = "BUY");
            } else {
                totalUSD = result.amount0 * coinPrice;
                priceUSD = totalUSD / result.amount1;
                quoteAmount = result.amount1;
                log.returnValues.amount1In > 0
                    ? (side = "SELL")
                    : (side = "BUY");
            }
        }
        return {
            coinPrice: coinPrice?.toFixed(3),
            side,
            buyer: log.origin,
            totalUSD: totalUSD,
            priceUSD: priceUSD,
            quoteAmount: quoteAmount.toFixed(3),
            transactionHash: `https://bscscan.com/tx/${log.transactionHash}`,
        };
    });
};
export const extractTokenInfo = (
    pair: Pair,
    tokenInfo: TokenInfo
): ParsedTokenFromPair => {
    let result: ParsedTokenFromPair;
    if (tokenInfo.id == pair.token0) {
        return {
            ...tokenInfo,
            name: pair.token0Name,
            symbol: pair.token0Symbol,
        };
    } else {
        return {
            ...tokenInfo,
            name: pair.token1Name,
            symbol: pair.token1Symbol,
        };
    }
};

export const getLatestCoinPrice = async () => {
    try {
        const response: any = await axios.get(getApiUrl(`/coinprice/latest`));
        return response.data.usdPrice;
    } catch (error) {
        return 0;
    }
};

export const searchPairsByTokenAddress = async (tokenAddress: string) => {
    try {
        const response: any = await axios.get(
            getApiUrl(`/pairs/token/${tokenAddress}`)
        );
        return response.data;
    } catch (error) {
        return 0;
    }
};

export const getTokenInformation = async (tokenAddress: string) => {
    try {
        const response: any = await axios.get(
            getApiUrl(`/coinprice/information/${tokenAddress}`)
        );
        return response.data;
    } catch (error) {
        return 0;
    }
};
