<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-workspaces-screens — signatures

## @fonderie/react-workspaces-screens

```ts
interface IInviteMembersScreenProps {
    client: WorkspacesClient;
    onNavigateToMembers?: () => void;
}

interface ITeamMembersScreenProps {
    client: WorkspacesClient;
    currentUserId: string;
    onNavigateToInvite?: () => void;
}

function InviteMembersScreen({ client, onNavigateToMembers }: IInviteMembersScreenProps): Element

function TeamMembersScreen({ client, currentUserId, onNavigateToInvite, }: ITeamMembersScreenProps): Element
```
