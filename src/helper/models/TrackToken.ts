import { Schema, model, connect } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
interface ITrackToken {
    chatId: number;
    tokenAddress: string;
    avatar?: string;
    description?: string;
}

// 2. Create a Schema corresponding to the document interface.
const trackTokenSchema = new Schema<ITrackToken>(
    {
        chatId: { type: Number, required: true, index: true },
        tokenAddress: { type: String, required: true },
        avatar: String,
        description: String,
    },
    { collection: "bsc" }
);

// 3. Create a Model.
export const TrackToken = model<ITrackToken>("TrackToken", trackTokenSchema);
