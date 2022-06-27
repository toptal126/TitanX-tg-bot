import { Context, Markup, Telegraf, Telegram } from "telegraf";
import { Update } from "typegram";
import { DEAD_ADDRESS, WATCHING_PAIRS } from "./constants";
import ABI_UNISWAP_V2_PAIR from "./abis/ABI_UNISWAP_V2_PAIR.json";
import { getLatestCoinPrice, parseSwapLog, parseTxSwapLog } from "./helpers";

const Web3 = require("web3");
require("dotenv").config();

const token: string = process.env.BOT_TOKEN as string;
const telegram: Telegram = new Telegram(token);
const bot: Telegraf<Context<Update>> = new Telegraf(token);

// const chatId: string = process.env.CHAT_ID as string;
const CHANNEL_ID = -1001462234815;

bot.start((ctx) => {
    ctx.reply("Hello!!! " + ctx.from.first_name + "!");
});

bot.help((ctx) => {
    ctx.reply("Send /start to receive a greeting");
    ctx.reply("Send /keyboard to receive a message with a keyboard");
    ctx.reply("Send /quit to stop the bot");
});

bot.command("quit", (ctx) => {
    // Explicit usage
    ctx.telegram.leaveChat(ctx.message.chat.id);

    // Context shortcut
    ctx.leaveChat();
});

bot.command("keyboard", (ctx) => {
    ctx.reply(
        "Keyboard",
        Markup.inlineKeyboard([
            Markup.button.callback("First option", "first"),
            Markup.button.callback("Second option", "second"),
        ])
    );
});

// https://t.me/TitanXTestingBot -1001462234815
// https://t.me/TitanXProject -1001517511060
telegram.getChat("@TitanXProject").then((chat) => {
    // 'chat' is a Chat object
    // console.log(chat.id);
});

bot.on("text", (ctx) => {
    // console.log("ctx.message.chat.id", ctx.message.chat.id);
    ctx.reply(
        "You choose the " +
            (ctx.message.text === "first" ? "First" : "Second") +
            " Option!"
    );

    // if (chatId) {
    //     telegram.sendMessage(
    //         chatId,
    //         "This message was sent without your interaction!"
    //     );
    // }
});

bot.launch();

let i: number = 0;
const sendSwapMessageToChannel = (
    log: any,
    cur_supply: number,
    pairInfo: any
) => {
    const text = `<a href="https://titanx.org"><b>TitanX ${log.side}!  ${
        log.side == "SELL" ? " 💸" : " 💰"
    }</b></a>
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
    bot.telegram.sendMessage(CHANNEL_ID, text, { parse_mode: "HTML" });
};

let currentBlock = 0;
const checkSwapLogs = async () => {
    const web3 = new Web3("https://bsc-dataseed3.binance.org/");
    const [lastBlock, coinPrice] = await Promise.all([
        web3.eth.getBlockNumber(),
        getLatestCoinPrice(),
    ]);
    // console.log(currentBlock, lastBlock, "lastBlock", coinPrice);

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
            fromBlock: currentBlock ? currentBlock : lastBlock - 4000,
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
};

const startTitanXWatch = async () => {
    setInterval(() => {
        try {
            checkSwapLogs();
        } catch (error) {
            console.log(error);
        }
    }, 5000);
};

startTitanXWatch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
