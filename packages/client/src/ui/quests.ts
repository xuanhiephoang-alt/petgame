import { QUESTS, rewardText } from "@petgame/shared";
import { QUEST_TEXT } from "./strings.ts";

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
      this.element.innerHTML = QUEST_TEXT.allDone;
      return;
    }
    const count = quest.event === "palLevel" ? QUEST_TEXT.levelCount(progress, quest.goal) : `${progress}/${quest.goal}`;
    this.element.innerHTML =
      `<strong>📜 ${quest.title}</strong> <span class="quest-count">${quest.goal > 1 ? count : ""}</span>` +
      QUEST_TEXT.hintAndReward(quest.hint, rewardText(quest.reward));
  }
}
