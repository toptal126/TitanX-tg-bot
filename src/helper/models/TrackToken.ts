import { Schema, model } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
export interface ITrackToken {
    botToken: string; // Bot Token
    channelId: number; // Channel Id which bot will be included
    username: string; // register user Id

    id: string;
    minted: number;
    burned: number;
    name: string;
    symbol: string;
    decimals: number;
    lastPrice: number;

    logo?: string;

    isToken1BNB: { type: Boolean };
    isToken1BUSD: { type: Boolean };
    isBUSDPaired: { type: Boolean };

    pairs: any[];
}

// 2. Create a Schema corresponding to the document interface.
const trackTokenSchema = new Schema<ITrackToken>(
    {
        botToken: { type: String, required: true, index: true }, // Bot Token
        channelId: { type: Number, required: true, index: true }, // Channel Id which bot will be included
        username: { type: String, required: true },

        id: { type: String, index: true }, // token Address
        minted: { type: Number },
        burned: { type: Number },
        name: { type: String },
        symbol: { type: String },
        decimals: { type: Number },
        lastPrice: { type: Number, default: -1 },

        logo: { type: String },

        isToken1BNB: { type: Boolean },
        isToken1BUSD: { type: Boolean },
        isBUSDPaired: { type: Boolean },

        pairs: [
            {
                address: { type: String },
                token0: { type: String },
                token1: { type: String },
            },
        ],
    },
    { collection: "track_tokens", versionKey: false }
);

// 3. Create a Model.
export const TrackToken = model<ITrackToken>("TrackToken", trackTokenSchema);
