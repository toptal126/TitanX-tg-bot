import { Schema, model, connect } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
export interface ITrackToken {
    chatId: number;
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
}

// 2. Create a Schema corresponding to the document interface.
const trackTokenSchema = new Schema<ITrackToken>(
    {
        chatId: { type: Number, required: true, index: true },
        id: { type: String, required: true, index: true },
        minted: { type: Number, required: true },
        burned: { type: Number, required: true },
        name: { type: String, required: true },
        symbol: { type: String, required: true },
        decimals: { type: Number, required: true },
        pair: { type: String, required: true },
        isToken1BNB: { type: Boolean, required: true },
        isToken1BUSD: { type: Boolean, required: true },
        isBUSDPaired: { type: Boolean, required: true },
        logo: { type: String },
        description: { type: String },
        sellDisabled: { type: Boolean, required: true, default: false },
    },
    { collection: "bsc", versionKey: false }
);

// 3. Create a Model.
export const TrackToken = model<ITrackToken>("TrackToken", trackTokenSchema);
