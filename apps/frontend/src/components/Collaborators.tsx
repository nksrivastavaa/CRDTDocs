import type { CollaboratorPresence } from '@collab/types';

export function Collaborators({ collaborators }: { collaborators: CollaboratorPresence[] }) {
  return (
    <div className="collaborators">
      {collaborators.slice(0, 5).map((collaborator) => (
        <div
          className="collaborator-avatar"
          key={collaborator.userId}
          style={{ backgroundColor: collaborator.color }}
          title={`${collaborator.displayName} is active`}
        >
          {collaborator.displayName.slice(0, 1).toUpperCase()}
        </div>
      ))}
      {collaborators.length > 5 ? <span className="more-collaborators">+{collaborators.length - 5}</span> : null}
    </div>
  );
}
