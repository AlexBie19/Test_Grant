import { Injectable } from "@angular/core";

export const FAR_FUTURE = new Date(2099, 0, 1);

export const ACTION_COLORS: { [key: string]: string } = {
  leihvertrag: "#2ecc71",
  feldtest: "#27ae60",
  test: "#00acc1",
  conversion: "#e74c3c",
  repair: "#e74c3c",
  unscheduled: "#95a5a6",
  asset: "#FFE082",
};

export const ACTION_TYPE_OPTIONS = [
  { value: "conversion", label: "1 - Conversion" },
  { value: "repair", label: "2 - Repair" },
  { value: "feldtest", label: "3 - Feldtest" },
  { value: "leihvertrag", label: "4 - Leihvertrag" },
  { value: "test", label: "5 - Test" },
];

const _today = new Date();
_today.setHours(0, 0, 0, 0);

export function snapToDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dOffset(offset: number): Date {
  const date = new Date(_today);
  date.setDate(date.getDate() + offset);
  return date;
}

function statusDisplay(s: string): string {
  switch (s) {
    case "field":
      return "🟢 Feld";
    case "home":
      return "🟠 Heim";
    case "unavailable":
      return "🔴 N/A";
    default:
      return "";
  }
}

function mkTask(
  id: number,
  parentId: number,
  rawTitle: string,
  startOff: number | null,
  endOff: number | null,
  actionType: string,
  department: string,
  isParent = false,
  status?: string,
  operatingHours?: number,
  description?: string
): any {
  const isUnscheduled = startOff === null;
  return {
    id,
    parentId,
    title: isParent ? `🚜 ${rawTitle}` : rawTitle,
    start: isUnscheduled ? FAR_FUTURE : dOffset(startOff!),
    end: isUnscheduled ? FAR_FUTURE : dOffset(endOff!),
    actionType: isParent ? "asset" : actionType,
    isParent,
    isUnscheduled,
    department,
    description: description ?? "",
    statusDisplay: isParent ? statusDisplay(status!) : undefined,
    status: isParent ? status : undefined,
    operatingHours: isParent ? operatingHours : undefined,
    color: isParent
      ? ACTION_COLORS.asset
      : isUnscheduled
      ? ACTION_COLORS.unscheduled
      : ACTION_COLORS[actionType] ?? "#e74c3c",
  };
}

@Injectable({ providedIn: "root" })
export class Service {
  getTasks(): any[] {
    return [
      mkTask(
        1,
        0,
        "123.45.1001",
        -7,
        28,
        "asset",
        "Service",
        true,
        "field",
        1250,
        "Haupttraktor Süd"
      ),
      mkTask(
        2,
        1,
        "Leihvertrag A",
        -3,
        5,
        "leihvertrag",
        "Sales",
        false,
        undefined,
        undefined,
        "Verleih an Müller GmbH"
      ),
      mkTask(
        3,
        1,
        "Feldtest B",
        6,
        10,
        "feldtest",
        "Testing",
        false,
        undefined,
        undefined,
        "Motorleistungstest"
      ),
      mkTask(
        4,
        1,
        "Conversion 1",
        11,
        13,
        "conversion",
        "Service",
        false,
        undefined,
        undefined,
        "Umbau auf E-Motor"
      ),
      mkTask(
        5,
        1,
        "Repair",
        14,
        15,
        "repair",
        "Service",
        false,
        undefined,
        undefined,
        "Getriebeschaden"
      ),
      mkTask(
        6,
        1,
        "Conversion 2 (ungeplant)",
        null,
        null,
        "conversion",
        "Service",
        false,
        undefined,
        undefined,
        "Noch nicht terminiert"
      ),

      mkTask(
        10,
        0,
        "456.78.2002",
        -7,
        28,
        "asset",
        "QA",
        true,
        "home",
        3420,
        "Testtraktor Nord"
      ),
      mkTask(
        11,
        10,
        "Leihvertrag X",
        1,
        8,
        "leihvertrag",
        "Sales",
        false,
        undefined,
        undefined,
        "Verleih an Schmidt AG"
      ),
      mkTask(
        12,
        10,
        "Leihvertrag Y",
        16,
        22,
        "leihvertrag",
        "Sales",
        false,
        undefined,
        undefined,
        "Kurzzeitverleih"
      ),
      mkTask(
        13,
        10,
        "Feldtest C",
        9,
        13,
        "feldtest",
        "Testing",
        false,
        undefined,
        undefined,
        "Hydrauliktest"
      ),
      mkTask(
        14,
        10,
        "Repair",
        0,
        2,
        "repair",
        "QA",
        false,
        undefined,
        undefined,
        "Ölwechsel"
      ),
      mkTask(
        15,
        10,
        "Feldtest (ungeplant)",
        null,
        null,
        "feldtest",
        "Testing",
        false,
        undefined,
        undefined,
        "Termin offen"
      ),

      mkTask(
        20,
        0,
        "789.01.3003",
        -7,
        28,
        "asset",
        "Sales",
        true,
        "unavailable",
        6780,
        "Reservetraktor West"
      ),
      mkTask(
        21,
        20,
        "Feldtest D",
        -5,
        -1,
        "feldtest",
        "Testing",
        false,
        undefined,
        undefined,
        "Abgeschlossen"
      ),
      mkTask(
        22,
        20,
        "Leihvertrag Z",
        3,
        10,
        "leihvertrag",
        "Sales",
        false,
        undefined,
        undefined,
        "Verleih an Weber KG"
      ),
      mkTask(
        23,
        20,
        "Conversion",
        12,
        14,
        "conversion",
        "Sales",
        false,
        undefined,
        undefined,
        "Anbaugerät Wechsel"
      ),
      mkTask(
        24,
        20,
        "Repair (ungeplant)",
        null,
        null,
        "repair",
        "Sales",
        false,
        undefined,
        undefined,
        "Diagnose ausstehend"
      ),
    ];
  }

  getDependencies(): any[] {
    return [];
  }
}
