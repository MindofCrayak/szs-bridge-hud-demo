export type AgentCallsign = 'Alfred' | 'Pamela' | 'Oracle' | 'Dolores' | 'Vala' | 'Daisy';

export interface AlfredNodeContext {
  id: string;
  label: string;
  type: 'agent' | 'component' | 'core';
  department: string;
  status: string;
  connectedWireIds: string[];
}

export interface PendingAgentDispatch {
  id: number;
  agent: AgentCallsign;
  prompt: string;
  nodeContext: AlfredNodeContext;
}
