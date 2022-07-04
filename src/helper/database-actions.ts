require("dotenv").config();
import { connect } from "mongoose";

const url = process.env.DB_URI;

export const connectDB = async () => {
    await connect(`${url}`);
    // await digitalconnect(`${url}/${dbName}`);
    console.log("Connected MongoDB successfully!");
};
