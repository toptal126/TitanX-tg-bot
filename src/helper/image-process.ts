import { floatConverter } from "./helpers";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

let bannerSharp: any;
let greenLightsSharp: any;
let redLightsSharp: any;
let moneyBagSharp: any;
let moneyWingSharp: any;
// let giftSharp: any;
const getMetadata = async () => {
    [
        bannerSharp,
        greenLightsSharp,
        redLightsSharp,
        moneyBagSharp,
        moneyWingSharp,
        // giftSharp,
    ] = await Promise.all([
        sharp(path.join(__dirname, "/image/banner.jpg")),
        fs.readFileSync(path.join(__dirname, "/image/green-lights.png")),
        fs.readFileSync(path.join(__dirname, "/image/red-lights.png")),
        fs.readFileSync(path.join(__dirname, "/image/money-bag.png")),
        fs.readFileSync(path.join(__dirname, "/image/money-wing.png")),
        // fs.readFileSync(path.join(__dirname, "/image/gift.png")),
    ]);
    return await bannerSharp.metadata();
};

const manipulateImage = async (
    log: any = {
        coinPrice: "227.575",
        side: "SELL",
        buyer: "0x286Eb173406da4f0785a8562cca78a6eCE7334D9",
        totalUSD: 34.136228551117384,
        priceUSD: 3.109641429482453,
        quoteAmount: "10.978",
        transactionHash:
            "https://bscscan.com/tx/0x9124497e39a9d74f783199fc4b2351572c6a760304d20b3fb587355fd6403594",
    },
    cur_supply: number = 68954654,
    pairInfo: any = {
        _id: "62c3604d619abb9497a27cbb",
        chatId: 2128662478,
        burned: 508267478.7211187,
        decimals: 18,
        id: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
        isBUSDPaired: false,
        isToken1BNB: true,
        isToken1BUSD: false,
        minted: 816477139.7510512,
        name: "PancakeSwap Token",
        pair: "0x0eD7e52944161450477ee417DE9Cd3a859b14fD0",
        symbol: "Cake",
    }
) => {
    const st = new Date().getTime();
    const width = 1000;
    const height = 1000;

    const svgImage = `
    <svg width="${width}" height="${height}">
      <style>
      .emoji {
        font-family: "Noto Mono";
      }
      .header { fill: #2dceaa; font-size: 70px; font-weight: normal;}
      .symbol { fill: #2dceaa; font-size: 84px; font-weight: normal;}
      .price { fill: #2dceaa; font-size: 150px; font-weight: bold;}
      .buyer { fill: #e4a814; font-size: 60px; font-weight: normal;}
      .info { fill: #fff; font-size: 40px; font-weight: normal;}
      .address { fill: #fff; font-size: 28px; font-weight: normal;}
      </style>
      <text y="150px" x="100px" text-anchor="left" class="header">${log.side}
      </text>
      <text y="280px" x="170px" text-anchor="left" class="symbol">${
          pairInfo.name
      }
      </text>
      <text y="450px" x="100px" text-anchor="left" class="price">$${floatConverter(
          log.priceUSD
      )}</text>
      
      <text y="530px" x="150px" text-anchor="left" class="buyer">${
          log.side == "SELL" ? "Seller: " : "Buyer: "
      }  ${log.buyer.slice(0, 6)}..${log.buyer.slice(-3)}</text>

      <text y="650px" x="100px" text-anchor="left" class="info">Spent: $${floatConverter(
          log.totalUSD
      )}</text>
      <text y="700px" x="100px" text-anchor="left" class="info">Got: ${floatConverter(
          parseFloat(log.quoteAmount)
      )} ${pairInfo.symbol}</text>
      <text y="750px" x="100px" text-anchor="left" class="info">Spent: $${floatConverter(
          log.totalUSD
      )}</text>
      <text y="800px" x="100px" text-anchor="left" class="info">MarketCap: $${(
          cur_supply * log.priceUSD
      ).toFixed(0)}</text>
      <text y="850px" x="100px" text-anchor="left" class="info">Address:</text>
      <text y="850px" x="260px" text-anchor="left" class="address">${
          pairInfo.id
      }</text>
    </svg>
    `;

    const svgBuffer = Buffer.from(svgImage);
    const outputPath = `${process.cwd()}/dist/img-output/${
        pairInfo.id
    }-${new Date().getTime()}.png`;
    await bannerSharp
        .composite([
            {
                input: svgBuffer,
                top: 0,
                left: 0,
            },
            {
                input: log.side === "SELL" ? redLightsSharp : greenLightsSharp,
                top: 80,
                left: log.side === "SELL" ? 300 : 270,
            },
            {
                input: log.side === "SELL" ? moneyWingSharp : moneyBagSharp,
                top: 200,
                left: 70,
            },
        ])
        .toFile(outputPath);
    setTimeout(() => {
        fs.unlink(outputPath, (error: any) => {
            if (error) console.log(error);
        });
        // console.log(`deleting ${outputPath}`);
    }, 10 * 60 * 1000);
    console.log(
        `Took ${new Date().getTime() - st}ms to generate ${outputPath}`
    );
    return outputPath;
};

export { getMetadata, manipulateImage };
