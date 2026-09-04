export interface CenterNetworkHeartbeatRequest {
  centerId: string;
  serverObservedIp: string;
  agentToken: string;
}

export interface CenterNetworkHeartbeatResponse {
  centerId: string;
  observedAt: string;
  status: "ACTIVE";
}

export interface WorkforceNetworkPresenceCoreBinding {
  heartbeat(request: CenterNetworkHeartbeatRequest): Promise<CenterNetworkHeartbeatResponse>;
}

export function callCenterNetworkHeartbeat(
  binding: WorkforceNetworkPresenceCoreBinding,
  request: CenterNetworkHeartbeatRequest,
) {
  return binding.heartbeat(request);
}
