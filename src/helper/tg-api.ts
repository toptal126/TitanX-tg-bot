const fetch = require("node-fetch");

export const getMeBot = async (botToken: string) => {
    return await (
        await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    ).json();
};

export const fetchPriceFromApi = async (tokenAddress: string) => {
    return await (
        await fetch(
            `https://api.pancakeswap.info/api/v2/tokens/${tokenAddress}`
        )
    ).json();
};
