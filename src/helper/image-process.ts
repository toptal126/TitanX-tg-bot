import { floatConverter } from "./helpers";
import { BufferStatus } from "./interface";
const fetch = require("node-fetch");

const fs = require("fs");
const fsExtra = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

let bannerSharp: any;
let buyStickerBuffer: any;
let sellStickerBuffer: any;

let ranksBuffer: any[] = Array(7);
let ranksPercentage = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 2];
// @ts-ignore
let bufferArray: { [key: string]: BufferStatus } = [];
const getMetadata = async () => {
    fsExtra.emptyDirSync(`${process.cwd()}/dist/img-output`);
    [
        bannerSharp,
        buyStickerBuffer,
        sellStickerBuffer,
        ranksBuffer[0],
        ranksBuffer[1],
        ranksBuffer[2],
        ranksBuffer[3],
        ranksBuffer[4],
        ranksBuffer[5],
        ranksBuffer[6],
        // giftSharp,
    ] = await Promise.all([
        sharp(path.join(__dirname, "/image/banner.jpg")),
        fs.readFileSync(path.join(__dirname, "/image/buy-sticker.png")),
        fs.readFileSync(path.join(__dirname, "/image/sell-sticker.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-1.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-2.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-3.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-4.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-5.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-6.png")),
        fs.readFileSync(path.join(__dirname, "/image/rank-7.png")),
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
    const height = 620;
    const svgImage = `
    <svg width="${width}" height="${height}">
      <defs>
        <style type="text/css">
        
        
            @font-face {
                font-family: khand;
                src: url('${path.join(
                    __dirname,
                    "/fonts/khand-semibold.ttf"
                )}');
            }

            @font-face {
                font-family: Roboto;
                src: url('${path.join(__dirname, "/fonts/roboto.bold.ttf")}');
            }
        </style>
      </defs>
      <style>
      * {
        font-family: Roboto;
      }
      .price { fill: #2dceaa; font-size: 120px; font-weight: bold;}
      .symbol { fill: white; font-size: 56px; font-weight: bold;}
      .side {
        font-family: khand;
        font-size: 120px;
        font-weight: semibold;
      }
      .quote-amount {
        font-family: khand;
        font-size: 60px;
        font-weight: semibold;
      }
      .buyer { fill: #e4a814; font-size: 48px; font-weight: semibold;}
      .tag { fill: #fff; font-size: 32px; font-weight: semibold;}
      .value { font-size: 40px; font-weight: semibold;}
      </style>
      <text y="120px" x="200px" text-anchor="left" class="symbol">${
          pairInfo.name
      }
      </text>
      <text y="320px" x="100px" fill="${
          log.side == "SELL" ? "red" : "#48B66D"
      }" text-anchor="left" class="side">
        ${log.side}
      </text>
      <text y="320px" x="${
          log.side == "SELL" ? "330px" : "300px"
      }" fill="white" text-anchor="left" class="side">
        $${parseInt(log.totalUSD)}
      </text>

      <text y="400px" x="100px" text-anchor="left" fill="white" class="quote-amount">
      ${log.side == "SELL" ? "Sold" : "Bought"}
      ${floatConverter(parseFloat(log.quoteAmount))} ${pairInfo.symbol}</text>
      
      <text y="480px" x="100px" fill="white" text-anchor="middle" class="tag">
        Price
      </text>
      <text fill="${
          log.side == "SELL" ? "red" : "#48B66D"
      }" y="530px" x="100px" text-anchor="middle" class="value">
        $${floatConverter(log.priceUSD)}
      </text>
      
      <text y="480px" x="340px" fill="white" text-anchor="middle" class="tag">
        Market Cap
      </text>
      <text fill="${
          log.side == "SELL" ? "red" : "#48B66D"
      }" y="530px" x="340px" text-anchor="middle" class="value">
        ${floatConverter(cur_supply * log.priceUSD)}
      </text>
        
      <text y="480px" x="608px" fill="white" text-anchor="middle" class="tag">
        Buyer Holds
      </text>
      <text fill="${
          log.side == "SELL" ? "red" : "#48B66D"
      }" y="530px" x="608px" text-anchor="middle" class="value">
        ${floatConverter(
            Math.max(log.buyerBalance, parseFloat(log.quoteAmount))
        )}
        
      </text>

      <text y="450px" x="865px" fill="white" text-anchor="middle" class="tag">
        Wallet Rank
      </text>
    </svg>
    `;

    const svgBuffer = Buffer.from(svgImage);
    const outputPath = `${process.cwd()}/dist/img-output/${
        pairInfo.id
    }-${new Date().getTime()}.png`;

    let rank: any = 0;
    ranksPercentage.forEach((percentage, index) => {
        if ((log.buyerBalance / cur_supply) * 100 > percentage) {
            console.log(
                (log.buyerBalance / cur_supply) * 100 > percentage,
                log.buyerBalance,
                cur_supply
            );
            rank = index;
        }
    });
    console.log(rank, "rank1");
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
                    .resize({ width: 152 })
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
                        log.side === "SELL"
                            ? sellStickerBuffer
                            : buyStickerBuffer,
                    top: 80,
                    left: 700,
                },
                {
                    input: bufferArray[pairInfo.id].buffer,
                    top: 20,
                    left: 20,
                },
                {
                    input: ranksBuffer[rank],
                    left: 815,
                    top: 450,
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
                        log.side === "SELL"
                            ? sellStickerBuffer
                            : buyStickerBuffer,
                    top: 80,
                    left: 270,
                },
                {
                    input: ranksBuffer[rank],
                    left: 815,
                    top: 490,
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
