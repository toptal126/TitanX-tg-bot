import { floatConverter } from "./helpers";
import { BufferStatus } from "./interface";
const fetch = require("node-fetch");

const fs = require("fs");
const fsExtra = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

let bannerSharp: any;
let greenLightsSharp: any;
let redLightsSharp: any;
let moneyBagSharp: any;
let moneyWingSharp: any;
// let giftSharp: any;
// @ts-ignore
let bufferArray: { [key: string]: BufferStatus } = [];
const getMetadata = async () => {
    fsExtra.emptyDirSync(`${process.cwd()}/dist/img-output`);
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
    log: any,
    cur_supply: number = 68954654,
    pairInfo: any
) => {
    const st = new Date().getTime();
    const width = 1000;
    const height = 1000;
    console.log(
        `${path.join(__dirname, "/fonts/SignikaNegative-Regular.ttf")}`
    );
    const svgImage = `
    <svg width="${width}" height="${height}">
      <defs>
        <style type="text/css">
        
            @font-face {
            font-family: SignikaNegative;
            src: url('${path.join(
                __dirname,
                "/fonts/SignikaNegative-Semibold.ttf"
            )}');
            }
        
        </style>
      </defs>
      <style>
      * {
        font-family: SignikaNegative;
      }
      .header { fill: #2dceaa; font-size: 56px; font-weight: bold;}
      .symbol { fill: #2dceaa; font-size: 64px; font-weight: semibold;}
      .price { fill: #2dceaa; font-size: 120px; font-weight: semibold;}
      .buyer { fill: #e4a814; font-size: 48px; font-weight: semibold;}
      .info { fill: #fff; font-size: 40px; font-weight: semibold;}
      .address { fill: #fff; font-size: 32px; font-weight: semibold;}
      </style>
      <text y="150px" x="100px" text-anchor="left" class="header">${log.side}
      </text>
      <text y="280px" x="170px" text-anchor="left" class="symbol">${
          pairInfo.name
      }
      </text>
      <text y="450px" x="100px" text-anchor="left" font-family="SignikaNegative" class="price">${floatConverter(
          parseFloat(log.quoteAmount)
      )} ${pairInfo.symbol}</text>
      
      <text y="530px" x="150px" text-anchor="left" class="buyer">${
          log.side == "SELL" ? "Seller: " : "Buyer: "
      }  ${log.buyer.slice(0, 6)}..${log.buyer.slice(-3)}</text>


      <text y="700px" x="100px" text-anchor="left" class="info">Price: $${floatConverter(
          log.priceUSD
      )}</text>
      <text y="750px" x="100px" text-anchor="left" class="info">Spent: $${floatConverter(
          log.totalUSD
      )}</text>
      <text y="800px" x="100px" text-anchor="left" class="info">MarketCap: $${(
          cur_supply * log.priceUSD
      ).toFixed(0)}</text>
      <text y="850px" x="100px" text-anchor="left" class="address">Address:</text>
      <text y="850px" x="230px" text-anchor="left" class="address">${
          pairInfo.id
      }</text>
    </svg>
    `;

    const svgBuffer = Buffer.from(svgImage);
    const outputPath = `${process.cwd()}/dist/img-output/${
        pairInfo.id
    }-${new Date().getTime()}.png`;
    if (!!pairInfo.logo) {
        if (!bufferArray[pairInfo.id]) {
            bufferArray[pairInfo.id] = { status: false, buffer: null };
        }
        if (bufferArray[pairInfo.id].status !== true) {
            try {
                const fimg = await fetch(pairInfo.logo);
                const logoBuffer = await fimg.buffer();
                bufferArray[pairInfo.id].status = true;
                bufferArray[pairInfo.id].buffer = await sharp(logoBuffer)
                    .resize({ width: 200 })
                    .toBuffer();
            } catch (error) {
                console.error(error);
            }
        }
    }
    if (bufferArray[pairInfo.id].status == true) {
        await bannerSharp
            .composite([
                {
                    input: svgBuffer,
                    top: 0,
                    left: 0,
                },
                {
                    input:
                        log.side === "SELL" ? redLightsSharp : greenLightsSharp,
                    top: 80,
                    left: 270,
                },
                {
                    input: log.side === "SELL" ? moneyWingSharp : moneyBagSharp,
                    top: 200,
                    left: 70,
                },
                {
                    input: bufferArray[pairInfo.id].buffer,
                    top: 550,
                    left: 650,
                },
            ])
            .toFile(outputPath);
    } else
        await bannerSharp
            .composite([
                {
                    input: svgBuffer,
                    top: 0,
                    left: 0,
                },
                {
                    input:
                        log.side === "SELL" ? redLightsSharp : greenLightsSharp,
                    top: 80,
                    left: 270,
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
