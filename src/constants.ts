export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export const HAWK_HELP = `😊 Great, you found me; now, let's pair me with your token address.

Type /set_token followed by your token address.

For example, /set_token 0x000000`;

export const OWL_HELP = `/start - Provides a greeting message and instructions for the next steps
/set_token [token contract address] - Enter the token address you want Owl to provide updates for.
/set_logo [IMAGE URL] - Enter the image url you want to add to your postings.
/delete - Will delete all tracking activity ever provided.
/deletelast - Will delete the last update provided to not clog up your group's media storage.
/enablelast - Will no longer delete the previous update.
/disablesell - Will stop providing sell updates to the group.
/enablesell - The bot will start tracking sell updates.
/price - Will return the Current price, Market cap & Link to view the chart.
/rank - Will return the number of tokens and wallet rank of the address.
/ranks - Will return the ranking order.
/count - Will return how many groups are using OWL.`;

export const ranksPercentage = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 2];

export const OWL_RANKS = `Rank Inforamtion
<0.00001% > 0.049% (Tortoise) 🐢
0.05% > 0.2499% (Frog) 🐸
<0.25% > 0.499% (Fish) 🐟
0.5% > 0.7499% (Dolphin) 🐬
0.75% > 0.999% (Shark) 🦈
1% > 1.999% (Whale) 🐋
2% > (T-REX) 🦖`;

export const RANKS_EMOTICONS = ["🐢", "🐸", "🐟", "🐬", "🦈", "🐋", "🦖"];

export const PUBLIC_COMMANDS = ["rank", "ranks", "price", "count"];
export const ADMIN_COMMANDS = ["set_token", "set_logo"];

export const SWAP_TOPIC =
    "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
