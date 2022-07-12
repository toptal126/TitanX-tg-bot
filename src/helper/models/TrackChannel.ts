import { Schema, model } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
export interface ITrackChannel {
    channelId: number; // Channel Id which bot will be included
    username: string; // register user name

    id: string;
    minted: number;
    burned: number;
    name: string;
    symbol: string;
    decimals: number;
    lastPrice: number;

    isToken1BNB: boolean;
    isToken1BUSD: boolean;
    isBUSDPaired: boolean;
    pairs: any[];
    logo?: string;
    sellDisabled: boolean;
}

// 2. Create a Schema corresponding to the document interface.
const TrackChannelSchema = new Schema<ITrackChannel>(
    {
        channelId: { type: Number, required: true, index: true }, // Channel Id which bot will be included
        username: { type: String, required: true },

        id: { type: String, index: true }, // token Address
        minted: { type: Number },
        burned: { type: Number },
        name: { type: String },
        symbol: { type: String },
        decimals: { type: Number },
        lastPrice: { type: Number, default: 0 },

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
        logo: { type: String },

        sellDisabled: { type: Boolean, default: false },
    },
    { collection: "track_channels", versionKey: false }
);

// 3. Create a Model.
export const TrackChannel = model<ITrackChannel>(
    "TrackChannel",
    TrackChannelSchema
);
