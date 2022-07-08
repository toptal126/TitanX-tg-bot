import { Schema, model, connect } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
export interface ITrackToken {
    botToken: string; // Bot Token
    channelId: number; // Channel Id which bot will be included
    chatId: number; // DM Id with admin
    userId: number; // register user Id
    username: string; // register user Id
    bot_name: string; // register user Id
    bot_username: string; // register user Id

    id: string;
    minted: number;
    burned: number;
    name: string;
    symbol: string;
    decimals: number;
    pair: string;
    isToken1BNB: boolean;
    isToken1BUSD: boolean;
    isBUSDPaired: boolean;
    logo?: string;
    description?: string;
    sellDisabled: boolean;
    setupCompleted: boolean;
    isActive: boolean;
}

// 2. Create a Schema corresponding to the document interface.
const trackTokenSchema = new Schema<ITrackToken>(
    {
        botToken: { type: String, required: true, index: true }, // Bot Token
        channelId: { type: Number, required: true, index: true }, // Channel Id which bot will be included
        chatId: { type: Number, required: true, index: true },
        userId: { type: Number, required: true },
        username: { type: String, required: true },
        bot_name: { type: String, required: true },
        bot_username: { type: String, required: true },

        id: { type: String, index: true }, // token Address
        minted: { type: Number },
        burned: { type: Number },
        name: { type: String },
        symbol: { type: String },
        decimals: { type: Number },
        pair: { type: String },
        isToken1BNB: { type: Boolean },
        isToken1BUSD: { type: Boolean },
        isBUSDPaired: { type: Boolean },
        logo: { type: String },
        description: { type: String },
        sellDisabled: { type: Boolean, default: false },

        setupCompleted: { type: Boolean, default: false },
        isActive: { type: Boolean, default: false },
    },
    { collection: "bsc", versionKey: false }
);

// 3. Create a Model.
export const TrackToken = model<ITrackToken>("TrackToken", trackTokenSchema);
