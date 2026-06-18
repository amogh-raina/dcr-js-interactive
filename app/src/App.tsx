import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "react-toastify";
import styled from "styled-components";
import ModelerState from "./components/ModelerState";
import HomeState from "./components/HomeState";
import SimulatorState from "./components/SimulatorState";
import ConformanceCheckingState from "./components/ConformanceCheckingState";
import type { EventLog, RoleTrace } from "dcr-engine";
import DiscoveryState from "./components/DiscoveryState";
import EventLogGenerationState from "./components/EventLogGenerationState";
import AuthGate from "./components/AuthGate";
import AuthStatus from "./components/AuthStatus";
import {
  isColoredRelations,
  isMarkerNotation,
  type ColoredRelations,
  type MarkerNotation,
} from "./types";
import {
  isSupabaseConfigured,
  supabase,
} from "./supabase/client";
import { loadRemoteGraphs, saveRemoteGraph } from "./supabase/graphs";
import { persistenceErrorMessage } from "./supabase/errors";

const MainLandmark = styled.main`
  min-height: 100vh;
  width: 100%;
`;

export const StateEnum = {
  Modeler: "Modeler",
  Home: "Home",
  Simulator: "Simulator",
  Conformance: "Conformance",
  Discovery: "Discovery",
  EventLogGeneration: "EventLogGeneration",
} as const;

export type StateEnum = (typeof StateEnum)[keyof typeof StateEnum];

export interface DCRGraphEntry {
  id?: string;
  name: string;
  graph: string;
}

export interface EventLogEntry {
  name: string;
  log: EventLog<RoleTrace>;
}

export type DCRGraphRepository = Map<string, DCRGraphEntry>;

export type EventLogRepository = Map<string, EventLogEntry>;

export interface StateProps {
  setState: (state: StateEnum) => void;
  savedGraphs: DCRGraphRepository;
  setSavedGraphs: React.Dispatch<React.SetStateAction<DCRGraphRepository>>;
  savedLogs: EventLogRepository;
  setSavedLogs: React.Dispatch<React.SetStateAction<EventLogRepository>>;
  currentGraph: DCRGraphEntry | null;
  setCurrentGraph: (graphName: string | null) => void;
  currentLog: EventLogEntry | null;
  setCurrentLog: (logName: string | null) => void;
  saveGraph: (name: string, graph: string) => Promise<DCRGraphEntry | null>;
  saveLog: (name: string, log: EventLog<RoleTrace>) => boolean;
  pickGraph: (name?: string | null) => void;
  pickLog: (name?: string | null) => void;
  markerNotation: MarkerNotation;
  changeMarkerNotation: (value: unknown) => void;
  coloredRelations: ColoredRelations;
  changeColoredRelations: (value: unknown) => void;
  setModelingPersistenceWarning?: (warning: string | null) => void;
}

const App = () => {
  const [state, setState] = useState<StateEnum>(StateEnum.Home);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [modelingPersistenceWarning, setModelingPersistenceWarning] =
    useState<string | null>(null);

  const [markerNotation, setMarkerNotation] =
    useState<MarkerNotation>("TAL2023");

  const [coloredRelations, setColoredRelations] =
    useState<ColoredRelations>(true);

  const [graphs, setGraphs] = useState<DCRGraphRepository>(new Map());
  const [logs, setLogs] = useState<EventLogRepository>(new Map());

  const [currentGraphName, setCurrentGraphName] = useState<string | null>(null);
  const [currentLogName, setCurrentLogName] = useState<string | null>(null);

  const currentGraph = useMemo(() => {
    if (currentGraphName === null) {
      return null;
    }

    return graphs.get(currentGraphName) ?? null;
  }, [graphs, currentGraphName]);

  const currentLog = useMemo(() => {
    if (currentLogName === null) {
      return null;
    }

    return logs.get(currentLogName) ?? null;
  }, [logs, currentLogName]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const client = supabase;

    const acceptSession = (session: Session | null) => {
      setAuthSession(session);

      if (!session) {
        setGraphs(new Map());
        setCurrentGraphName(null);
      }
    };

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        acceptSession(data.session);
      })
      .catch((error) => {
        console.error(error);
        toast.error("Unable to check Supabase session.");
      })
      .finally(() => setAuthLoading(false));

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      acceptSession(session);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state !== StateEnum.Modeler) {
      setModelingPersistenceWarning(null);
    }
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession) {
      return;
    }

    let active = true;
    setGraphsLoading(true);

    loadRemoteGraphs()
      .then((repository) => {
        if (!active) {
          return;
        }

        setGraphs(repository);
        setCurrentGraphName((current) =>
          current && repository.has(current) ? current : null,
        );
      })
      .catch((error) => {
        console.error(error);
        toast.error(persistenceErrorMessage("Unable to load saved graphs", error), {
          autoClose: false,
          closeOnClick: true,
        });
      })
      .finally(() => {
        if (active) {
          setGraphsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authSession]);

  const saveGraph = useCallback(
    async (name: string, graph: string) => {
      const canSave =
        !graphs.has(name) ||
        name === currentGraphName ||
        window.confirm("Overwrite existing graph?");

      if (!canSave) {
        return null;
      }

      try {
        const graphEntry =
          isSupabaseConfigured && authSession
            ? await saveRemoteGraph(authSession.user.id, name, graph)
            : { name, graph };

        setGraphs((prev) => {
          const newMap = new Map(prev);
          newMap.set(name, graphEntry);
          return newMap;
        });
        setCurrentGraphName(name);
        return graphEntry;
      } catch (error) {
        console.error(error);
        toast.error(persistenceErrorMessage("Unable to save graph", error), {
          autoClose: false,
          closeOnClick: true,
        });
        return null;
      }
    },
    [authSession, graphs, currentGraphName],
  );

  const saveLog = useCallback(
    (name: string, log: EventLog<RoleTrace>) => {
      if (
        !logs.has(name) ||
        name === currentLogName ||
        window.confirm("Overwrite existing log?")
      ) {
        setLogs((prev) => {
          const newMap = new Map(prev);
          newMap.set(name, { name, log });
          return newMap;
        });
        setCurrentLogName(name);
        return true;
      }
      return false;
    },
    [logs, currentLogName],
  );

  const pickGraph = useCallback(
    (name: string | null = null) => {
      if (name && !graphs.has(name)) {
        window.alert("Graph not found!");
        return;
      }
      setCurrentGraphName(name);
    },
    [graphs],
  );

  const pickLog = useCallback(
    (name: string | null = null) => {
      if (name && !logs.has(name)) {
        window.alert("Log not found!");
        return;
      }
      setCurrentLogName(name);
    },
    [logs],
  );

  const changeMarkerNotation = useCallback((value: unknown) => {
    if (isMarkerNotation(value)) {
      setMarkerNotation(value);
    }
  }, []);

  const signOut = useCallback(() => {
    const message =
      modelingPersistenceWarning ??
      "Sign out? Make sure your latest graph changes are saved before leaving.";

    if (!window.confirm(message)) {
      return;
    }

    void supabase?.auth.signOut();
  }, [modelingPersistenceWarning]);

  const changeColoredRelations = useCallback((value: unknown) => {
    if (isColoredRelations(value)) {
      setColoredRelations(value);
    }
  }, []);

  if (isSupabaseConfigured && authLoading) {
    return <MainLandmark aria-busy="true">Checking sign in...</MainLandmark>;
  }

  if (isSupabaseConfigured && !authSession) {
    return <AuthGate />;
  }

  if (isSupabaseConfigured && graphsLoading) {
    return <MainLandmark aria-busy="true">Loading saved graphs...</MainLandmark>;
  }

  const stateContent = (() => {
    switch (state) {
    case StateEnum.Modeler:
      return (
        <ModelerState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
          setModelingPersistenceWarning={setModelingPersistenceWarning}
        />
      );
    case StateEnum.Home:
      return (
        <HomeState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      );
    case StateEnum.Simulator:
      return (
        <SimulatorState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      );
    case StateEnum.Conformance:
      return (
        <ConformanceCheckingState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      );
    case StateEnum.Discovery:
      return (
        <DiscoveryState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      );
    case StateEnum.EventLogGeneration:
      return (
        <EventLogGenerationState
          savedLogs={logs}
          setSavedLogs={setLogs}
          savedGraphs={graphs}
          setSavedGraphs={setGraphs}
          setState={setState}
          currentGraph={currentGraph}
          currentLog={currentLog}
          setCurrentGraph={setCurrentGraphName}
          setCurrentLog={setCurrentLogName}
          saveGraph={saveGraph}
          saveLog={saveLog}
          pickGraph={pickGraph}
          pickLog={pickLog}
          markerNotation={markerNotation}
          changeMarkerNotation={changeMarkerNotation}
          coloredRelations={coloredRelations}
          changeColoredRelations={changeColoredRelations}
        />
      );
    }
  })();

  return (
    <>
      {isSupabaseConfigured && authSession && (
        <AuthStatus
          email={authSession.user.email ?? "Signed in"}
          onSignOut={signOut}
        />
      )}
      <MainLandmark>{stateContent}</MainLandmark>
    </>
  );
};

export default App;
