export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed"
  | "reconnecting";

export type BrokerConnectionState = {
  status: ConnectionStatus;
  clientIdMasked?: string;
  errorMessage?: string;
};
