"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const token = process.env.BOT_TOKEN;
const telegram = new telegraf_1.Telegram(token);
const bot = new telegraf_1.Telegraf(token);
const chatId = process.env.CHAT_ID;
bot.start((ctx) => {
    ctx.reply("Hello " + ctx.from.first_name + "!");
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
    ctx.reply("Keyboard", telegraf_1.Markup.inlineKeyboard([
        telegraf_1.Markup.button.callback("First option", "first"),
        telegraf_1.Markup.button.callback("Second option", "second"),
    ]));
});
bot.on("text", (ctx) => {
    ctx.reply("You choose the " +
        (ctx.message.text === "first" ? "First" : "Second") +
        " Option!");
    if (chatId) {
        telegram.sendMessage(chatId, "This message was sent without your interaction!");
    }
});
bot.launch();
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
//# sourceMappingURL=app.js.map