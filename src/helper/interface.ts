export const NONE_ACTION = "NONE_ACTION";
export const TYPING_ADDRESS = "TYPING_ADDRESS";
export const ADDING_LOGO = "ADDING_LOGO";
export const SEARCHING_TOKEN = "SEARCHING_TOKEN";
export const WAITING_CONFIRM = "WAITING_CONFIRM";
export const ADDING_DONE = "ADDING_DONE";

export type CUSTOMERSTATUS =
    | "NONE_ACTION"
    | "TYPING_ADDRESS"
    | "ADDING_LOGO"
    | "SEARCHING_TOKEN"
    | "WAITING_CONFIRM"
    | "ADDING_DONE";

export interface CUSTOMER_DATA {
    status: CUSTOMERSTATUS;
    tokenInfo?: ParsedTokenFromPair;
}

export interface Pair {
    createdAt: Date;
    pairIndex: number;
    pairAddress: string;
    reserve0: number;
    reserve1: number;
    reserve_usd: number;
    token0: string;
    token0Decimals: number;
    token0Name: string;
    token0Price: number;
    token0Symbol: string;
    token1: string;
    token1Decimals: number;
    token1Name: string;
    token1Price: number;
    token1Symbol: string;
    dexId: number;
}
export interface TokenInfo {
    id: string;
    minted: number;
    burned: number;
    decimals: number;
    pair: string;
    isToken1BNB: boolean;
    isToken1BUSD: boolean;
    isBUSDPaired: boolean;
}
export interface ParsedTokenFromPair {
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
}
