import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { UserPlus, Pencil, Trash2, Users } from 'lucide-react'

export interface UserAccount {
  id: string
  name: string
  enabled: boolean
  mtime?: number
}

interface UserAccountsSectionProps {
  users: UserAccount[]
  onAdd: () => void
  onEdit: (user: UserAccount) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

export function UserAccountsSection({
  users,
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
}: UserAccountsSectionProps) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '–'
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <SettingsSection
      id="user-accounts"
      title="User Accounts"
      description="Manage user accounts for authentication"
    >
      <div className="space-y-4">
        {/* Add Button */}
        <div className="flex justify-between items-center">
          <Button onClick={onAdd} className="gap-2">
            <UserPlus className="w-4 h-4" />
            New Account
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Enabled</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No user accounts configured</p>
                    <p className="text-xs mt-1">Authentication is disabled when no accounts exist</p>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Switch
                        checked={user.enabled}
                        onCheckedChange={(checked) => onToggleEnabled(user.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.mtime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the account "{user.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(user.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </SettingsSection>
  )
}

