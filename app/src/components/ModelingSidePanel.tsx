import styled from "styled-components";
import type { ReactNode } from "react";

export type ModelingSidePanelTab = "details" | "journal";

const Panel = styled.aside`
  position: fixed;
  top: 4.25rem;
  right: 1rem;
  width: min(24rem, calc(100vw - 2rem));
  max-height: calc(100vh - 5.25rem);
  z-index: 4;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: white;
  border: 1px solid #c7c7c7;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const TabList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid #d7d7d7;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 0.7rem;
  border: 0;
  border-bottom: 3px solid ${(props) => (props.$active ? "black" : "transparent")};
  background: ${(props) => (props.$active ? "#f4f4f4" : "white")};
  color: black;
  font: inherit;
  font-weight: ${(props) => (props.$active ? 700 : 500)};

  &:hover {
    background: #f4f4f4;
  }
`;

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  padding: 1rem;
  overflow-y: auto;
`;

interface ModelingSidePanelProps {
  activeTab: ModelingSidePanelTab;
  details: ReactNode;
  journal: ReactNode;
  onTabChange: (tab: ModelingSidePanelTab) => void;
  show: boolean;
}

function ModelingSidePanel({
  activeTab,
  details,
  journal,
  onTabChange,
  show,
}: ModelingSidePanelProps) {
  if (!show) {
    return null;
  }

  return (
    <Panel aria-label="Modeling side panel">
      <TabList role="tablist" aria-label="Modeling side panel tabs">
        <TabButton
          $active={activeTab === "details"}
          aria-selected={activeTab === "details"}
          onClick={() => onTabChange("details")}
          role="tab"
          type="button"
        >
          Details
        </TabButton>
        <TabButton
          $active={activeTab === "journal"}
          aria-selected={activeTab === "journal"}
          onClick={() => onTabChange("journal")}
          role="tab"
          type="button"
        >
          Journal
        </TabButton>
      </TabList>
      <PanelBody>{activeTab === "details" ? details : journal}</PanelBody>
    </Panel>
  );
}

export default ModelingSidePanel;
