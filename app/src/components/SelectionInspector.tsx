import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import DCRModeler from "modeler";
import Button from "../utilComponents/Button";

export const RELATION_TYPES = [
  "condition",
  "response",
  "include",
  "exclude",
  "milestone",
  "spawn",
] as const;

export type RelationTypeFilter = (typeof RELATION_TYPES)[number];

export type RelationVisibility = Record<RelationTypeFilter, boolean>;

type DiagramElement = {
  id: string;
  type: string;
  businessObject?: {
    get?: (key: string) => unknown;
    [key: string]: unknown;
  };
  incoming?: DiagramElement[];
  outgoing?: DiagramElement[];
  source?: DiagramElement;
  target?: DiagramElement;
};

type RelationInfo = {
  id: string;
  type: RelationTypeFilter | string;
  direction: "Incoming" | "Outgoing" | "Selected";
  source: string;
  target: string;
};

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
`;

const TypeLabel = styled.div`
  color: #555;
  font-size: 0.9rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
`;

const TextInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #aaa;
  border-radius: 4px;
  font: inherit;
`;

const TextArea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  min-height: 7rem;
  padding: 0.5rem;
  border: 1px solid #aaa;
  border-radius: 4px;
  resize: vertical;
  font: inherit;
`;

const ApplyButton = styled(Button)`
  width: fit-content;
  font-size: 0.95rem;
`;

const ToggleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  padding: 0.45rem;
  border: 1px solid ${(props) => (props.$active ? "black" : "#aaa")};
  border-radius: 4px;
  background: ${(props) => (props.$active ? "black" : "white")};
  color: ${(props) => (props.$active ? "white" : "black")};
  cursor: pointer;
  font: inherit;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
`;

const RelationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const RelationRow = styled.button`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.3rem 0.6rem;
  width: 100%;
  padding: 0.55rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  text-align: left;
  cursor: pointer;
  font: inherit;

  &:hover {
    border-color: black;
  }
`;

const RelationMeta = styled.span`
  color: #555;
  font-size: 0.8rem;
`;

const EmptyText = styled.div`
  color: #555;
`;

function getProperty(element: DiagramElement | null, key: string): string {
  const businessObject = element?.businessObject;
  const value =
    businessObject?.get?.(key) ??
    (businessObject ? businessObject[key] : undefined);

  return typeof value === "string" ? value : "";
}

function getRelationType(element: DiagramElement): string {
  return getProperty(element, "type");
}

function elementLabel(element?: DiagramElement): string {
  if (!element) {
    return "Unknown";
  }

  return getProperty(element, "description") || element.id;
}

function elementTypeLabel(element: DiagramElement): string {
  switch (element.type) {
    case "dcr:Event":
      return "Event";
    case "dcr:SubProcess":
      return "Sub-process";
    case "dcr:Nesting":
      return "Nesting";
    case "dcr:Relation":
      return "Relation";
    default:
      return element.type;
  }
}

function supportsDescription(element: DiagramElement | null) {
  return (
    element?.type === "dcr:Event" ||
    element?.type === "dcr:SubProcess" ||
    element?.type === "dcr:Nesting"
  );
}

function supportsEventDescription(element: DiagramElement | null) {
  return supportsDescription(element);
}

function supportsRole(element: DiagramElement | null) {
  return element?.type === "dcr:Event" || element?.type === "dcr:Nesting";
}

function relationInfo(
  relation: DiagramElement,
  selectedId: string,
): RelationInfo {
  const direction =
    relation.id === selectedId
      ? "Selected"
      : relation.target?.id === selectedId
        ? "Incoming"
        : "Outgoing";

  return {
    id: relation.id,
    type: getRelationType(relation),
    direction,
    source: elementLabel(relation.source),
    target: elementLabel(relation.target),
  };
}

function getSelectedElement(
  modeler: DCRModeler | null,
  selectedElementId: string | null,
) {
  if (!modeler || !selectedElementId) {
    return null;
  }

  return modeler.getElementRegistry().get(selectedElementId) ?? null;
}

function getRelations(element: DiagramElement | null): RelationInfo[] {
  if (!element) {
    return [];
  }

  if (element.type === "dcr:Relation") {
    return [relationInfo(element, element.id)];
  }

  const relations = [
    ...(element.incoming ?? []),
    ...(element.outgoing ?? []),
  ].filter((relation, index, all) => {
    return all.findIndex((other) => other.id === relation.id) === index;
  });

  return relations.map((relation) => relationInfo(relation, element.id));
}

interface SelectionInspectorProps {
  modeler: DCRModeler | null;
  selectedElementId: string | null;
  relationVisibility: RelationVisibility;
  onToggleRelationType: (type: RelationTypeFilter) => void;
  refreshKey: number;
  onRefresh: () => void;
}

function SelectionInspector({
  modeler,
  selectedElementId,
  relationVisibility,
  onToggleRelationType,
  refreshKey,
  onRefresh,
}: SelectionInspectorProps) {
  const selectedElement = useMemo(
    () => getSelectedElement(modeler, selectedElementId),
    [modeler, selectedElementId, refreshKey],
  );

  const [label, setLabel] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    setLabel(getProperty(selectedElement, "description"));
    setEventDescription(getProperty(selectedElement, "eventDescription"));
    setRole(getProperty(selectedElement, "role"));
  }, [selectedElement, refreshKey]);

  const relations = useMemo(() => getRelations(selectedElement), [selectedElement]);

  if (!selectedElement) {
    return <EmptyText>Select an event or relation.</EmptyText>;
  }

  const applyChanges = () => {
    if (!modeler || !selectedElement) {
      return;
    }

    const properties: Record<string, string> = {};
    if (supportsDescription(selectedElement)) {
      properties.description = label;
    }
    if (supportsEventDescription(selectedElement)) {
      properties.eventDescription = eventDescription;
    }
    if (supportsRole(selectedElement)) {
      properties.role = role;
    }

    if (Object.keys(properties).length === 0) {
      return;
    }

    modeler.get("modeling").updateProperties(selectedElement, properties);
    onRefresh();
  };

  const selectRelation = (relationId: string) => {
    if (!modeler) {
      return;
    }

    const relation = modeler.getElementRegistry().get(relationId);
    if (relation) {
      modeler.getSelection().select(relation);
    }
  };

  return (
    <>
      <Header>
        <Title>{elementLabel(selectedElement)}</Title>
        <TypeLabel>{elementTypeLabel(selectedElement)}</TypeLabel>
      </Header>

      {supportsDescription(selectedElement) && (
        <Field>
          Label
          <TextInput
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
      )}

      {supportsEventDescription(selectedElement) && (
        <Field>
          Description
          <TextArea
            value={eventDescription}
            onChange={(event) => setEventDescription(event.target.value)}
          />
        </Field>
      )}

      {supportsRole(selectedElement) && (
        <Field>
          Role
          <TextInput value={role} onChange={(event) => setRole(event.target.value)} />
        </Field>
      )}

      {(supportsDescription(selectedElement) ||
        supportsEventDescription(selectedElement) ||
        supportsRole(selectedElement)) && (
        <ApplyButton onClick={applyChanges}>Apply</ApplyButton>
      )}

      <SectionTitle>Visible Relations</SectionTitle>
      <ToggleGrid>
        {RELATION_TYPES.map((type) => (
          <ToggleButton
            key={type}
            $active={relationVisibility[type]}
            onClick={() => onToggleRelationType(type)}
            type="button"
          >
            {type}
          </ToggleButton>
        ))}
      </ToggleGrid>

      <SectionTitle>Relations</SectionTitle>
      {relations.length === 0 ? (
        <EmptyText>No direct relations.</EmptyText>
      ) : (
        <RelationList>
          {relations.map((relation) => (
            <RelationRow
              key={relation.id}
              onClick={() => selectRelation(relation.id)}
              type="button"
            >
              <strong>{relation.type}</strong>
              <span>
                {relation.source}
                {" -> "}
                {relation.target}
              </span>
              <RelationMeta>{relation.direction}</RelationMeta>
              <RelationMeta>{relation.id}</RelationMeta>
            </RelationRow>
          ))}
        </RelationList>
      )}
    </>
  );
}

export default SelectionInspector;
