import DCRModeler from "modeler";

import emptyBoardXML from "../resources/emptyBoard";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { saveAs } from "file-saver";
import { StateEnum, type StateProps } from "../App";
import FileUpload from "../utilComponents/FileUpload";
import ModalMenu, { type ModalMenuElement } from "../utilComponents/ModalMenu";

import {
  BiAnalyse,
  BiHome,
  BiLeftArrowCircle,
  BiLogOut,
  BiNotepad,
  BiPlus,
  BiSave,
  BiSolidDashboard,
  BiTestTube,
} from "react-icons/bi";

import Examples from "./Examples";
import { toast } from "react-toastify";
import TopRightIcons from "../utilComponents/TopRightIcons";
import { useHotkeys } from "react-hotkeys-hook";
import FullScreenIcon from "../utilComponents/FullScreenIcon";
import StyledFileUpload from "../utilComponents/StyledFileUpload";
import Loading from "../utilComponents/Loading";
import {
  type DCRGraph,
  layoutGraph,
  moddleToDCR,
  nestDCR,
  type Nestings,
} from "dcr-engine";
import GraphNameInput from "../utilComponents/GraphNameInput";
import styled from "styled-components";
import {
  ColoredRelationsSetting,
  MarkerNotationSetting,
} from "./GlobalModalMenuElements";
import ReactiveModeler from "./ReactiveModeler";
import TestDrivenModeling from "./TestDrivenModeling";
import { useBPMN } from '../utilComponents/useBPMN';
import { basePath } from "../utilComponents/basePath";
import SelectionInspector, {
  RELATION_TYPES,
  type RelationTypeFilter,
  type RelationVisibility,
} from "./SelectionInspector";
import ModelingSidePanel, {
  type ModelingSidePanelTab,
} from "./ModelingSidePanel";
import SessionJournal, { type JournalEntry } from "./SessionJournal";
import {
  createJournalEntry,
  createOpenedGraphEntry,
  mapCommandToJournalDraft,
} from "./sessionJournalMapper";
import {
  deduplicateJournalEntries,
  highestJournalSequence,
} from "./journalEntries";
import { isSupabaseConfigured } from "../supabase/client";
import {
  deleteRemoteJournalEntry,
  loadRemoteJournalEntries,
  updateRemoteJournalNote,
  upsertRemoteJournalEntries,
} from "../supabase/journal";
import {
  loadRemoteModelingDraft,
  saveRemoteModelingDraft,
} from "../supabase/modelingDrafts";
import { persistenceErrorMessage } from "../supabase/errors";



const HeatmapButton = styled(BiTestTube)<{
  $clicked: boolean;
  $disabled?: boolean;
}>`
  ${(props) =>
    props.$clicked
      ? `
        background-color: black !important;
        color: white;
    `
      : ``}
  ${(props) =>
    props.$disabled
      ? `
        color : grey;
        border-color: grey !important;
        cursor: default !important;
        &:hover {
            box-shadow: none !important;
        }    
    `
      : ""}
`;

const JournalButton = styled(BiNotepad)<{ $clicked: boolean }>`
  ${(props) =>
    props.$clicked
      ? `
        background-color: black !important;
        color: white;
      `
      : ""}
`;

const DraftStatus = styled.span`
  align-self: center;
  padding: 0.35rem 0.5rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.94);
  color: #333;
  font-size: 0.78rem;
  white-space: nowrap;
`;

const initGraphName = "DCR-JS Graph";

const journalCommands = [
  "shape.create",
  "shape.delete",
  "connection.create",
  "connection.delete",
  "element.updateProperties",
  "element.updateLabel",
] as const;

const initialRelationVisibility = RELATION_TYPES.reduce(
  (acc, relationType) => ({ ...acc, [relationType]: true }),
  {} as RelationVisibility,
);

const persistentErrorToast = {
  autoClose: false,
  closeOnClick: true,
} as const;

const ModelerState = ({
  setState,
  savedGraphs,
  currentGraph,
  setCurrentGraph,
  setModelingPersistenceWarning,
  saveGraph: commitSaveGraph,
  coloredRelations,
  changeColoredRelations,
  markerNotation,
  changeMarkerNotation,
  authEmail,
  onSignOut,
}: StateProps) => {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [examplesData, setExamplesData] = useState<Array<string>>([]);
  const [tdmOpen, setTdmOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  // const modelerRef = useRef<DCRModeler | null>(null);
  const [modeler, setModeler] = useState<DCRModeler | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [relationVisibility, setRelationVisibility] =
    useState<RelationVisibility>(initialRelationVisibility);
  const [inspectorRefreshKey, setInspectorRefreshKey] = useState(0);
  const [sidePanelTab, setSidePanelTab] =
    useState<ModelingSidePanelTab>("details");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [draftSaveKey, setDraftSaveKey] = useState(0);
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [hasUnsavedGraphChanges, setHasUnsavedGraphChanges] = useState(false);
  const journalIdRef = useRef(0);
  const draftRestoreDoneRef = useRef(false);
  const journalSyncGraphIdRef = useRef<string | null>(null);

  const [graphName, setGraphName] = useState<string>(
    currentGraph?.name ?? initGraphName,
  );

  const nextJournalId = useCallback(() => {
    journalIdRef.current += 1;
    return `journal-${journalIdRef.current}`;
  }, []);

  const syncJournalIdCounter = useCallback((entries: JournalEntry[]) => {
    journalIdRef.current = Math.max(
      journalIdRef.current,
      highestJournalSequence(entries),
    );
  }, []);

  const addJournalDraft = useCallback(
    (draft: Parameters<typeof createJournalEntry>[1]) => {
      setJournalEntries((current) => [
        createJournalEntry(nextJournalId(), draft),
        ...current,
      ]);
      setDraftSaveKey((current) => current + 1);
    },
    [nextJournalId],
  );

  const resetJournal = useCallback(
    (openedGraphName: string) => {
      journalIdRef.current = 0;
      setJournalEntries([
        createOpenedGraphEntry(nextJournalId(), openedGraphName),
      ]);
      setDraftSaveKey((current) => current + 1);
    },
    [nextJournalId],
  );

  const addFreeFormJournalNote = useCallback(
    (note: string) => {
      setJournalEntries((current) => [
        {
          ...createJournalEntry(nextJournalId(), {
            kind: "note",
            title: "Session note",
            summary: "Free-form note added by the modeler.",
            userCreated: true,
          }),
          note,
        },
        ...current,
      ]);
      setDraftSaveKey((current) => current + 1);
    },
    [nextJournalId],
  );

  const updateJournalNote = useCallback(
    (entryId: string, note: string) => {
      setJournalEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                note,
              }
          : entry,
        ),
      );
      setDraftSaveKey((current) => current + 1);

      const graphId = currentGraph?.id;
      if (isSupabaseConfigured && graphId) {
        updateRemoteJournalNote(graphId, entryId, note).catch((error) => {
          console.error(error);
          toast.error(persistenceErrorMessage("Unable to save journal note", error));
        });
      }
    },
    [currentGraph?.id],
  );

  const deleteJournalEntry = useCallback(
    (entryId: string) => {
      setJournalEntries((current) =>
        current.filter((entry) => entry.id !== entryId || !entry.userCreated),
      );
      setDraftSaveKey((current) => current + 1);

      const graphId = currentGraph?.id;
      if (isSupabaseConfigured && graphId) {
        deleteRemoteJournalEntry(graphId, entryId).catch((error) => {
          console.error(error);
          toast.error(persistenceErrorMessage("Unable to delete journal note", error));
        });
      }
    },
    [currentGraph?.id],
  );

  const syncJournalEntries = useCallback(
    async (graphId: string, entries: JournalEntry[] = journalEntries) => {
      if (!isSupabaseConfigured) {
        return;
      }

      try {
        await upsertRemoteJournalEntries(graphId, entries);
        journalSyncGraphIdRef.current = graphId;
      } catch (error) {
        console.error(error);
        toast.error(
          persistenceErrorMessage("Unable to sync journal entries", error),
          persistentErrorToast,
        );
      }
    },
    [journalEntries],
  );

  const refreshInspector = useCallback(() => {
    setInspectorRefreshKey((current) => current + 1);
  }, []);

  const markDraftDirty = useCallback(() => {
    setDraftSaveKey((current) => current + 1);
  }, []);

  const markGraphDirty = useCallback(() => {
    setHasUnsavedGraphChanges(true);
    markDraftDirty();
  }, [markDraftDirty]);

  const fitModelerViewport = useCallback(() => {
    if (!modeler) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        modeler.fitViewport({ padding: 120, maxZoom: 1 });
      });
    });
  }, [modeler]);

  const toggleRelationType = useCallback((relationType: RelationTypeFilter) => {
    setRelationVisibility((current) => ({
      ...current,
      [relationType]: !current[relationType],
    }));
  }, []);

  const updateSelection = useCallback(
    (event: { newSelection?: Array<{ id: string; type: string }> }) => {
      const selectedElement = event.newSelection?.find((element) =>
        ["dcr:Event", "dcr:SubProcess", "dcr:Nesting", "dcr:Relation"].includes(
          element.type,
        ),
      );

      setSelectedElementId(selectedElement?.id ?? null);
      if (selectedElement) {
        setSidePanelTab("details");
      }
      refreshInspector();
    },
    [refreshInspector],
  );

  useEffect(() => {
    if (!modeler || !selectedElementId) {
      modeler?.setFocusFilter(null);
      return;
    }

    modeler.setFocusFilter({
      selectedId: selectedElementId,
      visibleRelationTypes: RELATION_TYPES.filter(
        (relationType) => relationVisibility[relationType],
      ),
    });

    return () => modeler.setFocusFilter(null);
  }, [modeler, selectedElementId, relationVisibility, inspectorRefreshKey]);

  useEffect(() => {
    if (!modeler) {
      return;
    }

    const handlers = journalCommands.map((command) => {
      const channel = `commandStack.${command}.executed`;
      const handler = (event: unknown) => {
        const draft = mapCommandToJournalDraft(command, event as never);
        if (draft) {
          addJournalDraft(draft);
        }
      };

      modeler.on(channel, handler);

      return { channel, handler };
    });

    return () => {
      handlers.forEach(({ channel, handler }) => {
        modeler.off(channel, handler);
      });
    };
  }, [addJournalDraft, modeler]);

  useEffect(() => {
    const graphId = currentGraph?.id;
    if (!isSupabaseConfigured || !graphId) {
      return;
    }

    const savedGraphId = graphId;
    let active = true;

    async function loadOrFlushJournal() {
      try {
        if (journalEntries.length > 1) {
          await upsertRemoteJournalEntries(savedGraphId, journalEntries);
          journalSyncGraphIdRef.current = savedGraphId;
          return;
        }

        const remoteEntries = await loadRemoteJournalEntries(savedGraphId);
        if (!active) {
          return;
        }

        if (remoteEntries.length > 0) {
          const uniqueRemoteEntries = deduplicateJournalEntries(remoteEntries);
          syncJournalIdCounter(uniqueRemoteEntries);
          setJournalEntries(uniqueRemoteEntries);
          journalSyncGraphIdRef.current = savedGraphId;
        } else {
          await upsertRemoteJournalEntries(savedGraphId, journalEntries);
          journalSyncGraphIdRef.current = savedGraphId;
        }
      } catch (error) {
        console.error(error);
        toast.error(
          persistenceErrorMessage("Unable to load journal entries", error),
          persistentErrorToast,
        );
      }
    }

    void loadOrFlushJournal();

    return () => {
      active = false;
    };
  }, [currentGraph?.id]);

  useEffect(() => {
    const graphId = currentGraph?.id;
    if (!isSupabaseConfigured || !graphId || journalEntries.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void syncJournalEntries(graphId, journalEntries);
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentGraph?.id, journalEntries, syncJournalEntries]);

  useEffect(() => {
    if (!isSupabaseConfigured || !modeler || !draftRestoreDoneRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDraftStatus("saving");
      modeler
        .saveXML({ format: false })
        .then((data: { xml: string }) =>
          saveRemoteModelingDraft(
            currentGraph?.id ?? null,
            graphName,
            data.xml,
            journalEntries,
          ),
        )
        .then(() => setDraftStatus("saved"))
        .catch((error: unknown) => {
          console.error(error);
          setDraftStatus("error");
          toast.error(
            persistenceErrorMessage("Unable to autosave modeling draft", error),
            persistentErrorToast,
          );
        });
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    currentGraph?.id,
    draftSaveKey,
    graphName,
    journalEntries,
    modeler,
  ]);



  async function saveGraph() {
    if (!modeler) {
      return;
    }

    let saved = false;

    try {
      setLoading(true);
      const data = await modeler.saveXML({ format: false });
      const savedGraph = await commitSaveGraph(graphName, data.xml);
      if (savedGraph) {
        setHasUnsavedGraphChanges(false);
        if (savedGraph.id) {
          await syncJournalEntries(savedGraph.id);
          markDraftDirty();
        }
        toast.success("Graph saved!");
        saved = true;
      }
    } catch {
      toast.error("Failed to save graph...");
    } finally {
      setLoading(false);
    }

    return saved;
  }

  useHotkeys("ctrl+s", saveGraph, { preventDefault: true });

  useEffect(() => {
    // Fetch examples
    fetch(basePath("/examples/generated_examples.txt"))
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to fetch examples status code: " + response.status,
          );
        }
        return response.text();
      })
      .then((data) => {
        let files = data.split("\n");
        files.pop(); // Remove last empty line
        files = files.map((name) => name.split(".").slice(0, -1).join(".")); // Shave file extension off
        setExamplesData(files);
      });
  }, []);



  function open(
    data: string,
    parse: ((xml: string) => Promise<void>) | undefined,
    importFn?: string,
    savedGraphName?: string | null,
  ) {
    const importName = importFn?.replace(/\.[^/.]+$/, "");

    if (parse) {
      parse(data)
        .then(() => {
          const openedGraphName = importName ? importName : initGraphName;
          setGraphName(openedGraphName);
          setCurrentGraph(savedGraphName ?? null);
          setHasUnsavedGraphChanges(!savedGraphName);
          setSelectedElementId(null);
          modeler?.setFocusFilter(null);
          fitModelerViewport();
          resetJournal(openedGraphName);
          markDraftDirty();
        })
        .catch((e) => {
          console.log(e);
          toast.error("Unable to parse XML...");
        });
    }
  }

  

  async function saveAsXML() {
    if (!modeler) {
      return;
    }

    const data = await modeler.saveXML({ format: true });
    const blob = new Blob([data.xml]);

    saveAs(blob, `${graphName}.xml`);
  }

  async function saveAsDCRXML() {
    if (!modeler) {
      return;
    }

    const data = await modeler.saveDCRXML();
    const blob = new Blob([data.xml]);

    saveAs(blob, `${graphName}.xml`);
  }

  async function saveAsSvg() {
    if (!modeler) {
      return;
    }

    const data = await modeler.saveSVG();
    const blob = new Blob([data.svg]);

    saveAs(blob, `${graphName}.svg`);
  }

  function savedGraphElements(): Array<ModalMenuElement> {
    if (savedGraphs.size === 0) {
      return [];
    }

    return [
      {
        text: "Saved Graphs:",
        elements: [...savedGraphs.values()].map(({ name, graph }) => {
          return {
            icon: <BiLeftArrowCircle />,
            text: name,
            onClick: () => {
              open(graph, modeler?.importXML, name + ".xml", name);
              setMenuOpen(false);
            },
          };
        }),
      },
    ];
  }

  const menuElements: Array<ModalMenuElement> = [
    {
      icon: <BiPlus />,
      text: "New Diagram",
      onClick: () => {
        open(emptyBoardXML, modeler?.importXML);
        setMenuOpen(false);
      },
    },
    {
      icon: <BiSave />,
      text: "Save Graph",
      onClick: () => {
        void saveGraph();
        setMenuOpen(false);
      },
    },
    {
      text: "Open",
      elements: [
        {
          customElement: (
            <StyledFileUpload>
              <FileUpload
                accept="text/xml"
                fileCallback={(name, contents) => {
                  open(contents, modeler?.importXML, name);
                  setMenuOpen(false);
                }}
              >
                <div />
                <>Open Editor XML</>
              </FileUpload>
            </StyledFileUpload>
          ),
        },
        {
          customElement: (
            <StyledFileUpload>
              <FileUpload
                accept="text/xml"
                fileCallback={(name, contents) => {
                  open(contents, modeler?.importDCRPortalXML, name);
                  setMenuOpen(false);
                }}
              >
                <div />
                <>Open DCR Solution XML</>
              </FileUpload>
            </StyledFileUpload>
          ),
        },
        {
          customElement: (
            <StyledFileUpload>
              <FileUpload accept=".bpmn,.xml" fileCallback={(name, contents) => {
                setCurrentGraph(null);
                resetJournal(name.replace(/\.(bpmn|xml)$/, '') || initGraphName);
                markGraphDirty();
                convertBpmnToDcr(contents, name);
                setMenuOpen(false);
              }}>
                <div />
                <>Open BPMN 2.0 XML</>
              </FileUpload>
            </StyledFileUpload>
          ),
        },
      ],
    },
    {
      text: "Download",
      elements: [
        {
          icon: <div />,
          text: "Download Editor XML",
          onClick: () => {
            saveAsXML();
            setMenuOpen(false);
          },
        },
        {
          icon: <div />,
          text: "Download DCR Solutions XML",
          onClick: () => {
            saveAsDCRXML();
            setMenuOpen(false);
          },
        },
        {
          icon: <div />,
          text: "Download SVG",
          onClick: () => {
            saveAsSvg();
            setMenuOpen(false);
          },
        },
      ],
    },
    {
      icon: <BiSolidDashboard />,
      text: "Examples",
      onClick: () => {
        setMenuOpen(false);
        setExamplesOpen(true);
      },
    },
    ...savedGraphElements(),
  ];

  const bottomElements: Array<ModalMenuElement> = [
    ...(onSignOut
      ? [
          {
            icon: <BiLogOut />,
            text: authEmail ? `Sign out (${authEmail})` : "Sign out",
            onClick: () => {
              setMenuOpen(false);
              onSignOut();
            },
          },
        ]
      : []),
    {
      customElement: (
        <ColoredRelationsSetting
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      ),
    },
    {
      customElement: (
        <MarkerNotationSetting
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
        />
      ),
    },
  ];

  const layout = () => {
    if (!modeler) return;
    const elementRegistry = modeler.getElementRegistry();
    const events = Object.values(elementRegistry._elements).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (element: any) => element.element.id.includes("Event"),
    );
    const uniqueActivities = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events.map((element: any) => element.element.businessObject.description),
    );
    if (events.length !== uniqueActivities.size || uniqueActivities.has("")) {
      toast.warning(
        "Graph layout not supported for empty or duplicate activity names...",
      );
      return;
    }
    if (
      Object.keys(elementRegistry._elements).find(
        (element) =>
          element.includes("SubProcess") ||
          elementRegistry._elements[element].element.businessObject.role,
      )
    ) {
      toast.warning("Graph layout not supported for subprocesses and roles...");
      return;
    }
    if (
      confirm(
        "This will overwrite your current layout, do you wish to continue?",
      )
    ) {
      try {
        const nest = confirm("Do you wish to nest?");
        const graph = moddleToDCR(elementRegistry, true);
        const nestings = nestDCR(graph);
        const params: [DCRGraph, Nestings | undefined] = nest
          ? [nestings.nestedGraph, nestings]
          : [graph, undefined];
        layoutGraph(...params)
          .then((xml) => {
            modeler
              ?.importXML(xml)
              .catch((e) => {
                console.log(e);
                toast.error("Invalid xml...");
              })
              .finally(() => {
                setLoading(false);
              });
          })
          .catch((e) => {
            console.log(e);
            setLoading(false);
            toast.error("Unable to layout graph...");
          });
      } catch {
        toast.error("Something went wrong...");
      }
    }
  };

  const autoLayout = () => {
    if (!modeler) return;
    const elementRegistry = modeler.getElementRegistry();
    const events = Object.values(elementRegistry._elements).filter(
      (element: any) => element.element.id.includes("Event")
    );
    const uniqueActivities = new Set(
      events.map((element: any) => element.element.businessObject.description)
    );
    if (events.length !== uniqueActivities.size || uniqueActivities.has("")) {
      return;
    }
    if (
      Object.keys(elementRegistry._elements).find(
        (element) =>
          element.includes("SubProcess") ||
          elementRegistry._elements[element].element.businessObject.role
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const graph = moddleToDCR(elementRegistry, true);
      const params: [DCRGraph, undefined] = [graph, undefined];
      layoutGraph(...params)
        .then((xml) => {
          modeler
            ?.importXML(xml)
            .catch((e) => {
              console.log(e);
            })
            .finally(() => {
              setLoading(false);
            });
        })
        .catch((e) => {
          console.log(e);
          setLoading(false);
        });
    } catch (e) {
      setLoading(false);
    }
  };

 const { convertBpmnToDcr, loading: bpmnLoading } = useBPMN(modeler, setGraphName, setLoading, autoLayout);

  const onInitModeler = useEffectEvent(async (modeler: DCRModeler) => {
    let initialXml = currentGraph?.graph ?? emptyBoardXML;
    let initialGraphName = currentGraph?.name ?? initGraphName;
    let initialJournalEntries: JournalEntry[] | null = null;

    if (!currentGraph && isSupabaseConfigured) {
      try {
        const draft = await loadRemoteModelingDraft();
        if (draft) {
          initialXml = draft.graphXml;
          initialGraphName = draft.graphName || initGraphName;
          initialJournalEntries =
            draft.journalEntries.length > 0 ? draft.journalEntries : null;

          if (draft.graphId && savedGraphs.has(draft.graphName)) {
            setCurrentGraph(draft.graphName);
            setHasUnsavedGraphChanges(false);
          } else {
            setCurrentGraph(null);
            setHasUnsavedGraphChanges(true);
          }
        }
      } catch (error) {
        console.error(error);
        toast.error(
          persistenceErrorMessage("Unable to restore modeling draft", error),
          persistentErrorToast,
        );
      }
    }

    modeler
      .importXML(initialXml)
      .then(() => {
        setGraphName(initialGraphName);
        if (initialJournalEntries) {
          const uniqueInitialJournalEntries =
            deduplicateJournalEntries(initialJournalEntries);
          syncJournalIdCounter(uniqueInitialJournalEntries);
          setJournalEntries(uniqueInitialJournalEntries);
        } else {
          resetJournal(initialGraphName);
        }
        if (currentGraph) {
          setHasUnsavedGraphChanges(false);
        }
        draftRestoreDoneRef.current = true;
        setDraftStatus(isSupabaseConfigured ? "saved" : "idle");
        fitModelerViewport();
        markDraftDirty();
      })
      .catch((e: Error) => {
        console.log(e);
        toast.error("Unable to import XML...");
        draftRestoreDoneRef.current = true;
        setDraftStatus("error");
      });
  });

  useEffect(() => {
    if (!modeler) {
      return;
    }

    onInitModeler(modeler);
  }, [modeler]);

  useEffect(() => {
    if (!setModelingPersistenceWarning) {
      return;
    }

    let warning: string | null = null;

    if (draftStatus === "saving") {
      warning =
        "Your Modeling draft is still saving. Wait for Draft saved or use Save Graph before signing out. Sign out anyway?";
    } else if (draftStatus === "error") {
      warning =
        "Your latest Modeling draft could not be saved. Use Save Graph or resolve the database error before signing out. Sign out anyway?";
    } else if (hasUnsavedGraphChanges) {
      warning =
        "You have Modeling changes that are not saved as a named graph. Use Save Graph before signing out if you want this graph in Saved Graphs. Sign out anyway?";
    }

    setModelingPersistenceWarning(warning);

    return () => {
      setModelingPersistenceWarning(null);
    };
  }, [draftStatus, hasUnsavedGraphChanges, setModelingPersistenceWarning]);

  const showSidePanel = sidePanelTab === "journal" || selectedElementId !== null;

  return (
    <>
      <GraphNameInput
        aria-label="Graph name"
        value={graphName}
        onChange={(e) => {
          setGraphName(e.target.value);
          markGraphDirty();
        }}
      />
      {(loading || bpmnLoading) && <Loading />}
      <ReactiveModeler
        modeler={modeler}
        setModeler={setModeler}
        coloredRelations={coloredRelations}
        markerNotation={markerNotation}
        isSimulating={false}
        disableControls={false}
        onSelect={updateSelection}
        onImport={() => {
          setSelectedElementId(null);
          modeler?.setFocusFilter(null);
          fitModelerViewport();
          refreshInspector();
          markGraphDirty();
        }}
        onElementChanged={() => {
          refreshInspector();
          markGraphDirty();
        }}
        onConnectionChanged={() => {
          refreshInspector();
          markGraphDirty();
        }}
      />
      <ModelingSidePanel
        activeTab={sidePanelTab}
        details={
          <SelectionInspector
            modeler={modeler}
            selectedElementId={selectedElementId}
            relationVisibility={relationVisibility}
            onToggleRelationType={toggleRelationType}
            refreshKey={inspectorRefreshKey}
            onRefresh={refreshInspector}
          />
        }
        journal={
          <SessionJournal
            entries={journalEntries}
            onAddNote={addFreeFormJournalNote}
            onDeleteEntry={deleteJournalEntry}
            onUpdateNote={updateJournalNote}
          />
        }
        onTabChange={setSidePanelTab}
        show={showSidePanel}
      />
      <TopRightIcons>
        {isSupabaseConfigured && draftRestoreDoneRef.current && (
          <DraftStatus title="Modeling draft autosave status">
            {draftStatus === "saving"
              ? "Saving draft..."
              : draftStatus === "error"
                ? "Draft save failed"
                : "Draft saved"}
          </DraftStatus>
        )}
        <JournalButton
          $clicked={sidePanelTab === "journal"}
          onClick={() => setSidePanelTab("journal")}
          title="Open Session Journal"
          data-testid="journal-icon"
        />
        <HeatmapButton
          onClick={() => {
            if (!modeler) return;
            const elementRegistry = modeler.getElementRegistry();

            if (
              !tdmOpen &&
              Object.keys(elementRegistry._elements).find(
                (element) =>
                  element.includes("SubProcess") ||
                  elementRegistry._elements[element].element.businessObject
                    .role,
              )
            ) {
              toast.warning(
                "Test driven modeling not supported for subprocesses and roles...",
              );
              return;
            }
            setTdmOpen(!tdmOpen);
          }}
          $clicked={tdmOpen}
          title="Open Test Driven Modeling Pane"
          data-testid="heatmap-icon"
        />
        <BiAnalyse
          title="Layout Graph"
          onClick={layout}
          data-testid="analyse-icon"
        />
        <FullScreenIcon data-testid="fullscreen-icon" />
        <BiHome
          onClick={async () => {
            const saved = await saveGraph();
            if (
              !saved &&
              !window.confirm(
                "Graph wasn't saved. Are you sure you wish to exit modeler?",
              )
            ) {
              return;
            }
            setState(StateEnum.Home);
          }}
          data-testid="home-icon"
        />
        <ModalMenu
          elements={menuElements}
          bottomElements={bottomElements}
          open={menuOpen}
          setOpen={setMenuOpen}
        />
      </TopRightIcons>
      <TestDrivenModeling modeler={modeler} show={tdmOpen} />
      {examplesOpen && (
        <Examples
          examplesData={examplesData}
          openCustomXML={(xml, name) => open(xml, modeler?.importCustomXML, name)}
          openDCRXML={(xml, name) => open(xml, modeler?.importDCRPortalXML, name)}
          setExamplesOpen={setExamplesOpen}
          setLoading={setLoading}
        />
      )}
    </>
  );
};

export default ModelerState;
