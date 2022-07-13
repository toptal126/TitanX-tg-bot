import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
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
    DEAD_ADDRESS,
    HAWK_HELP,
    OWL_RANKS,
    PUBLIC_COMMANDS,
    ranksPercentage,
    RANKS_EMOTICONS,
    SWAP_TOPIC,
} from "./constants";

import {
    getMetadata,
    manipulateImage,
    unlinkImage,
    url2CacheImage,
} from "./helper/image-process";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";

const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed3.binance.org/");
const commandParts = require("telegraf-command-parts");

require("dotenv").config();

const token: string = process.env.MASTER_BOT_TOKEN as string;
const bot: Telegraf<Context<Update>> = new Telegraf(token);

const adminFilterMiddleWare = () => async (ctx: any, next: any) => {
    const message = ctx.update.message?.text;
    const chatId = ctx.chat.id;
    const userId = ctx.from ? ctx.from.id : chatId;

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
    if (ctx.chat.type === "channel") {
        try {
            const administrators = await bot.telegram.getChatAdministrators(
                chatId
            );

            // Ignore if the bot is not an administrator
            if (
                !administrators.find((item) => item.user.id === bot.botInfo?.id)
            )
                return;
            return next();
        } catch (error) {
            return;
        }
    }
    if (!message) return;

    const administrators = await bot.telegram.getChatAdministrators(chatId);

    // Ignore if the bot is not an administrator
    if (!administrators.find((item) => item.user.id === bot.botInfo?.id)) {
        console.log("I am not a admin");
        return;
    }

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

const delete_command = async (ctx: any, chatId: string) => {
    const trackingTarget = await TrackChannel.findOne({
        channelId: chatId,
    }).exec();
    if (!trackingTarget) {
        ctx.reply("You don't have any active tracking bot!");
        return;
    }

    await TrackChannel.findOneAndDelete({ channelId: chatId }).exec();
    await refetchTrackingTargets();
    ctx.reply(
        "😞 Oh no! Tracking has stopped; You can start tracking again with /set_token "
    );
};
bot.command("delete", async (ctx) => {
    const chatId: string = "" + ctx.chat.id;
    delete_command(ctx, chatId);
});

const count = async (ctx: any) => {
    const [count1, count2] = await Promise.all([
        TrackChannel.countDocuments(),
        TrackToken.countDocuments(),
    ]);
    ctx.reply(`There are ${count1 + count2} groups using TitanX OWL!`);
};
bot.command("count", count);

const price_command = async (ctx: any, chatId: string) => {
    const trackChannel = await TrackChannel.findOne({ channelId: chatId });
    if (trackChannel ? !!trackChannel.lastPrice : false)
        ctx.reply(
            `Current price is $${floatConverter(trackChannel?.lastPrice || 0)}!`
        );
};
bot.command("price", async (ctx: any) => {
    const chatId: string = "" + ctx.chat.id;
    price_command(ctx, chatId);
});

const ranks_command = async (ctx: any) => {
    ctx.reply(OWL_RANKS);
};

bot.command("ranks", ranks_command);

const rank_command = async (ctx: any, chatId: string, message: string) => {
    try {
        const trackingTarget = await TrackChannel.findOne({
            channelId: chatId,
        }).exec();

        if (!trackingTarget) {
            ctx.reply("You don't have any active tracking bot!");
            return;
        }

        const startId = message.indexOf("0x");
        let wallet = message.slice(startId, startId + 42);
        wallet = web3.utils.toChecksumAddress(wallet);
        const tokenContract = new web3.eth.Contract(
            ABI_UNISWAP_V2_PAIR,
            trackingTarget.id
        );
        const [minted, balance] = await Promise.all([
            tokenContract.methods.totalSupply().call(),
            tokenContract.methods.balanceOf(wallet).call(),
        ]);
        console.log(trackingTarget.id, balance, minted);

        let rank: any = 0;
        ranksPercentage.forEach((percentage, index) => {
            if ((balance / minted) * 100 > percentage) {
                rank = index;
            }
        });
        ctx.reply(RANKS_EMOTICONS.at(rank));
    } catch (error) {
        ctx.reply(
            `Invalid wallet address or usage!
Example: /rank 0x0173A37E2211096b5E75c2A3c9d8622304FD9373`
        );
        console.error(error);
        return;
    }
};

bot.command("rank", async (ctx: any) => {
    const chatId: string = "" + ctx.chat.id;
    const message = ctx.message.text.trim();
    rank_command(ctx, chatId, message);
});

const set_token = async (ctx: any, message: string, channelId: number) => {
    let checksumAddress: string = "";
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

            setTimeout(() => {
                unlinkImage(existingBot.logo || "");
            }, 10000);
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
        console.log("customerTrackChannel", customerTrackChannel);

        await TrackChannel.findOneAndUpdate(
            {
                channelId,
            },
            customerTrackChannel,
            {
                upsert: true,
            }
        );

        await refetchTrackingTargets();
        ctx.reply(
            `✨ I've found ${customerTrackChannel.symbol}. If that's right, click next if not, try again.

🔥 Awesome, Now let's set a logo.

Type /set_logo followed by IMAGE_URL.

We recommend 200x200 in .png format.`
        );
    } catch (error) {
        ctx.reply("This address is invalid!");
        console.log(error);
        return;
    }
};
bot.command("set_token", async (ctx) => {
    const message: string = ctx.message.text.trim();
    const channelId: number = ctx.chat.id;
    set_token(ctx, message, channelId);
});

const set_logo = async (ctx: any, message: string, channelId: number) => {
    try {
        const parsedUrl: string = message.split(" ").at(-1) || "";

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
        if (trackChannelObj.logo) {
            const oldPath = trackChannelObj.logo;
            setTimeout(() => {
                unlinkImage(oldPath || "");
            }, 10000);
        }
        trackChannelObj.logo = cachedLogoPath;
        await trackChannelObj.save();
        await refetchTrackingTargets();
        ctx.reply(`Great, that worked; you're all set.
🙏 Help me grow by recommended me to friends.`);
    } catch (error) {
        ctx.reply("Invalid image path or image format!");
        console.log(error);
    }
};
bot.command("set_logo", async (ctx) => {
    const message: string = ctx.message.text.trim();
    const channelId: number = ctx.chat.id;
    set_logo(ctx, message, channelId);
});

const disablesell = async (ctx: any) => {
    try {
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
        trackChannelObj.sellDisabled = true;
        await trackChannelObj.save();
        await refetchTrackingTargets();

        ctx.reply("Alert for token sale is disabled!");
    } catch (error) {}
};
bot.command("disablesell", disablesell);

const enablesell = async (ctx: any) => {
    try {
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
        trackChannelObj.sellDisabled = false;
        await trackChannelObj.save();
        await refetchTrackingTargets();

        ctx.reply("Alert for token sale is enabled!");
    } catch (error) {}
};
bot.command("enablesell", enablesell);

const deletelast = async (ctx: any) => {
    try {
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
        trackChannelObj.deleteLastPost = true;
        await trackChannelObj.save();
        await refetchTrackingTargets();

        ctx.reply("Last post for token sale will be deleted once get updated!");
    } catch (error) {}
};
bot.command("deletelast", deletelast);

const enablelast = async (ctx: any) => {
    try {
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
        trackChannelObj.deleteLastPost = false;
        await trackChannelObj.save();
        await refetchTrackingTargets();

        ctx.reply("Last post for token sale will be deleted once get updated!");
    } catch (error) {}
};
bot.command("enablelast", enablelast);

bot.on("channel_post", (ctx, next) => {
    const postObj: any = ctx.update.channel_post;
    if (postObj ? postObj.entities : false) {
        const command = postObj.text.slice(
            postObj.entities[0].offset + 1,
            postObj.entities[0].length
        );
        console.log(command);
    }
    return next();
});
bot.launch();

const sendSwapMessageToChannel = async (
    log: any,
    cur_supply: number,
    trackChannel: any
) => {
    try {
        // lastLog = log;
        const uploadImagePath = await manipulateImage(
            log,
            cur_supply,
            trackChannel
        );

        // return;
        const result = await bot.telegram.sendPhoto(
            trackChannel.channelId,
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
                                url: `https://titanx.org/dashboard/defi-exchange/${trackChannel.id}?chain=bsc`,
                            },
                        ],
                    ],
                },
            }
        );

        if (trackChannel.lastPost && trackChannel.deleteLastPost) {
            try {
                await bot.telegram.deleteMessage(
                    trackChannel.lastPost.chatId,
                    trackChannel.lastPost.messageId
                );
            } catch (error) {
                console.error(error);
            }
        }
        trackChannel.lastPost = {
            chatId: result.chat.id,
            messageId: result.message_id,
        };
    } catch (error) {
        console.error("Telegram Error", error);
    }
    // bot.telegram.sendAnimation()
};

let trackingTargets: any[];
let checkintIntervalId: any;
const fetchTrackingTargets = async () => {
    trackingTargets = await TrackChannel.find({}).exec();
};
const refetchTrackingTargets = async () => {
    clearInterval(checkintIntervalId);
    trackingTargets = await TrackChannel.find({}).exec();
    checkintIntervalId = setInterval(() => {
        checkSwapLogs();
    }, 5000);
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

        const [minteds, dead_amounts] = await Promise.all([
            Promise.all(
                tokenContracts.map((tokenContract) =>
                    tokenContract.methods.totalSupply().call()
                )
            ),
            Promise.all(
                tokenContracts.map((tokenContract) =>
                    tokenContract.methods.balanceOf(DEAD_ADDRESS).call()
                )
            ),
        ]);

        const allPairs: any[] = [].concat.apply(
            [],
            //@ts-ignore
            trackingTargets.map((item) => item.pairs)
        );

        if (!allPairs.length) return;
        const events = await web3.eth.getPastLogs({
            fromBlock: currentBlock ? currentBlock : lastBlock - 5,
            address: allPairs.map((item) => item.address),
            topics: [SWAP_TOPIC],
        });
        // console.log("allPairs", allPairs.length);
        // console.log("events", events.length);
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
        ).filter((log) => (log.totalUSD || 0) > 10);

        // console.log("parsedTxLogs", parsedTxLogs);

        trackingTargets.forEach(async (trackChannel, index) => {
            trackChannel.save();
            const requiredEvents = parsedTxLogs.filter(
                (log) => log.token === trackChannel.id
            );
            requiredEvents.forEach(async (log) => {
                if (trackChannel.sellDisabled && log.side === "SELL") return;
                log.buyerBalance =
                    (await tokenContracts[index].methods
                        .balanceOf(log.buyer)
                        .call()) /
                    10 ** trackChannel.decimals;
                await sendSwapMessageToChannel(
                    log,
                    (minteds[index] - dead_amounts[index]) /
                        10 ** trackChannel.decimals,
                    trackChannel
                );
            });
        });

        // parsedTxLogs
        //     .filter((log) => {
        //         const tokenInfo = trackingTargets.find((item) => {
        //             return !!item.pairs.find(
        //                 (pair: any) => pair.address === log.dexPair
        //             );
        //         });
        //         return (
        //             log.totalUSD > 10 &&
        //             (!tokenInfo.sellDisabled || log.side != "SELL")
        //         );
        //     })
        //     .slice(0, 1)
        //     .forEach(async (log: any) => {
        //         try {
        //             log.buyerBalance =
        //                 (await tokenContracts.find().methods
        //                     .balanceOf(log.buyer)
        //                     .call()) /
        //                 10 ** titanXOwl.decimals;
        //             await sendSwapMessageToChannel(
        //                 log,
        //                 (minted - dead_amount) / 10 ** titanXOwl.decimals,
        //                 titanXOwl
        //             );
        //         } catch (error) {
        //             console.error(error);
        //         }
        //     });

        currentBlock = lastBlock + 1;
    } catch (error) {
        console.log(error);
    }
};

const startTitanXHawk = async () => {
    await connectDB();
    await Promise.all([fetchTrackingTargets(), getMetadata()]);
    startSwapInterval();
};
const startSwapInterval = () => {
    if (checkintIntervalId) clearInterval(checkintIntervalId);
    checkintIntervalId = setInterval(() => {
        checkSwapLogs();
    }, 5000);
};
startTitanXHawk();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
