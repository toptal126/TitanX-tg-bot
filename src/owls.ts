import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
import { DEAD_ADDRESS, OWL_HELP, OWL_RANKS } from "./constants";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";
import {
    extractTokenInfo,
    floatConverter,
    getLatestCoinPrice,
    getTokenInformation,
    parseTxSwapLog,
    queryTokens,
    searchPairsByTokenAddress,
} from "./helper/helpers";
import { connectDB } from "./helper/database-actions";
import { ITrackToken, TrackToken } from "./helper/models/TrackToken";
import {
    ADDING_DONE,
    ADDING_LOGO,
    CUSTOMERSTATUS,
    CUSTOMER_DATA,
    NONE_ACTION,
    Pair,
    SEARCHING_TOKEN,
    TYPING_ADDRESS,
} from "./helper/interface";
import * as drawer from "./helper/image-process";
import { fetchPriceFromApi } from "./helper/tg-api";

const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed1.binance.org/");

require("dotenv").config();

// @ts-ignore
const customerStatus: { [key: string]: CUSTOMER_DATA } = [];
const setCustomerStatus = (
    chatId: string,
    status: CUSTOMERSTATUS = NONE_ACTION
) => {
    if (!customerStatus[chatId]) customerStatus[chatId] = { status };
    else customerStatus[chatId].status = status;
};
const getCustomerStatus = (chatId: string) => {
    if (!customerStatus[chatId])
        customerStatus[chatId] = { status: NONE_ACTION };
    return customerStatus[chatId].status;
};

const launchTitanXOwl = (titanXOwl: ITrackToken) => {
    const token: string = titanXOwl.botToken;
    const bot: Telegraf<Context<Update>> = new Telegraf(token);
    const CHANNEL_ID = titanXOwl.channelId;

    let lastLog: any;

    const adminFilterMiddleWare = () => (ctx: any, next: any) => {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        if (chatId == titanXOwl.channelId) return next();
        if (userId != titanXOwl.userId) {
            ctx.reply("Sorry, You are not allowed to use this bot.");
            return null;
        }
        return next();
    };
    bot.use(adminFilterMiddleWare());

    bot.help((ctx) => {
        ctx.reply(OWL_HELP);
    });
    bot.start((ctx) => {
        ctx.reply(OWL_HELP);
    });

    bot.command("quit", (ctx) => {
        // Explicit usage
        ctx.telegram.leaveChat(ctx.message.chat.id);

        // Context shortcut
        ctx.leaveChat();
    });

    bot.command("delete", async (ctx) => {
        const chatId: string = "" + ctx.chat.id;
        const trackingTarget = await TrackToken.findOne({
            chatId,
        }).exec();
        if (!trackingTarget) {
            bot.telegram.sendMessage(
                ctx.chat.id,
                "You don't have any active tracking bot!"
            );
            return;
        }
        const guideMessage = `You have a tracking bot for ${trackingTarget.symbol}, are you going to delete the bot?`;
        bot.telegram.sendMessage(ctx.chat.id, guideMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "😢 Yes",
                            callback_data: "selectDeleteTrackingBot",
                        },
                    ],
                ],
            },
        });
    });

    bot.action("selectDeleteTrackingBot", async (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        await TrackToken.findOneAndDelete({ chatId }).exec();
        bot.telegram.sendMessage(
            chatId,
            "You bot had removed. You can setup by /setup command any time you want."
        );
    });

    bot.command("disablesell", async (ctx) => {
        const chatId: string = "" + ctx.chat.id;
        const trackingTarget = await TrackToken.findOne({
            chatId,
        }).exec();
        if (!trackingTarget) {
            bot.telegram.sendMessage(
                ctx.chat.id,
                "You don't have any active tracking bot!"
            );
            return;
        }
        const guideMessage = `You have a tracking bot for ${trackingTarget.symbol}, are you going to disable sell alert for the token?`;
        bot.telegram.sendMessage(ctx.chat.id, guideMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🚫 Disable it!",
                            callback_data: "selectDisableSell",
                        },
                        {
                            text: "🆗 Enable it!",
                            callback_data: "selectEnableSell",
                        },
                    ],
                ],
            },
        });
    });
    bot.command("enablesell", async (ctx) => {
        const chatId: string = "" + ctx.chat.id;
        const trackingTarget = await TrackToken.findOne({
            chatId,
        }).exec();
        if (!trackingTarget) {
            bot.telegram.sendMessage(
                ctx.chat.id,
                "You don't have any active tracking bot!"
            );
            return;
        }
        const guideMessage = `You have a tracking bot for ${trackingTarget.symbol}, are you going to enable sell alert for the token?`;
        bot.telegram.sendMessage(ctx.chat.id, guideMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🆗 Enable it!",
                            callback_data: "selectEnableSell",
                        },
                        {
                            text: "🚫 Disable it!",
                            callback_data: "selectDisableSell",
                        },
                    ],
                ],
            },
        });
    });

    bot.action("selectEnableSell", async (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        await TrackToken.findOneAndUpdate({ sellDisabled: false }).exec();
        bot.telegram.sendMessage(
            ctx.chat.id,
            "Selling alert was enabled in your bot tracking!"
        );
        fetchTrackingTargets();
    });
    bot.action("selectDisableSell", async (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        await TrackToken.findOneAndUpdate({ sellDisabled: true }).exec();
        bot.telegram.sendMessage(
            ctx.chat.id,
            "Selling alert was disabled in your bot tracking!"
        );
        fetchTrackingTargets();
    });

    bot.command("add", (ctx) => {
        const userId = ctx.from.id;
        if (userId != titanXOwl.userId) {
            return;
        }

        let guideMessage = `Great! You are going to start tracking activities of your own or favorite token!
    If you have token address, select 🎡 Address below.
    Want to search token by name or symbol select 🔎 Find option.
Hit /help to checkout details.`;

        bot.telegram.sendMessage(ctx.chat.id, guideMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🎡 Address",
                            callback_data: "selectTokenByAddress",
                        },
                        {
                            text: "🔎 Search",
                            callback_data: "selectSearchToken",
                        },
                    ],
                ],
            },
        });
    });

    bot.action("selectTokenByAddress", (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        setCustomerStatus(chatId, TYPING_ADDRESS);
        bot.telegram.sendMessage(ctx.chat.id, "Type your token Address!");
    });

    bot.action("selectSearchToken", (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;

        if (!customerStatus[chatId]) {
            customerStatus[chatId] = { status: NONE_ACTION };
        }
        customerStatus[chatId].status = SEARCHING_TOKEN;
        bot.telegram.sendMessage(
            ctx.chat.id,
            "Type your query to search token, I will show your search result!"
        );
    });

    bot.command("price", async (ctx) => {
        if (lastLog) {
            ctx.reply(
                `The latest ${titanXOwl.symbol} price is $${floatConverter(
                    lastLog.priceUSD
                )}.`
            );
            return;
        } else {
            const apiResponse = await fetchPriceFromApi(titanXOwl.id);
            ctx.reply(
                `The latest ${titanXOwl.symbol} price is $${floatConverter(
                    parseFloat(apiResponse.data.price)
                )}.`
            );
        }
    });

    bot.command("ranks", async (ctx) => {
        ctx.reply(OWL_RANKS);
    });
    bot.command("rank", async (ctx) => {
        const message = ctx.message.text.trim();
        const startId = message.indexOf("0x");
        if (startId === -1) {
            ctx.reply(
                "Invalid wallet address or usage! Ex: /rank 0x0173A37E2211096b5E75c2A3c9d8622304FD9373"
            );
            return;
        }
        let wallet = message.slice(startId, startId + 42);
        ctx.reply(`${wallet}`);
    });

    bot.on("text", async (ctx: any) => {
        const chatId: string = ctx.chat.id;
        const replyText: string = ctx.message.text.trim();

        if (chatId == titanXOwl.channelId.toString()) {
            console.log(ctx.chat, ctx.from);
            return;
        }
        if (getCustomerStatus(chatId) == TYPING_ADDRESS) {
            let checksumAddress: string = "";
            try {
                checksumAddress = web3.utils.toChecksumAddress(replyText);
                const [pairs, tokenInfo, existingBot] = await Promise.all([
                    searchPairsByTokenAddress(checksumAddress),
                    getTokenInformation(checksumAddress),
                    TrackToken.findOne({ id: checksumAddress }).exec(),
                ]);
                if (existingBot) {
                    bot.telegram.sendMessage(
                        chatId,
                        "This token is already being tacked by our TitanXOwl, try with another address"
                    );
                    return;
                }
                const parsedTokenInfo = extractTokenInfo(pairs[0], tokenInfo);
                customerStatus[chatId].tokenInfo = parsedTokenInfo;

                let guideMessage = `DingDong! We found token for this address ${checksumAddress}.\nToken symbol(name): ${parsedTokenInfo.symbol}(${parsedTokenInfo.name})\nDecimals: ${parsedTokenInfo.decimals}
            You can all token logo for ${parsedTokenInfo.symbol} or  start tracking just now!!!`;
                bot.telegram.sendMessage(chatId, guideMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "🎨 Add Logo",
                                    callback_data: "selectAddLogo",
                                },
                                {
                                    text: "💨 Yes, Start Tracking!",
                                    callback_data: "selectStartTracking",
                                },
                            ],
                        ],
                    },
                });
            } catch (error) {
                bot.telegram.sendMessage(chatId, "This address is invalid!");
                return;
            }
        }
        if (getCustomerStatus(chatId) == ADDING_LOGO) {
            if (replyText === "") {
                bot.telegram.sendMessage(chatId, "Invalid URL");
                return;
            }
            // @ts-ignore
            customerStatus[chatId].tokenInfo.logo = replyText;
            let guideMessage = `Hiya, we remember your logo!!!\nYou can start right now!!`;
            bot.telegram.sendMessage(chatId, guideMessage, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "💨 Yes, Start Tracking!",
                                callback_data: "selectStartTracking",
                            },
                        ],
                    ],
                },
            });
        }

        if (getCustomerStatus(chatId) == SEARCHING_TOKEN) {
            let queryResults = await queryTokens(replyText);
            // @ts-ignore
            let result: { [key: string]: any } = [];
            queryResults.forEach((pair: Pair) => {
                if (
                    pair.token0
                        .toLowerCase()
                        .includes(replyText.toLowerCase()) ||
                    pair.token0Name
                        .toLowerCase()
                        .includes(replyText.toLowerCase()) ||
                    pair.token0Symbol
                        .toLowerCase()
                        .includes(replyText.toLowerCase())
                )
                    result[pair.token0] = {
                        name: pair.token0Name,
                        symbol: pair.token0Symbol,
                    };
                if (
                    pair.token1
                        .toLowerCase()
                        .includes(replyText.toLowerCase()) ||
                    pair.token1Name
                        .toLowerCase()
                        .includes(replyText.toLowerCase()) ||
                    pair.token1Symbol
                        .toLowerCase()
                        .includes(replyText.toLowerCase())
                )
                    result[pair.token1] = {
                        name: pair.token1Name,
                        symbol: pair.token1Symbol,
                    };
            });
            let response = "";
            for (let tokenAddress in result) {
                let temp = `${response} ${result[tokenAddress].symbol}(${result[tokenAddress].name}) ${tokenAddress}`;
                if (temp.length > 4000) break;
                response = temp;
            }
            bot.telegram.sendMessage(
                chatId,
                response.length
                    ? response
                    : "No token found for this query, try again other query."
            );
        }
    });

    bot.action("selectAddLogo", (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        if (!customerStatus[chatId]) {
            return;
        }
        customerStatus[chatId].status = ADDING_LOGO;
        bot.telegram.sendMessage(
            ctx.chat.id,
            "Type the image url of token logo. We only accept png format images and idea size is 200px*200px."
        );
    });

    bot.action("selectStartTracking", async (ctx: any) => {
        const chatId: string = "" + ctx.chat.id;
        const updateDBItem = {
            ...customerStatus[chatId].tokenInfo,
            chatId,
        };
        await TrackToken.findOneAndUpdate({ chatId }, updateDBItem, {
            upsert: true,
        });
        customerStatus[chatId].status = ADDING_DONE;
        bot.telegram.sendMessage(
            chatId,
            "Yeap! We included your token into our targets."
        );
        fetchTrackingTargets();
    });

    bot.launch();

    const sendSwapMessageToChannel = async (
        log: any,
        cur_supply: number,
        pairInfo: any
    ) => {
        lastLog = log;
        const uploadImagePath = await drawer.manipulateImage(
            log,
            cur_supply,
            pairInfo
        );
        console.log("sending ", uploadImagePath);
        return;
        await bot.telegram.sendPhoto(
            CHANNEL_ID,
            { source: uploadImagePath },
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🧾 Transaction",
                                url: log.transactionHash,
                            },
                            {
                                text: "📊 Chart / Swap",
                                url: `https://titanx.org/dashboard/defi-exchange/${pairInfo.id}?chain=bsc`,
                            },
                        ],
                    ],
                },
            }
        );
        // bot.telegram.sendAnimation()
    };

    // Enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));

    let currentBlock = 0;
    const checkSwapLogs = async () => {
        try {
            const [lastBlock, coinPrice] = await Promise.all([
                web3.eth.getBlockNumber(),
                getLatestCoinPrice(),
            ]);
            console.log(currentBlock, lastBlock, "lastBlock", coinPrice);

            const pairContract = new web3.eth.Contract(
                ABI_UNISWAP_V2_PAIR,
                titanXOwl.pair
            );
            const tokenContract = new web3.eth.Contract(
                ABI_UNISWAP_V2_PAIR,
                titanXOwl.id
            );

            const [events, minted, dead_amount] = await Promise.all([
                pairContract.getPastEvents("Swap", {
                    fromBlock: currentBlock ? currentBlock : lastBlock - 5,
                    // fromBlock: currentBlock ? currentBlock : lastBlock - 98000,
                    // toBlock: currentBlock ? currentBlock : lastBlock - 93000,
                }),
                tokenContract.methods.totalSupply().call(),
                tokenContract.methods.balanceOf(DEAD_ADDRESS).call(),
            ]);
            const txs = await Promise.all(
                events.map((event: any) => {
                    return web3.eth.getTransaction(event.transactionHash);
                })
            );
            txs.forEach((tx, index) => {
                events[index].origin = tx.from;
            });

            const parsedTxLogs: any[] = parseTxSwapLog(
                events.reverse(),
                titanXOwl,
                coinPrice
            );
            parsedTxLogs
                .filter((log) => {
                    return (
                        log.totalUSD > 10 &&
                        (!titanXOwl.sellDisabled || log.side != "SELL")
                    );
                })
                .slice(0, 1)
                .forEach(async (log: any) => {
                    try {
                        log.buyerBalance =
                            (await tokenContract.methods
                                .balanceOf(log.buyer)
                                .call()) /
                            10 ** titanXOwl.decimals;
                        await sendSwapMessageToChannel(
                            log,
                            (minted - dead_amount) / 10 ** titanXOwl.decimals,
                            titanXOwl
                        );
                    } catch (error) {
                        console.error(error);
                    }
                });
            currentBlock = lastBlock + 1;
        } catch (error) {
            console.log(error);
        }
    };

    setInterval(() => {
        checkSwapLogs();
    }, 5000);
};

let trackingTargets: ITrackToken[];
const fetchTrackingTargets = async () => {
    trackingTargets = await TrackToken.find({}).exec();
    trackingTargets.forEach((item: ITrackToken) => launchTitanXOwl(item));
};
const startTitanXOwls = async () => {
    await connectDB();
    await Promise.all([fetchTrackingTargets(), drawer.getMetadata()]);
};
startTitanXOwls();
