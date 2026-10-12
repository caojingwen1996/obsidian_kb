/* Generated from contracts/commands.json. Do not edit. */
export interface ReferenceSaveInput {
  kind: string;
  data: {
    [k: string]: unknown;
  };
  id?: string;
  expected_version?: number;
  reason?: string;
}
export interface ReferenceApproveInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface ReferenceDisableInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface ReferenceResolveVariableInput {
  id: string;
  expected_version: number;
  decision: string;
  reason: string;
  target_id?: string;
  data?: {
    [k: string]: unknown;
  };
}
export interface ObservationsIndicatorInput {
  data: {
    [k: string]: unknown;
  };
}
export interface ObservationsMappingInput {
  data: {
    [k: string]: unknown;
  };
}
export interface ObservationsImportInput {
  rows: {
    [k: string]: unknown;
  }[];
}
export interface InformationSourceInput {
  data: {
    [k: string]: unknown;
  };
}
export interface InformationSourceStatusInput {
  id: string;
  expected_version: number;
  status: string;
  reason: string;
}
export interface InformationIngestInput {
  source_id: string;
  url: string;
  content: string;
  published_at: string | null;
}
export interface InformationExtractInput {
  information_id: string;
}
export interface InformationEventInput {
  data: {
    [k: string]: unknown;
  };
  task_id?: string;
}
export interface InformationCorrectInput {
  id: string;
  expected_version: number;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface InformationRateInput {
  event_id: string;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface InformationGroupingInput {
  id: string;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface RegistryIdentifyInput {
  event_id: string;
  event_update_id?: string;
  reason?: string;
}
export interface RegistryCandidateInput {
  data: {
    [k: string]: unknown;
  };
  task_id?: string;
}
export interface RegistryMatchInput {
  id: string;
  expected_version: number;
  decision: string;
  reason: string;
  target_id?: string;
}
export interface RegistryAdmitInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface RegistryReviseInput {
  id: string;
  expected_version: number;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface RegistryRelateInput {
  risk_id: string;
  event_id: string;
  reason: string;
  event_update_id?: string;
}
export interface RegistryTrackingInput {
  id: string;
  expected_version: number;
  status: string;
  reason: string;
}
export interface AnalysisStartInput {
  risk_id: string;
  snapshot_time: string;
  comparison_snapshot_id?: string;
  reason?: string;
  hindsight?: boolean;
  allow_inactive?: boolean;
}
export interface AnalysisDraftInput {
  task_id: string;
  data: {
    [k: string]: unknown;
  };
  id?: string;
  expected_version?: number;
}
export interface AnalysisSubmitInput {
  id: string;
  expected_version: number;
}
export interface AnalysisApproveInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface AnalysisWithdrawInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface AnalysisReviseInput {
  id: string;
  reason: string;
}
export interface AnalysisFeedbackInput {
  risk_id: string;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface PublicationGenerateInput {
  type: "daily" | "weekly" | "monthly";
  period_start: string;
  period_end: string;
  cutoff: string;
  scope?: string;
}
export interface PublicationEditInput {
  id: string;
  expected_version: number;
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface PublicationSubmitInput {
  id: string;
  expected_version: number;
}
export interface PublicationPublishInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface PublicationWithdrawInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface PublicationReviseInput {
  id: string;
  reason: string;
}
export interface OperationsCancelInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface OperationsRetryInput {
  id: string;
  expected_version: number;
  reason: string;
}
export interface OperationsRecomputeInput {
  id: string;
  reason: string;
}
export interface OperationsAssignInput {
  data: {
    [k: string]: unknown;
  };
}
export interface OperationsReviewInput {
  data: {
    [k: string]: unknown;
  };
  reason: string;
}
export interface OperationsScheduleInput {
  data: {
    [k: string]: unknown;
  };
  id?: string;
  expected_version?: number;
}
export interface OperationsScheduleStatusInput {
  id: string;
  expected_version: number;
  enabled: boolean;
}
export interface OperationsScheduleRunInput {
  id: string;
  run_key: string;
}
export interface OperationsIssueInput {
  id: string;
  expected_version: number;
  decision: string;
  reason: string;
}
export interface OperationsFeedbackInput {
  id: string;
  expected_version: number;
  status: string;
  reason: string;
}
export interface IdentityUserInput {
  data: {
    [k: string]: unknown;
  };
  id?: string;
  expected_version?: number;
  password?: string;
}

export interface CommandInputs {
  'reference.save': ReferenceSaveInput;
  'reference.approve': ReferenceApproveInput;
  'reference.disable': ReferenceDisableInput;
  'reference.resolve_variable': ReferenceResolveVariableInput;
  'observations.indicator': ObservationsIndicatorInput;
  'observations.mapping': ObservationsMappingInput;
  'observations.import': ObservationsImportInput;
  'information.source': InformationSourceInput;
  'information.source_status': InformationSourceStatusInput;
  'information.ingest': InformationIngestInput;
  'information.extract': InformationExtractInput;
  'information.event': InformationEventInput;
  'information.correct': InformationCorrectInput;
  'information.rate': InformationRateInput;
  'information.grouping': InformationGroupingInput;
  'registry.identify': RegistryIdentifyInput;
  'registry.candidate': RegistryCandidateInput;
  'registry.match': RegistryMatchInput;
  'registry.admit': RegistryAdmitInput;
  'registry.revise': RegistryReviseInput;
  'registry.relate': RegistryRelateInput;
  'registry.tracking': RegistryTrackingInput;
  'analysis.start': AnalysisStartInput;
  'analysis.draft': AnalysisDraftInput;
  'analysis.submit': AnalysisSubmitInput;
  'analysis.approve': AnalysisApproveInput;
  'analysis.withdraw': AnalysisWithdrawInput;
  'analysis.revise': AnalysisReviseInput;
  'analysis.feedback': AnalysisFeedbackInput;
  'publication.generate': PublicationGenerateInput;
  'publication.edit': PublicationEditInput;
  'publication.submit': PublicationSubmitInput;
  'publication.publish': PublicationPublishInput;
  'publication.withdraw': PublicationWithdrawInput;
  'publication.revise': PublicationReviseInput;
  'operations.cancel': OperationsCancelInput;
  'operations.retry': OperationsRetryInput;
  'operations.recompute': OperationsRecomputeInput;
  'operations.assign': OperationsAssignInput;
  'operations.review': OperationsReviewInput;
  'operations.schedule': OperationsScheduleInput;
  'operations.schedule_status': OperationsScheduleStatusInput;
  'operations.schedule_run': OperationsScheduleRunInput;
  'operations.issue': OperationsIssueInput;
  'operations.feedback': OperationsFeedbackInput;
  'identity.user': IdentityUserInput;
}
export type CommandName = keyof CommandInputs;
