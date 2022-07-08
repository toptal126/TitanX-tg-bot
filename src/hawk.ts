import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
import { DEAD_ADDRESS } from "./constants";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";
import {
    extractTokenInfo,
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

const token: string = process.env.MASTER_BOT_TOKEN as string;
const telegram: Telegram = new Telegram(token);
const bot: Telegraf<Context<Update>> = new Telegraf(token);

// const chatId: string = process.env.CHAT_ID as string;
const CHANNEL_ID = -1001462234815;

// @ts-ignore
const customerStatus: { [key: string]: CUSTOMER_DATA } = [];
let trackingTargets: ITrackToken[];

bot.start((ctx) => {
    ctx.reply("Hello!!! " + ctx.from.first_name + "!");
});

bot.help((ctx) => {
    ctx.reply(`/start - Provides a greeting message and instructions for the next steps
/setup - Will Will lead you to setup new TitanXOWL integrated in your channel.
/count - Will return how many groups are using OWL.`);
});

bot.command("quit", (ctx) => {
    ctx.telegram.leaveChat(ctx.message.chat.id);
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

bot.on("text", async (ctx: any) => {
    const dmId: string = ctx.chat.id;
    const replyText: string = ctx.message.text.trim();
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
        if (replyText === "") {
            bot.telegram.sendMessage(dmId, "Invalid URL");
            return;
        }
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
            if (
                pair.token0.toLowerCase().includes(replyText.toLowerCase()) ||
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
                pair.token1.toLowerCase().includes(replyText.toLowerCase()) ||
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
        bot.telegram.sendMessage(dmId, response);
    }
});

bot.launch();

const startTitanXWatch = async () => {};
connectDB();
startTitanXWatch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
