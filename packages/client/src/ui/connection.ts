import type { NetStatus } from "../net/reconnect.ts";
import { CONNECTION_TEXT } from "./strings.ts";

/**
 * The screen over the whole game while the connection is down: a dimmed layer that takes every touch (the joystick and
 * buttons under it cannot be reached), with what is happening and a "Về sảnh" button. While the game is trying to
 * reconnect (or take the lost place back, T24) the button is grey and keeps out of the way; once the world is lost it is
 * the main action and has the focus.
 */
export class ConnectionOverlay {
  private root: HTMLDivElement;
  private title: HTMLElement;
  private detail: HTMLParagraphElement;
  private lobby: HTMLButtonElement;

  constructor(parent: HTMLElement, goToLobby: () => void) {
    this.root = document.createElement("div");
    this.root.className = "net-overlay";
    this.root.hidden = true;
    this.root.setAttribute("role", "alertdialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "net-title");
    this.root.setAttribute("aria-describedby", "net-detail");
    const box = document.createElement("div");
    box.className = "net-box";
    const spinner = document.createElement("div");
    spinner.className = "net-spinner";
    spinner.setAttribute("aria-hidden", "true");
    this.title = document.createElement("strong");
    this.title.className = "net-title";
    this.title.id = "net-title";
    this.detail = document.createElement("p");
    this.detail.className = "net-detail";
    this.detail.id = "net-detail";
    this.lobby = document.createElement("button");
    this.lobby.type = "button";
    this.lobby.className = "net-lobby";
    this.lobby.textContent = CONNECTION_TEXT.lobby;
    this.lobby.addEventListener("click", goToLobby);
    // Space is the game's attack key, so the game cancels a button's own Space press (keyboard.ts): this button takes it itself.
    this.lobby.addEventListener("keydown", (e) => {
      if (e.key !== " ") return;
      e.preventDefault();
      goToLobby();
    });
    box.append(spinner, this.title, this.detail, this.lobby);
    this.root.append(box);
    parent.append(this.root);
  }

  /** Shows what the status says, or hides the screen when the connection is up. */
  show(status: NetStatus) {
    this.root.hidden = status.state === "online";
    if (status.state === "online") return;
    // A "refused" world is on its way back (the page reloads into it): shown like reconnecting, with no focus grab.
    const lost = status.state === "lost" && status.reason !== "refused";
    const text = status.state === "lost" ? CONNECTION_TEXT[status.reason] : CONNECTION_TEXT.reconnecting;
    this.title.textContent = text.title;
    this.detail.textContent = text.detail;
    this.root.classList.toggle("reconnecting", !lost);
    this.root.classList.toggle("lost", lost);
    // The focus goes to the button once the world is lost, so Enter takes the player back at once.
    if (lost) this.lobby.focus();
  }
}
