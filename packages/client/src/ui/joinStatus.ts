import { MAX_PLAYERS } from "@petgame/shared";
import type { JoinFailure } from "../net/connection.ts";

/** Lobby hint when the page was opened again at the world the player was in (same tab). */
export const RETURN_HINT = "Quay lại thế giới bạn đang chơi cùng bạn bè";
/** Lobby hint when the page was opened from an invite link. */
export const INVITE_HINT = "Bạn được mời vào thế giới của bạn bè";

/** What the lobby's join card says and offers. `primary` gets the focus and comes first. */
export interface JoinCard {
  title: string;
  detail: string;
  retry: boolean;
  newWorld: boolean;
  primary: "retry" | "newWorld";
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
        primary: "newWorld",
      };
    case "full":
      return {
        title: `Thế giới đã đủ ${MAX_PLAYERS} người`,
        detail: "Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới.",
        retry: true,
        newWorld: true,
        primary: "retry",
      };
    case "unreachable":
      return { title: "Không kết nối được server", detail: "Kiểm tra mạng rồi bấm Thử lại.", retry: true, newWorld: false, primary: "retry" };
    case "failed":
      return { title: "Không vào được thế giới", detail: "Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại.", retry: true, newWorld: false, primary: "retry" };
  }
}
