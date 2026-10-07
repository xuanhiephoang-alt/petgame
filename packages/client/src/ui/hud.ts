import { MAX_PLAYERS, RESOURCES, RESOURCE_INFO, type Resource } from "@petgame/shared";

/** DOM overlay: status panel, toast, and touch action buttons. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly joystickZone: HTMLDivElement;
  private status: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimer = 0;
  private lastStatus = "";

  constructor(
    parent: HTMLElement,
    private isTouch: boolean,
    actions: { attack: () => void; capture: () => void; placeBase: () => void },
  ) {
    this.root = div("hud");
    this.status = div("hud-status");
    this.toast = div("hud-toast");
    this.joystickZone = div("joystick-zone");
    this.root.append(this.status, this.toast);
    const base = document.createElement("button");
    base.className = "base-btn";
    base.textContent = "🏕️ Đặt trại";
    base.title = "Dựng trại ở chỗ đang đứng (phím B)";
    base.addEventListener("click", actions.placeBase);
    this.root.append(base);

    if (isTouch) {
      this.root.append(this.joystickZone);
      this.root.append(button("btn-attack", "Đánh", actions.attack), button("btn-capture", "Bắt", actions.capture));
    }
    parent.append(this.root);
  }

  setStatus(players: number, captured: number, resources: Record<Resource, number>, invite: string) {
    const help = this.isTouch ? "Kéo bên trái để đi • Đánh • Bắt" : "WASD/↑↓←→ đi • Space đánh • E ném bóng • Q thú • B trại";
    const items = RESOURCES.map((r) => `${RESOURCE_INFO[r].icon} ${resources[r]}`).join(" &nbsp; ");
    const html =
      `Người chơi: ${players}/${MAX_PLAYERS} &nbsp; Thú: ${captured} &nbsp; ${items}<br>${help}<br>` +
      `Mời bạn: <a href="${invite}" target="_blank" rel="noopener">${escapeHtml(invite)}</a>`;
    if (html === this.lastStatus) return;
    this.lastStatus = html;
    this.status.innerHTML = html;
  }

  showToast(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("visible"), 2000);
  }
}

function div(className: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}

function button(className: string, label: string, onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `action-btn ${className}`;
  b.textContent = label;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onPress();
  });
  return b;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
