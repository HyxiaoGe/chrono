// --- Backend API types (mirrors Pydantic models) ---

export interface ResearchProposal {
  topic: string;
  topic_type: "product" | "technology" | "culture" | "historical_event";
  language: string;
  complexity: {
    level: "light" | "medium" | "deep" | "epic";
    time_span: string;
    parallel_threads: number;
    estimated_total_nodes: number;
    reasoning: string;
  };
  research_threads: {
    name: string;
    description: string;
    priority: number;
    estimated_nodes: number;
  }[];
  estimated_duration: {
    min_seconds: number;
    max_seconds: number;
  };
  credits_cost: number;
  user_facing: {
    title: string;
    summary: string;
    duration_text: string;
    credits_text: string;
    thread_names: string[];
  };
}

export interface ResearchProposalResponse {
  session_id: string;
  proposal: ResearchProposal;
}

// --- SSE event data types ---

export interface ProgressData {
  phase: string;
  message: string;
  percent: number;
}

export interface SkeletonNodeData {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: "skeleton";
  phase_name?: string;
}

export interface NodeDetailData {
  key_features: string[];
  impact: string;
  key_people: string[];
  context: string;
  sources: string[];
}

export interface NodeDetailEvent {
  node_id: string;
  details: NodeDetailData;
}

export interface TimelineConnection {
  from_id: string;
  to_id: string;
  relationship: string;
  type: "caused" | "enabled" | "inspired" | "responded_to";
}

export interface DateCorrection {
  node_id: string;
  original_date: string;
  corrected_date: string;
  reason: string;
}

export interface SynthesisData {
  summary: string;
  key_insight: string;
  timeline_span: string;
  source_count: number;
  verification_notes: string[];
  connections?: TimelineConnection[];
  date_corrections?: DateCorrection[];
}

export interface CompleteData {
  total_nodes: number;
  detail_completed: number;
}

// --- Frontend state types ---

export type NodeStatus = "skeleton" | "loading" | "complete";

export interface TimelineNode {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: NodeStatus;
  details?: NodeDetailData;
  phase_name?: string;
}

export type AppPhase = "input" | "proposal" | "research";

export interface ResearchSummary {
  id: string;
  topic: string;
  topic_type: string;
  language: string;
  complexity_level: string;
  total_nodes: number;
  source_count: number;
  created_at: string;
}

