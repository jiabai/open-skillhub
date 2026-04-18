"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Building2,
  Edit,
  Loader2,
  MoreHorizontal,
  Search,
  Shield,
  UserCircle,
  Users,
  Users as TeamIcon,
} from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import type { User, UserIdentityUpdate } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getDateFnsLocale } from "@/i18n/date-fns"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"
import type { UserStatus } from "@/lib/user-status"
import {
  getUserRoleBadgeVariant,
  getUserRoleLabel,
  getUserStatusLabel,
  USER_STATUS_BADGE_VARIANTS,
} from "@/lib/user-identity-display"

export default function UsersAdminPage() {
  const { success, error: showError } = useToast()
  const { dictionary, locale } = useI18n()
  const { usersAdmin } = dictionary
  const dateLocale = getDateFnsLocale(locale)
  const roleOptions = useMemo(
    () => [
      { value: "admin", label: usersAdmin.roleAdmin },
      { value: "member", label: usersAdmin.roleMember },
      { value: "viewer", label: usersAdmin.roleViewer },
    ],
    [usersAdmin]
  )
  const statusOptions = useMemo(
    () => [
      { value: "active", label: usersAdmin.statusActive },
      { value: "inactive", label: usersAdmin.statusInactive },
      { value: "pending", label: usersAdmin.statusPending },
    ] satisfies Array<{ value: UserStatus; label: string }>,
    [usersAdmin]
  )
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UserIdentityUpdate>({})
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listUsers(searchDebounced)
      setUsers(response.items)
      setTotal(response.total)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [searchDebounced])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user)
    setEditForm({
      enterprise_id: user.enterprise_id,
      team_id: user.team_id,
      role: user.role,
      status: user.status,
    })
    setEditDialogOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingUser) return
    setEditLoading(true)
    try {
      await api.updateUserIdentity(editingUser.id, editForm)
      success(usersAdmin.updateSuccess)
      setEditDialogOpen(false)
      await fetchUsers()
    } catch (err) {
      showError(getErrorMessage(err))
    } finally {
      setEditLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    return <Badge variant={getUserRoleBadgeVariant(role)}>{getUserRoleLabel(role, usersAdmin)}</Badge>
  }

  const getStatusBadge = (status: UserStatus) => {
    return <Badge variant={USER_STATUS_BADGE_VARIANTS[status]}>{getUserStatusLabel(status, usersAdmin)}</Badge>
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground 3xl:h-12 3xl:w-12">
          <Users className="h-5 w-5 3xl:h-6 3xl:w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{usersAdmin.title}</h1>
          <p className="text-sm text-muted-foreground 3xl:text-base">{formatMessage(usersAdmin.summary, { total })}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={usersAdmin.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{usersAdmin.listTitle}</CardTitle>
          <CardDescription>{usersAdmin.listDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchUsers}>
                {usersAdmin.retry}
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{usersAdmin.empty}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{usersAdmin.userColumn}</TableHead>
                    <TableHead>{usersAdmin.roleColumn}</TableHead>
                    <TableHead>{usersAdmin.statusColumn}</TableHead>
                    <TableHead>{usersAdmin.orgTeamColumn}</TableHead>
                    <TableHead>{usersAdmin.createdAtColumn}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {user.is_superuser ? (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="mr-1 h-3 w-3" />
                              {usersAdmin.superuser}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.enterprise_id ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {user.enterprise_id}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {user.team_id ? (
                            <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                              <TeamIcon className="h-3 w-3" />
                              {user.team_id}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {usersAdmin.editIdentity}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{usersAdmin.editDialogTitle}</DialogTitle>
            <DialogDescription>
              {formatMessage(usersAdmin.editDialogDescription, { username: editingUser?.username ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">{usersAdmin.roleLabel}</Label>
              <Select value={editForm.role || ""} onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={usersAdmin.rolePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">{usersAdmin.statusLabel}</Label>
              <Select value={editForm.status || ""} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value as UserStatus }))}>
                <SelectTrigger>
                  <SelectValue placeholder={usersAdmin.statusPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="enterprise_id">{usersAdmin.enterpriseIdLabel}</Label>
              <Input
                id="enterprise_id"
                value={editForm.enterprise_id || ""}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    enterprise_id: event.target.value || null,
                  }))
                }
                placeholder={usersAdmin.enterpriseIdPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team_id">{usersAdmin.teamIdLabel}</Label>
              <Input
                id="team_id"
                value={editForm.team_id || ""}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    team_id: event.target.value || null,
                  }))
                }
                placeholder={usersAdmin.teamIdPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {usersAdmin.cancel}
            </Button>
            <Button onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {usersAdmin.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
