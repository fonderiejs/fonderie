<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-workspaces-screens — signatures

## @fonderie/react-workspaces-screens

```ts
interface IAcceptInvitationScreenProps {
    client?: WorkspacesClient;
    token: string;
    onAccepted?: (workspaceId: string) => void;
    onNavigateBack?: () => void;
    locale?: string;
}

interface IInviteMembersScreenProps {
    client?: WorkspacesClient;
    onNavigateToMembers?: () => void;
    locale?: string;
}

interface ITeamMembersScreenProps {
    client?: WorkspacesClient;
    currentUserId: string;
    onNavigateToInvite?: () => void;
    locale?: string;
}

function AcceptInvitationScreen({ client, token, onAccepted, onNavigateBack, locale, }: IAcceptInvitationScreenProps): Element

function InviteMembersScreen({ client, onNavigateToMembers, locale, }: IInviteMembersScreenProps): Element

function TeamMembersScreen({ client, currentUserId, onNavigateToInvite, locale, }: ITeamMembersScreenProps): Element
```
