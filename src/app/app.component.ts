import { Component, OnInit, OnDestroy, NgZone } from "@angular/core";
import { Service, FAR_FUTURE, ACTION_COLORS, snapToDay } from "./app.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit, OnDestroy {
  startRange!: Date;
  endRange!: Date;
  tasks: any[] = [];
  filteredTasks: any[] = [];
  dependencies: any[] = [];
  activeFilter = "Alle";
  departments = ["Alle", "Service", "Testing", "Sales", "QA"];

  // Selected range (set by cell left-click or right-click menu)
  rangeFrom: Date | null = null;
  rangeTo: Date | null = null;

  // Task selected via right-click for "move to range"
  lastRightClickedTaskId: number | null = null;
  lastRightClickedTaskTitle: string = "";

  private observer: MutationObserver | null = null;
  private obsTimer: any;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(private service: Service, private zone: NgZone) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.tasks = this.service.getTasks();
    this.dependencies = this.service.getDependencies();
    this.applyFilterAndSort();

    const today = new Date();
    this.startRange = new Date(today);
    this.startRange.setDate(today.getDate() - 7);
    this.endRange = new Date(today);
    this.endRange.setDate(today.getDate() + 28);
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
    clearTimeout(this.obsTimer);
    this.removeClickHandler();
  }

  // ── Range state ───────────────────────────────────────────────────────────

  get rangeActive(): boolean {
    return this.rangeFrom !== null;
  }

  get rangeLabel(): string {
    if (!this.rangeFrom) return "";
    const f = this.formatDate(this.rangeFrom);
    if (!this.rangeTo || this.rangeTo.getTime() === this.rangeFrom.getTime())
      return f;
    return `${f} – ${this.formatDate(this.rangeTo)}`;
  }

  clearRange() {
    this.rangeFrom = null;
    this.rangeTo = null;
    this.lastRightClickedTaskId = null;
    this.lastRightClickedTaskTitle = "";
  }

  createInRange(actionType: string) {
    if (!this.rangeFrom) return;
    const start = new Date(this.rangeFrom);
    const end = this.rangeTo ? new Date(this.rangeTo) : new Date(start);
    end.setDate(end.getDate() + 1);
    const parentId = this.promptParentId();
    if (parentId === null) return;
    this.doCreateTask(actionType, start, end, parentId);
    this.clearRange();
  }

  moveSelectedTaskToRange() {
    if (!this.rangeFrom || !this.lastRightClickedTaskId) return;
    const task = this.tasks.find((t) => t.id === this.lastRightClickedTaskId);
    if (!task) return;
    const dur =
      !task.isUnscheduled && task.start && task.end
        ? task.end.getTime() - task.start.getTime()
        : 86400000;
    task.start = new Date(this.rangeFrom);
    task.end = new Date(this.rangeFrom.getTime() + dur);
    task.isUnscheduled = false;
    task.color = ACTION_COLORS[task.actionType] ?? "#e74c3c";
    this.lastRightClickedTaskId = null;
    this.lastRightClickedTaskTitle = "";
    this.applyFilterAndSort();
    setTimeout(() => this.applyBarStyles(), 300);
  }

  // ── Cell left-click: select date range ───────────────────────────────────
  // Uses the gantt header row cells to map screen X → calendar date reliably.

  private setupClickHandler() {
    this.removeClickHandler();
    const ganttView = document.querySelector(".dx-gantt-view");
    if (!ganttView) return;

    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".dx-gantt-task")) return; // task bar
      if (target.closest(".dx-gantt-header")) return; // header row

      const date = this.getDateFromClientX(e.clientX);
      if (!date) return;

      this.zone.run(() => {
        if (!this.rangeFrom) {
          // 1st click → start selection
          this.rangeFrom = date;
          this.rangeTo = date;
        } else if (
          date.getTime() === this.rangeFrom.getTime() &&
          (!this.rangeTo || this.rangeTo.getTime() === this.rangeFrom.getTime())
        ) {
          // Click same day again → deselect
          this.clearRange();
        } else if (date >= this.rangeFrom) {
          // Extend end
          this.rangeTo = date;
        } else {
          // Extend start backwards
          this.rangeFrom = date;
        }
      });
    };

    ganttView.addEventListener("click", this.clickHandler as EventListener);
  }

  private removeClickHandler() {
    if (this.clickHandler) {
      const ganttView = document.querySelector(".dx-gantt-view");
      if (ganttView)
        ganttView.removeEventListener(
          "click",
          this.clickHandler as EventListener
        );
      this.clickHandler = null;
    }
  }

  // Maps a clientX screen coordinate to a calendar Date using the rendered header cells.
  private getDateFromClientX(clientX: number): Date | null {
    try {
      const headerRows = document.querySelectorAll(
        ".dx-gantt-view .dx-gantt-header-row"
      );
      if (!headerRows.length) return null;
      // Bottom row = individual day cells
      const bottomRow = headerRows[headerRows.length - 1];
      const cells = bottomRow.querySelectorAll("td");
      for (let i = 0; i < cells.length; i++) {
        const rect = (cells[i] as HTMLElement).getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right) {
          const date = new Date(this.startRange);
          date.setDate(date.getDate() + i);
          return snapToDay(date);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatDate(d: Date | null): string {
    return d ? d.toLocaleDateString("de-DE") : "";
  }

  get parentTractors(): any[] {
    return this.tasks.filter((t) => t.isParent);
  }

  private promptParentId(): number | null {
    const parents = this.parentTractors;
    const list = parents
      .map((t, i) => `${i + 1} = ${t.title.replace("🚜 ", "")}`)
      .join("\n");
    const raw = window.prompt(`Traktor wählen:\n\n${list}`);
    if (!raw) return null;
    const idx = parseInt(raw.trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= parents.length) {
      alert("Ungültige Auswahl.");
      return null;
    }
    return parents[idx].id;
  }

  // Prompt for Conversion or Repair only (used for "Neue Aktion")
  private promptActionType(): string | null {
    const raw = window.prompt(
      "Aktionstyp wählen:\n\n1 - Conversion\n2 - Repair\n\nNummer eingeben:"
    );
    if (!raw) return null;
    const n = parseInt(raw.trim(), 10);
    if (n === 1) return "conversion";
    if (n === 2) return "repair";
    alert("Ungültige Auswahl.");
    return null;
  }

  private doCreateTask(
    actionType: string,
    start: Date,
    end: Date,
    parentId: number
  ) {
    const parent = this.tasks.find((t) => t.id === parentId);
    if (!parent) return;
    const defaultTitle =
      actionType.charAt(0).toUpperCase() + actionType.slice(1);
    const title = window.prompt("Bezeichnung:", defaultTitle);
    if (!title) return;
    // No description prompt — just title + type
    this.tasks.push({
      id: Date.now(),
      parentId,
      title,
      start,
      end,
      actionType,
      isParent: false,
      isUnscheduled: false,
      department: parent.department,
      description: "",
      color: ACTION_COLORS[actionType] ?? "#e74c3c",
    });
    this.applyFilterAndSort();
    setTimeout(() => this.applyBarStyles(), 300);
  }

  // ── Sorting ───────────────────────────────────────────────────────────────

  private typePriority(t: any): number {
    if (t.isUnscheduled) return 100;
    switch (t.actionType) {
      case "leihvertrag":
        return 0;
      case "feldtest":
        return 1;
      case "conversion":
        return 2;
      case "repair":
        return 3;
      default:
        return 5;
    }
  }

  private datePriority(t: any): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (!t.start || t.start >= FAR_FUTURE) return 5;
    if (t.start <= now && t.end >= now) return 0;
    if (t.start > now) return 1;
    return 2;
  }

  private getSortedTasks(src: any[]): any[] {
    const parents = src.filter((t) => t.parentId === 0);
    const result: any[] = [];
    parents.forEach((parent) => {
      result.push(parent);
      const children = src
        .filter((t) => t.parentId === parent.id)
        .sort((a, b) => {
          const tp = this.typePriority(a) - this.typePriority(b);
          if (tp !== 0) return tp;
          const dp = this.datePriority(a) - this.datePriority(b);
          if (dp !== 0) return dp;
          return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
        });
      result.push(...children);
    });
    return result;
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  private applyFilterAndSort() {
    let base: any[];
    if (this.activeFilter === "Alle") {
      base = [...this.tasks];
    } else {
      const dept = this.activeFilter;
      const childIds = new Set(
        this.tasks.filter((t) => t.department === dept).map((t) => t.id)
      );
      const parentIds = new Set(
        this.tasks
          .filter((t) => childIds.has(t.id) && t.parentId !== 0)
          .map((t) => t.parentId)
      );
      base = this.tasks.filter(
        (t) => childIds.has(t.id) || parentIds.has(t.id)
      );
    }
    this.filteredTasks = this.getSortedTasks(base);
  }

  filterBy(dept: string) {
    this.activeFilter = dept;
    this.applyFilterAndSort();
    setTimeout(() => this.applyBarStyles(), 300);
  }

  // ── Bar styles ────────────────────────────────────────────────────────────

  private applyBarStyles() {
    document.querySelectorAll(".dx-gantt-task").forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.getAttribute("data-task-id");
      if (!id) return;
      const task = this.filteredTasks.find((t) => String(t.id) === id);
      if (!task) return;
      task.isUnscheduled
        ? htmlEl.classList.add("unscheduled-task")
        : htmlEl.classList.remove("unscheduled-task");
      task.isParent
        ? htmlEl.classList.add("asset-task")
        : htmlEl.classList.remove("asset-task");
    });
  }

  onContentReady(_e: any) {
    setTimeout(() => {
      this.applyBarStyles();
      this.setupClickHandler(); // attach cell-click listener after render
    }, 300);

    if (this.observer) this.observer.disconnect();
    const container = document.querySelector(".dx-gantt-view");
    if (container) {
      this.observer = new MutationObserver(() => {
        clearTimeout(this.obsTimer);
        this.obsTimer = setTimeout(() => this.applyBarStyles(), 150);
      });
      this.observer.observe(container, { childList: true, subtree: true });
    }
  }

  onTaskUpdating(e: any) {
    if (!e.newValues) return;
    ["start", "end"].forEach((key) => {
      if (e.newValues[key])
        e.newValues[key] = snapToDay(new Date(e.newValues[key]));
    });
  }

  onTaskUpdated(e: any) {
    const task = this.tasks.find((t) => t.id === e.key);
    if (task && e.values) Object.assign(task, e.values);
    this.applyFilterAndSort();
    setTimeout(() => this.applyBarStyles(), 250);
  }

  onTaskInserted(e: any) {
    if (!e.values) return;
    this.tasks.push({
      id: e.key,
      isParent: false,
      isUnscheduled: false,
      actionType: "conversion",
      department: "Service",
      description: "",
      color: ACTION_COLORS.conversion,
      ...e.values,
    });
    this.applyFilterAndSort();
  }

  onTaskDeleted(e: any) {
    this.tasks = this.tasks.filter((t) => t.id !== e.key);
    this.applyFilterAndSort();
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  // IMPORTANT: DevExtreme Gantt menu items use `onClick`, NOT `onItemClick`

  onContextMenuPreparing(e: any) {
    if (!e.items) e.items = [];

    // ── Right-click on a TASK ─────────────────────────────────────────────
    if (e.targetType === "task") {
      const task = this.tasks.find((t) => t.id === e.key);
      if (!task || task.isParent) return;

      // Store for "move to range" action
      this.lastRightClickedTaskId = task.id;
      this.lastRightClickedTaskTitle = task.title;

      e.items = [
        // 1. Auf unbestimmte Zeit setzen / Datum festlegen
        {
          text: task.isUnscheduled
            ? "📅 Datum festlegen"
            : "❌ Auf unbestimmte Zeit setzen",
          onClick: () => {
            if (task.isUnscheduled) {
              const raw = window.prompt(
                "Startdatum (YYYY-MM-DD):",
                new Date().toISOString().slice(0, 10)
              );
              if (!raw) return;
              const start = snapToDay(new Date(raw));
              if (isNaN(start.getTime())) {
                alert("Ungültiges Datum.");
                return;
              }
              const end = new Date(start);
              end.setDate(start.getDate() + 1);
              task.start = start;
              task.end = end;
              task.isUnscheduled = false;
              task.color = ACTION_COLORS[task.actionType] ?? "#e74c3c";
            } else {
              task.start = new Date(FAR_FUTURE);
              task.end = new Date(FAR_FUTURE);
              task.isUnscheduled = true;
              task.color = ACTION_COLORS.unscheduled;
            }
            this.applyFilterAndSort();
            setTimeout(() => this.applyBarStyles(), 300);
          },
        },

        // 2. Zu Datum verschieben (prompt)
        {
          text: "📆 Zu Datum verschieben",
          onClick: () => {
            const def = task.isUnscheduled
              ? new Date().toISOString().slice(0, 10)
              : task.start.toISOString().slice(0, 10);
            const raw = window.prompt("Neues Startdatum (YYYY-MM-DD):", def);
            if (!raw) return;
            const newStart = snapToDay(new Date(raw));
            if (isNaN(newStart.getTime())) {
              alert("Ungültiges Datum.");
              return;
            }
            const dur = task.isUnscheduled
              ? 86400000
              : task.end.getTime() - task.start.getTime();
            task.start = newStart;
            task.end = new Date(newStart.getTime() + dur);
            task.isUnscheduled = false;
            task.color = ACTION_COLORS[task.actionType] ?? "#e74c3c";
            this.applyFilterAndSort();
            setTimeout(() => this.applyBarStyles(), 300);
          },
        },

        // 3. Zur markierten Auswahl verschieben (only if range active)
        this.rangeFrom
          ? {
              text: `➡️ Zur Kachelauswahl verschieben (${this.rangeLabel})`,
              onClick: () => {
                this.moveSelectedTaskToRange();
              },
            }
          : {
              text: "➡️ Zur Kachelauswahl verschieben (erst Kacheln anklicken)",
              disabled: true,
            },

        // 4. Leihvertrag verlängern (only for leihvertrag tasks)
        ...(task.actionType === "leihvertrag"
          ? [
              {
                text: "🔄 Leihvertrag verlängern",
                onClick: () => {
                  const raw = window.prompt(
                    "Neues Enddatum (YYYY-MM-DD):",
                    task.end.toISOString().slice(0, 10)
                  );
                  if (!raw) return;
                  const newEnd = snapToDay(new Date(raw));
                  if (isNaN(newEnd.getTime()) || newEnd <= task.start) {
                    alert("Datum muss nach dem Startdatum liegen.");
                    return;
                  }
                  task.end = newEnd;
                  this.applyFilterAndSort();
                  setTimeout(() => this.applyBarStyles(), 300);
                },
              },
            ]
          : []),
      ];

      return;
    }

    // ── Right-click on empty calendar cell ────────────────────────────────
    const rawDate = e.data?.startDate ?? e.data?.date ?? null;
    const clickDate = rawDate
      ? snapToDay(new Date(rawDate))
      : snapToDay(new Date());
    const ds = this.formatDate(clickDate);
    const clickIso = clickDate.toISOString().slice(0, 10);

    e.items = [
      // Set range from/to this cell
      {
        text: `📌 Von hier setzen (${ds})`,
        onClick: () =>
          this.zone.run(() => {
            this.rangeFrom = clickDate;
            if (!this.rangeTo) this.rangeTo = clickDate;
          }),
      },
      {
        text: `📌 Bis hier setzen (${ds})`,
        onClick: () =>
          this.zone.run(() => {
            this.rangeTo = clickDate;
            if (!this.rangeFrom) this.rangeFrom = clickDate;
          }),
      },

      { text: "───────────────────", disabled: true },

      // New Aktion (Conversion or Repair — type picker)
      {
        text: `➕ Neue Aktion am ${ds}`,
        onClick: () => {
          const actionType = this.promptActionType(); // picker: 1=Conversion 2=Repair
          if (!actionType) return;
          const parentId = this.promptParentId();
          if (parentId === null) return;
          const end = new Date(clickDate);
          end.setDate(clickDate.getDate() + 1);
          this.doCreateTask(actionType, clickDate, end, parentId);
        },
      },

      // Quick: new Feldtest
      {
        text: `🔬 Neuen Feldtest ab ${ds}`,
        onClick: () => {
          const parentId = this.promptParentId();
          if (parentId === null) return;
          const rawEnd = window.prompt(
            "Enddatum (YYYY-MM-DD):",
            new Date(clickDate.getTime() + 4 * 86400000)
              .toISOString()
              .slice(0, 10)
          );
          if (!rawEnd) return;
          const end = snapToDay(new Date(rawEnd));
          if (isNaN(end.getTime())) return;
          this.doCreateTask("feldtest", clickDate, end, parentId);
        },
      },

      // Quick: new Leihvertrag
      {
        text: `📋 Neuen Leihvertrag ab ${ds}`,
        onClick: () => {
          const parentId = this.promptParentId();
          if (parentId === null) return;
          const rawEnd = window.prompt(
            "Enddatum (YYYY-MM-DD):",
            new Date(clickDate.getTime() + 7 * 86400000)
              .toISOString()
              .slice(0, 10)
          );
          if (!rawEnd) return;
          const end = snapToDay(new Date(rawEnd));
          if (isNaN(end.getTime())) return;
          this.doCreateTask("leihvertrag", clickDate, end, parentId);
        },
      },
    ];
  }
}
