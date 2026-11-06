import type { ChainId, ChainParser } from "./types";
import { continente } from "./parse-continente";
import { auchan } from "./parse-auchan";
import { pingodoce } from "./parse-pingodoce";

export const PARSERS: Record<ChainId, ChainParser> = { continente, auchan, pingodoce };
