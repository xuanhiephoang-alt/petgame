import { EMPTY_WORLD_HOLD_MS, MAX_PLAYERS } from "@petgame/shared";
import type { JoinFailure } from "../net/connection.ts";

/** Lobby hint when the page was opened again at the world the player was in (same tab). */
export const RETURN_HINT = "Quay lại thế giới bạn đang chơi cùng bạn bè";
/** Lobby hint when the page was opened from an invite link. */
export const INVITE_HINT = "Bạn được mời vào thế giới của bạn bè";

/** How the lobby was opened: fresh, from an invite link, or coming back to the world this tab was in (with or without friends). */
export type Arrival = "new" | "invited" | "back" | "backAlone";

/**
 * Sorts how the page was opened. `invited` is `?room=` from the address; `lastRoom` and `lastFriends` are what this
 * tab remembered (`petgame:room`, `petgame:friends`). A tab from before T49 has no `lastFriends`: it only wrote
 * `room` when friends were there, so that counts as friends.
 */
export function arrival(invited: string | null, lastRoom: string | null | undefined, lastFriends: string | null | undefined): Arrival {
  if (!invited) return "new";
  if (lastRoom !== invited) return "invited";
  return lastFriends === "0" ? "backAlone" : "back";
}

/** The lobby's hint line for an arrival; coming back alone needs none. */
export function arrivalHint(a: Arrival): string {
  return a === "back" ? RETURN_HINT : a === "invited" ? INVITE_HINT : "";
}

/** What the lobby's join card says and offers. `primary` gets the focus and comes first. */
export interface JoinCard {
  title: string;
  detail: string;
  retry: boolean;
  newWorld: boolean;
  /** Reload the page (the game could not open: only a reload helps). */
  reload: boolean;
  primary: "retry" | "newWorld" | "reload";
}

/** The card shown when joining failed; `returning` is whether the player came back to a world they were playing in. */
export function joinCard(failure: JoinFailure, returning: boolean): JoinCard {
  switch (failure) {
    case "closed":
      return {
        title: "Thế giới này đã đóng",
        detail: returning
          ? "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn."
          : "Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới.",
        retry: false,
        newWorld: true,
        reload: false,
        primary: "newWorld",
      };
    case "full":
      return {
        title: `Thế giới đã đủ ${MAX_PLAYERS} người`,
        detail: "Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới.",
        retry: true,
        newWorld: true,
        reload: false,
        primary: "retry",
      };
    case "unreachable":
      return { title: "Không kết nối được server", detail: "Kiểm tra mạng rồi bấm Thử lại.", retry: true, newWorld: false, reload: false, primary: "retry" };
    case "busy":
      return {
        title: "Server đang có quá nhiều thế giới",
        detail: "Chưa tạo thêm được thế giới mới. Chờ một lát rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời.",
        retry: true,
        newWorld: false,
        reload: false,
        primary: "retry",
      };
    case "tooMany":
      return {
        title: "Đã mở nhiều thế giới quá",
        detail: `Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau ${EMPTY_WORLD_HOLD_MS / 60_000} phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời.`,
        retry: true,
        newWorld: false,
        reload: false,
        primary: "retry",
      };
    case "failed":
      return { title: "Không vào được thế giới", detail: "Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại.", retry: true, newWorld: false, reload: false, primary: "retry" };
  }
}

/** Why the game could not open after the room was joined: a part of the game did not download, or the browser failed to run it. */
export type StartFailure = "download" | "broken";

/**
 * Errors of a part of the game that could not be fetched (lost network, or an old tab whose hashed files are gone after a deploy).
 * Chrome: "Failed to fetch dynamically imported module: ..."; Firefox: "error loading dynamically imported module: ...";
 * Safari: "Importing a module script failed." or "Load failed".
 */
const DOWNLOAD_ERROR = /dynamically imported module|module script failed|Failed to fetch|NetworkError|Load failed/i;

/** Sorts an error thrown while opening the game by its shape (not `instanceof`: it may come from another realm). */
export function startFailure(err: unknown): StartFailure {
  const message = typeof err === "object" && err !== null ? (err as { message?: unknown }).message : undefined;
  return typeof message === "string" && DOWNLOAD_ERROR.test(message) ? "download" : "broken";
}

/** The card shown when the room was joined but the game could not open: one button, Tải lại. */
export function startCard(failure: StartFailure): JoinCard {
  const card = { retry: false, newWorld: false, reload: true, primary: "reload" } as const;
  return failure === "download"
    ? { ...card, title: "Không tải được game", detail: "Kiểm tra mạng rồi bấm Tải lại." }
    : { ...card, title: "Không mở được game", detail: "Trình duyệt gặp lỗi khi mở thế giới. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt." };
}
