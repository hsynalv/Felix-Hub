/**
 * Chat configuration constants
 */

export const CHAT_HISTORY_RAW_LIMIT = parseInt(process.env.CHAT_HISTORY_RAW_LIMIT || "10", 10);
export const CHAT_COMPRESS_THRESHOLD = parseInt(process.env.CHAT_COMPRESS_THRESHOLD || "24", 10);
