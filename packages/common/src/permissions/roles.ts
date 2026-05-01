import type { DocumentRole } from '@collab/types';

export const DOCUMENT_ROLE_WEIGHT: Record<DocumentRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function hasDocumentRole(actual: DocumentRole | null | undefined, required: DocumentRole): boolean {
  if (!actual) {
    return false;
  }

  return DOCUMENT_ROLE_WEIGHT[actual] >= DOCUMENT_ROLE_WEIGHT[required];
}

export function maxDocumentRole(roles: Array<DocumentRole | null | undefined>): DocumentRole | null {
  return roles.reduce<DocumentRole | null>((best, role) => {
    if (!role) {
      return best;
    }

    if (!best || DOCUMENT_ROLE_WEIGHT[role] > DOCUMENT_ROLE_WEIGHT[best]) {
      return role;
    }

    return best;
  }, null);
}
