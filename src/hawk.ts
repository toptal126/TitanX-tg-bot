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
import { ITrackChannel, TrackChannel } from "./helper/models/TrackChannel";
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
import {
    ADMIN_COMMANDS,
    HAWK_HELP,
    PUBLIC_COMMANDS,
    SWAP_TOPIC,
} from "./constants";
import { unlinkImage, url2CacheImage } from "./helper/image-process";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";

const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed3.binance.org/");
const commandParts = require("telegraf-command-parts");

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

const adminFilterMiddleWare = () => async (ctx: any, next: any) => {
    const message = ctx.update.message?.text;
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    if (!message) return;
    // Continue if the chat is Private
    if (ctx.chat.type === "private") {
        // Ignore if they wrote admin commands
        let isAdminCommand = false;
        ADMIN_COMMANDS.forEach((command) => {
            if (message.includes(`/${command}`)) isAdminCommand = true;
        });
        if (isAdminCommand) {
            ctx.reply("You can't command bot via DM.");
            return;
        }

        return next();
    }

    const administrators = await bot.telegram.getChatAdministrators(chatId);

    // Ignore if the bot is not an administrator
    if (!administrators.find((item) => item.user.id === bot.botInfo?.id))
        return;

    let isPublicCommand = false;
    PUBLIC_COMMANDS.forEach((command) => {
        if (message.includes(`/${command}`)) isPublicCommand = true;
    });
    // Ignore if the message sender is not an administrator
    if (
        !isPublicCommand &&
        !administrators.find((item) => item.user.id === userId)
    )
        return;
    return next();
};
bot.use(adminFilterMiddleWare());

bot.start((ctx) => {
    ctx.reply(`Hello!!!  ${ctx.from.first_name}
${HAWK_HELP}`);
});

bot.help((ctx) => {
    ctx.reply(HAWK_HELP);
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

bot.command("count", async (ctx) => {
    const [count1, count2] = await Promise.all([
        TrackChannel.countDocuments(),
        TrackToken.countDocuments(),
    ]);
    ctx.reply(`There are ${count1 + count2} groups using TitanX Hawk!`);
});
bot.command("set_token", async (ctx) => {
    let checksumAddress: string = "";
    const channelId: number = ctx.chat.id;
    const message: string = ctx.message.text.trim();
    const startId = message.indexOf("0x");
    const token_address = message.slice(startId, startId + 42);
    try {
        checksumAddress = web3.utils.toChecksumAddress(token_address);
        ctx.reply("⌛ Loading token information...");
        const [pairs, tokenInfo, existingBot] = await Promise.all([
            searchPairsByTokenAddress(checksumAddress),
            getTokenInformation(checksumAddress),
            TrackChannel.findOne({ channelId }).exec(),
        ]);
        delete tokenInfo.pair;
        if (existingBot) {
            if (existingBot.id === checksumAddress) {
                ctx.reply(
                    "This token is already being tracked by you, try with another address"
                );
                return;
            }
            unlinkImage(existingBot.logo || "");
        }

        const customerTrackChannel = {
            channelId,
            username: ctx.from.username,
            name:
                pairs[0].token0 === checksumAddress
                    ? pairs[0].token0Name
                    : pairs[0].token1Name,
            symbol:
                pairs[0].token0 === checksumAddress
                    ? pairs[0].token0Symbol
                    : pairs[0].token1Symbol,
            ...tokenInfo,
            pairs: pairs.map((item: any) => {
                return {
                    address: item.pairAddress,
                    token0: item.token0,
                    token1: item.token1,
                };
            }),
            logo: "",
        };

        await TrackChannel.findOneAndUpdate(
            {
                channelId,
            },
            customerTrackChannel,
            {
                upsert: true,
            }
        );

        ctx.reply(
            `Started tracking ${customerTrackChannel.name}(${customerTrackChannel.symbol})
Address: ${checksumAddress}.
You can command /set_logo [IMAGE_URL] to show custom logo for each posting.`
        );
        fetchTrackingTargets();
    } catch (error) {
        ctx.reply("This address is invalid!");
        console.log(error);
        return;
    }
});

bot.command("set_logo", async (ctx) => {
    try {
        const message: string = ctx.message.text.trim();
        const parsedUrl: string = message.split(" ").at(-1) || "";
        const channelId: number = ctx.chat.id;

        const trackChannelObj = await TrackChannel.findOne({
            channelId,
        }).exec();

        if (!trackChannelObj) {
            ctx.reply(
                "You don't have active tracking token, need to set token address via /set_token command first."
            );
            return;
        }

        const cachedLogoPath = await url2CacheImage(
            parsedUrl,
            trackChannelObj?.id
        );
        if (trackChannelObj.logo) unlinkImage(trackChannelObj.logo);
        trackChannelObj.logo = cachedLogoPath;
        await trackChannelObj.save();
        ctx.reply(cachedLogoPath);
    } catch (error) {
        ctx.reply("Invalid image path or image format!");
        console.log(error);
    }
});

bot.launch();

let trackingTargets: ITrackChannel[];
const fetchTrackingTargets = async () => {
    trackingTargets = await TrackChannel.find({}).exec();
};

let currentBlock = 0;
const checkSwapLogs = async () => {
    try {
        const [lastBlock, coinPrice] = await Promise.all([
            web3.eth.getBlockNumber(),
            getLatestCoinPrice(),
        ]);
        console.log(currentBlock, lastBlock, "lastBlock", coinPrice);

        const tokenContracts = trackingTargets.map((item) => {
            return new web3.eth.Contract(ABI_UNISWAP_V2_PAIR, item.id);
        });

        const allPairs: any[] = [].concat.apply(
            [],
            //@ts-ignore
            trackingTargets.map((item) => item.pairs)
        );

        const events = await web3.eth.getPastLogs({
            fromBlock: currentBlock ? currentBlock : lastBlock - 5,
            address: allPairs.map((item) => item.address),
            topics: [SWAP_TOPIC],
        });
        console.log("allPairs", allPairs.length);
        console.log("events", events.length);
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
            trackingTargets,
            coinPrice
        );
        console.log("parsedTxLogs", parsedTxLogs);
        /*
        parsedTxLogs
            .filter((log) => {
                return (
                    log.totalUSD > 10 &&
                    (!titanXOwl.sellDisabled || log.side != "SELL")
                );
            })
            // .slice(0, 1)
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
            */
        currentBlock = lastBlock + 1;
    } catch (error) {
        console.log(error);
    }
};

const startTitanXHawk = async () => {
    await fetchTrackingTargets();

    setInterval(() => {
        checkSwapLogs();
    }, 5000);
};
connectDB();
startTitanXHawk();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
