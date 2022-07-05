import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
import { DEAD_ADDRESS } from "./constants";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";
import {
    extractTokenInfo,
    getLatestCoinPrice,
    getTokenInformation,
    parseSwapLog,
    parseTxSwapLog,
    queryTokens,
    searchPairsByTokenAddress,
} from "./helper/helpers";
import { connectDB } from "./helper/database-actions";
import { ITrackToken, TrackToken } from "./helper/models/TrackToken";
import {
    ADDING_DONE,
    ADDING_LOGO,
    CUSTOMER_DATA,
    NONE_ACTION,
    Pair,
    SEARCHING_TOKEN,
    TYPING_ADDRESS,
} from "./helper/interface";
import * as drawer from "./helper/image-process";

const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed3.binance.org/");

require("dotenv").config();

const token: string = process.env.BOT_TOKEN as string;
const telegram: Telegram = new Telegram(token);
const bot: Telegraf<Context<Update>> = new Telegraf(token);

// const chatId: string = process.env.CHAT_ID as string;
const CHANNEL_ID = -1001462234815;
const BANNER_IMAGE = "./image/banner.jpg";

// @ts-ignore
const customerStatus: { [key: string]: CUSTOMER_DATA } = [];
let trackingTargets: ITrackToken[];

bot.start((ctx) => {
    ctx.reply("Hello!!! " + ctx.from.first_name + "!");
});

bot.help((ctx) => {
    ctx.reply("Send /start to receive a greeting");
    ctx.reply(
        "Send /add to start tracking your own token price at realtime, 😎!"
    );
    ctx.reply("Send /manage to configure your current tracking token!");
    ctx.reply("Send /quit to stop the bot");
});

bot.command("quit", (ctx) => {
    // Explicit usage
    ctx.telegram.leaveChat(ctx.message.chat.id);

    // Context shortcut
    ctx.leaveChat();
});

bot.command("delete", async (ctx) => {
    const dmId: string = "" + ctx.chat.id;
    const trackingTarget = await TrackToken.findOne({ chatId: dmId }).exec();
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
    const dmId: string = "" + ctx.chat.id;
    await TrackToken.findOneAndDelete({ chatId: dmId }).exec();
    bot.telegram.sendMessage(
        ctx.chat.id,
        "You bot had removed. You can add by /add command any time you want."
    );
    fetchTrackingTargets();
});

bot.command("add", (ctx) => {
    let guideMessage = `Great! You are going to start tracking activities of your own or favorite token!
    If you have token address, select 🎡 Address below.
    Want to search token by name or symbol select 🔎 Find option.`;

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
    const dmId: string = "" + ctx.chat.id;
    if (!customerStatus[dmId]) {
        customerStatus[dmId] = { status: NONE_ACTION };
    }
    customerStatus[dmId] = { status: TYPING_ADDRESS };

    bot.telegram.sendMessage(ctx.chat.id, "Type your token Address!");
});
bot.action("selectSearchToken", (ctx: any) => {
    const dmId: string = "" + ctx.chat.id;

    if (!customerStatus[dmId]) {
        customerStatus[dmId] = { status: NONE_ACTION };
    }
    customerStatus[dmId].status = SEARCHING_TOKEN;
    bot.telegram.sendMessage(
        ctx.chat.id,
        "Type your query to search token, I will show your search result!"
    );
});
// https://t.me/TitanXTestingBot -1001462234815
// https://t.me/TitanXProject -1001517511060
telegram.getChat("@TitanXProject").then((chat) => {
    // 'chat' is a Chat object
    // console.log(chat.id);
});

bot.on("text", async (ctx: any) => {
    const dmId: string = ctx.chat.id;
    const replyText: string = ctx.message.text;
    if (!customerStatus[dmId]) {
        customerStatus[dmId] = { status: NONE_ACTION };
    }
    console.log(dmId, customerStatus[dmId].status);
    if (customerStatus[dmId].status == TYPING_ADDRESS) {
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
                    dmId,
                    "This token is already being tacked by our TitanXOwl, try with another address"
                );
                return;
            }
            const parsedTokenInfo = extractTokenInfo(pairs[0], tokenInfo);
            customerStatus[dmId].tokenInfo = parsedTokenInfo;

            let guideMessage = `DingDong! We found token for this address ${checksumAddress}.\nToken symbol(name): ${parsedTokenInfo.symbol}(${parsedTokenInfo.name})\nDecimals: ${parsedTokenInfo.decimals}
            You can all token logo for ${parsedTokenInfo.symbol} or  start tracking just now!!!`;
            bot.telegram.sendMessage(dmId, guideMessage, {
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
            bot.telegram.sendMessage(dmId, "This address is invalid!");
            return;
        }
    }
    if (customerStatus[dmId].status == ADDING_LOGO) {
        // @ts-ignore
        customerStatus[dmId].tokenInfo.logo = replyText;
        let guideMessage = `Hiya, we remember your logo!!!\nYou can start right now!!`;
        bot.telegram.sendMessage(dmId, guideMessage, {
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

    if (customerStatus[dmId].status == SEARCHING_TOKEN) {
        let queryResults = await queryTokens(replyText);
        // @ts-ignore
        let result: { [key: string]: any } = [];
        queryResults.forEach((pair: Pair) => {
            result[pair.token0] = {
                name: pair.token0Name,
                symbol: pair.token0Symbol,
            };
            result[pair.token0] = {
                name: pair.token0Name,
                symbol: pair.token0Symbol,
            };
        });
        let response = "";
        for (let tokenAddress in result) {
            response = `${response} ${result[tokenAddress].symbol}(${result[tokenAddress].name}) ${tokenAddress}`;
        }
        bot.telegram.sendMessage(dmId, response);
    }
});

bot.action("selectAddLogo", (ctx: any) => {
    const dmId: string = "" + ctx.chat.id;
    customerStatus[dmId].status = ADDING_LOGO;
    bot.telegram.sendMessage(ctx.chat.id, "Type the image url of token logo.");
});

bot.action("selectStartTracking", async (ctx: any) => {
    const dmId: string = "" + ctx.chat.id;
    const updateDBItem = {
        ...customerStatus[dmId].tokenInfo,
        chatId: dmId,
    };
    await TrackToken.findOneAndUpdate({ chatId: dmId }, updateDBItem, {
        upsert: true,
    });
    customerStatus[dmId].status = ADDING_DONE;
    bot.telegram.sendMessage(
        dmId,
        "Yeap! We included your token into our targets."
    );
    fetchTrackingTargets();
});

bot.launch();

let i: number = 0;
const sendSwapMessageToChannel = async (
    log: any,
    cur_supply: number,
    pairInfo: any
) => {
    // bot.telegram.sendVideoNote()

    const text = `<a href="https://titanx.org"><b>${pairInfo.name} ${
        log.side
    }!  ${log.side == "SELL" ? " 💸" : " 💰"}</b></a>
    <b>${log.side == "SELL" ? "🔴🔴🔴" : "🟢🟢🟢"}</b>
    <b>Spent</b>: $${log.totalUSD.toFixed(3)}
    <b>Got</b>: ${log.quoteAmount} ${pairInfo.symbol}
    <a href="https://bscscan.com/address/${
        log.buyer
    }">Buyer: 🎁 ${log.buyer.slice(0, 6)}..${log.buyer.slice(-3)}</a>
    <b>Price</b>: $${log.priceUSD.toFixed(8)}
    <b>MarketCap</b>: $${(cur_supply * log.priceUSD * 2).toFixed(3)}
    <a href="https://bscscan.com/address/${
        pairInfo.id
    }">Address: © ${pairInfo.id.slice(0, 6)}..${pairInfo.id.slice(-3)}</a>
    <a href="https://titanx.org">Visit TitanX | </a><a href="${
        log.transactionHash
    }">TX | </a><a href="https://titanx.org/dashboard/defi-exchange/${
        pairInfo.address
    }?chain=bsc">Buy | </a><a href="https://titanx.org/dashboard/defi-exchange/${
        pairInfo.address
    }?chain=bsc">Chart | </a><a href="https://twitter.com/TitanX_Project">Follow US</a>`;
    // console.log(text);
    // bot.telegram.sendMessage(CHANNEL_ID, text, { parse_mode: "HTML" });
    await bot.telegram.sendPhoto(CHANNEL_ID, BANNER_IMAGE, {
        caption: text,
        parse_mode: "HTML",
    });
    // bot.telegram.sendAnimation()
};

let currentBlock = 0;
const checkSwapLogs = async (index: number) => {
    try {
        const [lastBlock, coinPrice] = await Promise.all([
            web3.eth.getBlockNumber(),
            getLatestCoinPrice(),
        ]);
        console.log(currentBlock, lastBlock, "lastBlock", coinPrice);

        const pairContract = new web3.eth.Contract(
            ABI_UNISWAP_V2_PAIR,
            trackingTargets[index].pair
        );
        const tokenContract = new web3.eth.Contract(
            ABI_UNISWAP_V2_PAIR,
            trackingTargets[index].id
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
            trackingTargets[index],
            coinPrice
        );
        parsedTxLogs
            .filter((log) => log.totalUSD > 10)
            // .slice(0, 1)
            .forEach((log: any) => {
                sendSwapMessageToChannel(
                    log,
                    (minted - dead_amount) /
                        10 ** trackingTargets[index].decimals,
                    trackingTargets[index]
                );
            });
        currentBlock = lastBlock;
    } catch (error) {
        console.log(error);
    }
};
const fetchTrackingTargets = async () => {
    trackingTargets = await TrackToken.find({}).exec();
};
const startTitanXWatch = async () => {
    await fetchTrackingTargets();
    setInterval(() => {
        trackingTargets.forEach((item, index) => checkSwapLogs(index));
    }, 5000);
};
connectDB();
startTitanXWatch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
