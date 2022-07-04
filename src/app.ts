import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
import { DEAD_ADDRESS, WATCHING_PAIRS } from "./constants";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";
import {
    getLatestCoinPrice,
    parseSwapLog,
    parseTxSwapLog,
} from "./helper/helpers";
import { connectDB } from "./helper/database-actions";
import { TrackToken } from "./helper/models/TrackToken";

const Web3 = require("web3");
require("dotenv").config();

const token: string = process.env.BOT_TOKEN as string;
const telegram: Telegram = new Telegram(token);
const bot: Telegraf<Context<Update>> = new Telegraf(token);

// const chatId: string = process.env.CHAT_ID as string;
const CHANNEL_ID = -1001462234815;
const BANNER_IMAGE =
    "https://lh6.googleusercontent.com/L3ehxK1oHfdi85FJ_uVDUcFN5ag0fe3IvqgqqybX8cbsZUC2aBj3u33y-pcO0wUzd1tn98YMubdNEjuf3n2M";

bot.start((ctx) => {
    ctx.reply("Hello!!! " + ctx.from.first_name + "!");
});

bot.help((ctx) => {
    ctx.reply("Send /start to receive a greeting");
    ctx.reply(
        "Send /add to start tracking your own token price at realtime, 😎!"
    );
    ctx.reply("Send /quit to stop the bot");
});

bot.command("quit", (ctx) => {
    // Explicit usage
    ctx.telegram.leaveChat(ctx.message.chat.id);

    // Context shortcut
    ctx.leaveChat();
});

bot.command("add", (ctx) => {
    console.log(ctx.from);
    let guideMessage = `Great!, You are going to start tracking activities of your own or favorite token!
    If you have token address, select 🎡 Address below.
    Want to search token by name or symbol select 🔎 Find option.`;
    ctx.deleteMessage();
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
    bot.telegram.sendMessage(ctx.chat.id, "Type your token Address!");
});
bot.action("selectSearchToken", (ctx: any) => {
    bot.telegram.sendMessage(
        ctx.chat.id,
        "Type your token name or symbol, I will show your search result!"
    );
});

// https://t.me/TitanXTestingBot -1001462234815
// https://t.me/TitanXProject -1001517511060
telegram.getChat("@TitanXProject").then((chat) => {
    // 'chat' is a Chat object
    // console.log(chat.id);
});

bot.on("text", (ctx) => {});

bot.launch();

let i: number = 0;
const sendSwapMessageToChannel = async (
    log: any,
    cur_supply: number,
    pairInfo: any
) => {
    // bot.telegram.sendVideoNote()

    const text = `<a href="https://titanx.org"><b>TitanX ${log.side}!  ${
        log.side == "SELL" ? " 💸" : " 💰"
    }</b></a>
    <b>${log.side == "SELL" ? "🔴🔴🔴" : "🟢🟢🟢"}</b>
    <b>Spent</b>: $${log.totalUSD.toFixed(3)}
    <b>Got</b>: ${log.quoteAmount} TITAN
    <a href="https://bscscan.com/address/${
        log.buyer
    }">Buyer: 🎁 ${log.buyer.slice(0, 4)}..${log.buyer.slice(-3)}</a>
    <b>Price</b>: $${log.priceUSD.toFixed(8)}
    <b>MarketCap</b>: $${(cur_supply * log.priceUSD * 2).toFixed(3)}
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
const checkSwapLogs = async () => {
    try {
        const web3 = new Web3("https://bsc-dataseed3.binance.org/");
        const [lastBlock, coinPrice] = await Promise.all([
            web3.eth.getBlockNumber(),
            getLatestCoinPrice(),
        ]);
        console.log(currentBlock, lastBlock, "lastBlock", coinPrice);

        const pairContract = new web3.eth.Contract(
            ABI_UNISWAP_V2_PAIR,
            WATCHING_PAIRS[0].pair
        );
        const tokenContract = new web3.eth.Contract(
            ABI_UNISWAP_V2_PAIR,
            WATCHING_PAIRS[0].address
        );

        const [events, minted, dead_amount] = await Promise.all([
            pairContract.getPastEvents("Swap", {
                // fromBlock: currentBlock ? currentBlock : lastBlock - 4000,
                fromBlock: currentBlock ? currentBlock : lastBlock - 78000,
                toBlock: currentBlock ? currentBlock : lastBlock - 73000,
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
            WATCHING_PAIRS[0],
            coinPrice
        );

        parsedTxLogs.slice(0, 1).forEach((log: any) => {
            sendSwapMessageToChannel(
                log,
                (minted - dead_amount) / 10 ** WATCHING_PAIRS[0].decimals,
                WATCHING_PAIRS[0]
            );
        });
        currentBlock = lastBlock;
    } catch (error) {
        console.log(error);
    }
};

const startTitanXWatch = async () => {
    const obj = new TrackToken({
        chatId: 123,
        tokenAddress: "0x321321",
    });
    // obj.save();

    setInterval(() => {
        // checkSwapLogs();
    }, 5000);
};
connectDB();
startTitanXWatch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
