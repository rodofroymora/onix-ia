export { SECTOR_TEMPLATES } from './sectors/index.js';
export type { SectorTemplate } from './sectors/index.js';
export { ACTION_LIBRARY } from './actions/library.js';
export type { ActionTemplate } from './actions/library.js';
export { AI_CATALOG } from './ai-catalog/catalog.js';
export type { AICatalogEntry } from './ai-catalog/catalog.js';
export {
  QUESTIONNAIRE_V1,
  MATURITY_QUESTIONS_V1,
  CASE_QUESTIONS_V1,
  maturityForRoute,
} from './questionnaire/v1.js';
export type { MaturityQuestion, CaseQuestion, DimKey } from './questionnaire/v1.js';
export {
  FUNCTIONS,
  functionName,
  dimsForFunctions,
  TECH_ECOSYSTEMS,
  TECH_RINGS,
} from './functions.js';
export type { FunctionKey, FunctionDef, TechEcosystem, TechRing, TechItem } from './functions.js';
export {
  AI_TYPES,
  VALUE_TYPES,
  STRATEGIC_OBJECTIVES,
  DATA_CLASSES,
  DEPLOYMENTS,
  USER_SCOPES,
  BUSINESS_AREAS,
  AGENT_PLATFORMS,
  AGENT_CHANNELS,
  AGENT_PUBLISHERS,
  AGENT_STATUSES,
  TOOL_SUGGESTIONS,
  VENDOR_SUGGESTIONS,
  DIMENSION_INTROS,
  catalogName,
  inCatalog,
} from './catalogs.js';
export type { CatalogOption } from './catalogs.js';
