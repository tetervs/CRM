const CHDD = ['Case intake', 'Allocation', "Client's SOW briefing", 'Case proposal', 'Pre-requisite document search',
  'OSINT research', 'Discreet calling', 'Report writing', 'Report review and QC', 'Final review', 'Client feedback', 'Closed']

const PHASE_STAGES = {
  'Intake and scoping': ['Case intake', 'Allocation', "Client's SOW briefing", 'Case proposal', 'Client briefing',
    'SOW/proposal', 'SOW writing', 'SOW review'],
  'Research and fieldwork': ['Pre-requisite document search', 'OSINT research', 'Discreet calling', 'OSINT', 'Fieldwork',
    'Research', 'Checklist (parameters)', 'Site visit', 'Document gathering', 'Recon/pre-checks', 'Assignment'],
  'Writing': ['Report writing', 'Draft 1', 'Draft 2'],
  'Review and QC': ['Report review and QC', 'Final review', 'QC', 'Review/QC', 'Review and feedback', 'Review'],
  'Client feedback': ['Client feedback', 'Risk report and feedback'],
  'Closed': ['Closed'],
}

module.exports = {
  dueSoonDays: 3,
  staleDays: 7,
  phases: Object.keys(PHASE_STAGES),
  stagePhase: Object.entries(PHASE_STAGES).flatMap(([phase, stages]) => stages.map((stage) => ({ stage, phase }))),
  caseTypes: [
    { code: 'CHDD/SMDD', name: 'Critical / Senior Hire Due Diligence', stages: CHDD },
    { code: 'VDD/TPDD', name: 'Vendor / Third Party Due Diligence', stages: CHDD },
    { code: 'DDD', name: 'Dulha Dulhan Due Diligence', stages: ['Case intake', 'Allocation', 'Client briefing',
      'Pre-requisite document search', 'OSINT', 'Fieldwork', 'Report writing', 'QC', 'Final review', 'Client feedback', 'Closed'] },
    { code: 'Corporate investigation', name: 'Corporate investigation', stages: ['Case intake', 'Allocation',
      "Client's SOW briefing", 'Case proposal', 'Pre-requisite document search', 'OSINT research', 'Discreet calling',
      'Fieldwork', 'Report writing', 'Report review and QC', 'Final review', 'Client feedback', 'Closed'] },
    { code: 'SRA/TVRA', name: 'Security Risk Analysis, incl. CCTV blind spot analysis', stages: ['Case intake', 'Allocation',
      'SOW/proposal', 'Research', 'Checklist (parameters)', 'Site visit', 'Document gathering', 'Report writing',
      'Review/QC', 'Client feedback', 'Closed'] },
    { code: 'EP', name: 'Executive Protection', stages: ['Case intake', 'Allocation', 'SOW writing', 'SOW review',
      'Recon/pre-checks', 'Assignment', 'Risk report and feedback', 'Closed'] },
    { code: 'SOPs', name: 'SOPs', stages: ['Client briefing', 'Research', 'Draft 1', 'Review and feedback', 'Draft 2', 'QC',
      'Final review', 'Client feedback', 'Closed'] },
    { code: 'QC (direct)', name: 'One-off quality checks', stages: ['Review', 'Final review', 'Client feedback', 'Closed'] },
  ],
}
