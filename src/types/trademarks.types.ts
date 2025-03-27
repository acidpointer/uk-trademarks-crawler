export interface Trademark {
  id: string;
  status: string;
  markText: string;
  fileDate: string;
  classes: string;
}

export type TrademarksSearchType =
  | "SIMILAR"
  | "EXACT"
  | "CONTAINSSTRING"
  | "CONTAINSWORD"
  | "STARTSWITH";
export type TrademarksLegalStatus =
  | "ALLLEGALSTATUSES"
  | "LIVELEGALSTATUS"
  | "DEADLEGALSTATUS";

export type TrademarksWordSearchMatchType = "ALLWORDS" | "ANYWORDS";

export interface SearchOption {
  value: string;
  text: string;
  selected?: boolean;
}

export type TrademarkClassID = string;

export interface TrademarkClass {
  id: TrademarkClassID;
  name: string;
}