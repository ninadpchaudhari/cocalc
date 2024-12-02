import type {
  State,
  AutomaticShutdown,
} from "@cocalc/util/db-schema/compute-servers";

interface Event {
  event: "compute-server";
  server_id: number;
}

interface StateChange {
  action: "state";
  state: State;
}

interface ConfigurationChange {
  action: "configuration";
  changes: { [param: string]: { from: any; to: any } };
}

export interface AutomaticShutdownEntry {
  action: "automatic-shutdown";
  automatic_shutdown: AutomaticShutdown;
}

interface Error {
  action: "error";
  error: string;
}

export type ComputeServerEvent = (
  | ConfigurationChange
  | StateChange
  | Error
  | AutomaticShutdownEntry
) &
  Event;

export type ComputeServerEventLogEntry =
  | ConfigurationChange
  | StateChange
  | AutomaticShutdownEntry
  | Error;
