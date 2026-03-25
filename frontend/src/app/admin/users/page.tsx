"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  Users,
  Loader2,
  Search,
  MoreHorizontal,
  Shield,
  Building2,
  Users as TeamIcon,
  UserCircle,
  Edit,
} from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import type { User, UserIdentityUpdate } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

const roleOptions = [
  { value: "admin", label: "管理员" },
  { value: "member", label: "成员" },
  { value: "viewer", label: "只读" },
]

const statusOptions = [
  { value: "active", label: "正常" },
  { value: "inactive", label: "停用" },
  { value: "pending", label: "待审核" },
]

export default function UsersAdminPage() {
  const { success, error: showError } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")

  // 编辑用户身份对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UserIdentityUpdate>({})
  const [editLoading, setEditLoading] = useState(false)

  // 防抖搜索
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
      success("用户身份已更新")
      setEditDialogOpen(false)
      await fetchUsers()
    } catch (err) {
      showError(getErrorMessage(err))
    } finally {
      setEditLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const variant = role === "admin" ? "default" : role === "member" ? "secondary" : "outline"
    return (
      <Badge variant={variant}>
        {roleOptions.find((r) => r.value === role)?.label || role}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const variant =
      status === "active" ? "default" : status === "inactive" ? "destructive" : "secondary"
    return (
      <Badge variant={variant}>
        {statusOptions.find((s) => s.value === status)?.label || status}
      </Badge>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">用户管理</h1>
          <p className="text-sm text-muted-foreground">
            管理用户身份信息，共 {total} 个用户
          </p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索用户名或邮箱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>查看和管理系统中的所有用户</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchUsers}>
                重试
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>暂无用户数据</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>企业 / 团队</TableHead>
                    <TableHead>创建时间</TableHead>
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
                          {user.is_superuser && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              超管
                            </Badge>
                          )}
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
                          {user.team_id && (
                            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                              <TeamIcon className="h-3 w-3" />
                              {user.team_id}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), {
                          addSuffix: true,
                          locale: zhCN,
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
                              <Edit className="h-4 w-4 mr-2" />
                              编辑身份
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

      {/* 编辑用户身份对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户身份</DialogTitle>
            <DialogDescription>
              更新 {editingUser?.username} 的身份信息
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">角色</Label>
              <Select
                value={editForm.role || ""}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
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
              <Label htmlFor="status">状态</Label>
              <Select
                value={editForm.status || ""}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
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
              <Label htmlFor="enterprise_id">企业 ID</Label>
              <Input
                id="enterprise_id"
                value={editForm.enterprise_id || ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    enterprise_id: e.target.value || null,
                  }))
                }
                placeholder="输入企业 ID（可选）"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team_id">团队 ID</Label>
              <Input
                id="team_id"
                value={editForm.team_id || ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    team_id: e.target.value || null,
                  }))
                }
                placeholder="输入团队 ID（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}