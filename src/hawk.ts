import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
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
    CUSTOMERSTATUS,
    CUSTOMER_DATA,
    HAWK_SETUP,
    NONE_ACTION,
    Pair,
    SEARCHING_TOKEN,
    TYPING_ADDRESS,
} from "./helper/interface";
import { getMeBot } from "./helper/tg-api";

const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed3.binance.org/");

require("dotenv").config();

const token: string = process.env.MASTER_BOT_TOKEN as string;
const bot: Telegraf<Context<Update>> = new Telegraf(token);

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

bot.start((ctx) => {
    ctx.reply(`Hello!!!  ${ctx.from.first_name}
/start - Provides a greeting message and instructions for the next steps
/setup - Will Will lead you to setup new TitanXOWL integrated in your channel.
/count - Will return how many groups are using OWL.`);
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
bot.command("setup", async (ctx) => {
    const chatId: string = "" + ctx.chat.id;
    setCustomerStatus(chatId, HAWK_SETUP);
    let guideMessage;
    const trackingTarget = await TrackToken.findOne({ chatId }).exec();
    if (trackingTarget)
        guideMessage = `⚠ You have a tracking bot for ${
            trackingTarget.symbol
        }(${trackingTarget.id.slice(0, 6)}...${trackingTarget.id.slice(-4)}).
Are you going to reinstall the bot? Then input bot token, and channel id as following format.
Example: 5531234567:AAEoabcd1234xprHNyPXYZAB5arqUFqwera
1519908574`;
    else
        guideMessage = `👋 Are you going to setup new bot? Then input bot token, and channel id as following format.
Example: 5531234567:AAEoabcd1234xprHNyPXYZAB5arqUFqwera
1519908574`;
    bot.telegram.sendMessage(chatId, guideMessage);
});

bot.command("delete", async (ctx) => {
    const chatId: string = "" + ctx.chat.id;
    const trackingTarget = await TrackToken.findOne({ chatId }).exec();
    if (!trackingTarget) {
        bot.telegram.sendMessage(
            chatId,
            "You don't have any active tracking bot!"
        );
        return;
    }
    const guideMessage = `You have a tracking bot for ${trackingTarget.symbol}, are you going to delete the bot?`;
    bot.telegram.sendMessage(chatId, guideMessage, {
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

bot.on("text", async (ctx: any) => {
    const chatId: string = ctx.chat.id;
    const replyText: string = ctx.message.text.trim();

    if (getCustomerStatus(chatId) == HAWK_SETUP) {
        ctx.deleteMessage();
        const dataArr = replyText.split("\n").map((item) => item.trim());
        if (
            replyText === "" ||
            dataArr.length !== 2 ||
            dataArr.find((item) => item == "")
        ) {
            bot.telegram.sendMessage(chatId, "Invalid Information, try again!");
            return;
        }
        const getMe = await getMeBot(dataArr[0]);
        if (!getMe?.ok) {
            bot.telegram.sendMessage(chatId, "Invalid bot token, try again!");
            return;
        }
        let guideMessage = `Hiya, we remember your inforamtion!!!\nYou can start right now!!`;
        const customerTrackToken = new TrackToken({
            botToken: dataArr[0],
            channelId: `-100${dataArr[1]}`,
            chatId,
            userId: ctx.from.id,
            username: ctx.from.username,
            bot_name: getMe.result.first_name,
            bot_username: getMe.result.username,
        });
        TrackToken.findOneAndUpdate(
            {
                chatId,
            },
            customerTrackToken,
            {
                upsert: true,
            }
        );
        bot.telegram.sendMessage(chatId, guideMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `💨 Yes, Start Using ${getMe.result.first_name}!`,
                            url: `https://t.me/${getMe.result.username}`,
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
        bot.telegram.sendMessage(chatId, response);
    }
});

bot.launch();

const startTitanXHawk = async () => {};
connectDB();
startTitanXHawk();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
