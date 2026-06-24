import type { JournalEntry, JournalEntryKind } from "./SessionJournal";

type DiagramElement = {
  id?: string;
  type?: string;
  businessObject?: {
    get?: (key: string) => unknown;
    [key: string]: unknown;
  };
  source?: DiagramElement | null;
  target?: DiagramElement | null;
};

type CommandEvent = {
  context?: {
    element?: DiagramElement;
    shape?: DiagramElement;
    connection?: DiagramElement;
    newLabel?: string;
    oldLabel?: string;
    properties?: Record<string, unknown>;
    oldProperties?: Record<string, unknown>;
    source?: DiagramElement | null;
    target?: DiagramElement | null;
  };
};

type JournalDraft = Omit<JournalEntry, "id" | "timestamp" | "note">;

const trackedProperties = [
  "description",
  "eventDescription",
  "role",
  "included",
  "executed",
  "pending",
  "type",
] as const;

export function createJournalEntry(
  id: string,
  draft: JournalDraft,
): JournalEntry {
  return {
    ...draft,
    id,
    timestamp: new Date().toISOString(),
    note: "",
  };
}

export function createOpenedGraphEntry(id: string, graphName: string): JournalEntry {
  return createJournalEntry(id, {
    kind: "opened",
    title: "Opened graph",
    summary: `Started a new journal for ${graphName || "this graph"}.`,
  });
}

export function mapCommandToJournalDraft(
  command: string,
  event: CommandEvent,
): JournalDraft | null {
  const context = event.context;
  if (!context) {
    return null;
  }

  switch (command) {
    case "shape.create":
      return createElementDraft("created", context.shape);
    case "shape.delete":
      return createElementDraft("deleted", context.shape);
    case "connection.create":
      return createRelationDraft("created", context.connection);
    case "connection.delete":
      return createRelationDraft("deleted", context.connection, context.source, context.target);
    case "element.updateProperties":
      return createPropertiesDraft(context.element, context.properties, context.oldProperties);
    case "element.updateLabel":
      return createLabelDraft(context.element, context.oldLabel, context.newLabel);
    default:
      return null;
  }
}

function createElementDraft(
  kind: Extract<JournalEntryKind, "created" | "deleted">,
  element?: DiagramElement,
): JournalDraft | null {
  if (!element || !isJournalElement(element)) {
    return null;
  }

  const typeLabel = elementTypeLabel(element);
  const name = elementLabel(element);
  const action = kind === "created" ? "Created" : "Deleted";

  return {
    kind,
    title: `${action} ${typeLabel}`,
    summary: `${action} ${typeLabel.toLowerCase()} "${name}".`,
    elementId: element.id,
    elementType: element.type,
  };
}

function createRelationDraft(
  kind: Extract<JournalEntryKind, "created" | "deleted">,
  relation?: DiagramElement,
  sourceOverride?: DiagramElement | null,
  targetOverride?: DiagramElement | null,
): JournalDraft | null {
  if (!relation || relation.type !== "dcr:Relation") {
    return null;
  }

  const source = sourceOverride ?? relation.source;
  const target = targetOverride ?? relation.target;
  const relationType = property(relation, "type") || "relation";
  const action = kind === "created" ? "Created" : "Deleted";

  return {
    kind,
    title: `${action} ${relationType} relation`,
    summary: `${action} ${relationType} relation from "${elementLabel(source)}" to "${elementLabel(target)}".`,
    elementId: relation.id,
    elementType: relation.type,
  };
}

function createPropertiesDraft(
  element?: DiagramElement,
  properties?: Record<string, unknown>,
  oldProperties?: Record<string, unknown>,
): JournalDraft | null {
  if (!element || !properties) {
    return null;
  }

  const changes = trackedProperties
    .filter((key) => key in properties)
    .map((key) => ({
      key,
      oldValue: formatValue(oldProperties?.[key]),
      newValue: formatValue(properties[key]),
    }))
    .filter((change) => change.oldValue !== change.newValue);

  if (changes.length === 0) {
    return null;
  }

  const name = elementLabel(element);
  const typeLabel = elementTypeLabel(element);
  const changeSummary = changes
    .map((change) => `${propertyLabel(change.key)} from ${change.oldValue} to ${change.newValue}`)
    .join(", ");

  return {
    kind: "updated",
    title: `Updated ${typeLabel}`,
    summary: `Updated "${name}": ${changeSummary}.`,
    elementId: element.id,
    elementType: element.type,
  };
}

function createLabelDraft(
  element?: DiagramElement,
  oldLabel?: string,
  newLabel?: string,
): JournalDraft | null {
  if (!element || oldLabel === newLabel || !isJournalElement(element)) {
    return null;
  }

  return {
    kind: "updated",
    title: `Renamed ${elementTypeLabel(element)}`,
    summary: `Changed label from ${formatValue(oldLabel)} to ${formatValue(newLabel)}.`,
    elementId: element.id,
    elementType: element.type,
  };
}

function isJournalElement(element: DiagramElement) {
  return ["dcr:Event", "dcr:SubProcess", "dcr:Nesting"].includes(element.type ?? "");
}

function elementTypeLabel(element: DiagramElement) {
  switch (element.type) {
    case "dcr:Event":
      return "Event";
    case "dcr:SubProcess":
      return "Subprocess";
    case "dcr:Nesting":
      return "Nesting";
    case "dcr:Relation":
      return "Relation";
    default:
      return element.type ?? "Element";
  }
}

function elementLabel(element?: DiagramElement | null) {
  if (!element) {
    return "unknown";
  }

  return property(element, "description") || property(element, "role") || element.id || "unnamed";
}

function property(element: DiagramElement, key: string) {
  const value =
    element.businessObject?.get?.(key) ??
    (element.businessObject ? element.businessObject[key] : undefined);

  return typeof value === "string" ? value : "";
}

function propertyLabel(propertyName: string) {
  if (propertyName === "type") {
    return "relation type";
  }

  if (propertyName === "description") {
    return "label";
  }

  if (propertyName === "eventDescription") {
    return "description";
  }

  return propertyName;
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "empty";
  }

  if (typeof value === "boolean") {
    return value ? "on" : "off";
  }

  return `"${String(value)}"`;
}
