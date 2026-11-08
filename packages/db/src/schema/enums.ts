import { pgEnum } from 'drizzle-orm/pg-core';

export const membershipRoleEnum = pgEnum('membership_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const assessmentStatusEnum = pgEnum('assessment_status', [
  'draft',
  'in_progress',
  'completed',
  'archived',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const evidenceStatusEnum = pgEnum('evidence_status', [
  'none',
  'pending',
  'approved',
  'rejected',
]);

export const actionProgressEnum = pgEnum('action_progress', [
  '0',
  '25',
  '50',
  '75',
  '100',
]);

export const stageNameEnum = pgEnum('stage_name', [
  'Bases',
  'Controles',
  'Mejora continua',
]);

export const extendedRiskEnum = pgEnum('extended_risk', [
  'Bajo',
  'Medio',
  'Alto',
  'Inaceptable',
]);

export const dimensionKeyEnum = pgEnum('dimension_key', [
  'est',
  'rol',
  'dat',
  'rie',
  'seg',
  'per',
]);
