import { QUESTS, rewardText } from "@petgame/shared";

/** Small panel under the status showing the current quest and its progress. */
export class QuestTracker {
  readonly element: HTMLDivElement;
  private last = "";

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "hud-quest";
    parent.append(this.element);
  }

  update(index: number, progress: number) {
    const key = `${index}:${progress}`;
    if (key === this.last) return;
    this.last = key;
    const quest = QUESTS[index];
    if (!quest) {
      this.element.innerHTML = `<strong>📜 Đã xong mọi nhiệm vụ!</strong>`;
      return;
    }
    const count = quest.event === "palLevel" ? `cấp ${progress}/${quest.goal}` : `${progress}/${quest.goal}`;
    this.element.innerHTML =
      `<strong>📜 ${quest.title}</strong> <span class="quest-count">${quest.goal > 1 ? count : ""}</span>` +
      `<small>${quest.hint}</small><small class="quest-reward">Thưởng: ${rewardText(quest.reward)}</small>`;
  }
}
