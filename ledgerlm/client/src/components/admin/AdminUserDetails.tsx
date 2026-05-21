import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  MoreHorizontal, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Users,
  UserPlus,
  Key,
  Trash2,
  Edit,
  Shield,
  UserCheck
} from 'lucide-react';

interface AdminUserDetailsProps {
  domainId: string;
  domain?: {
    name: string;
    userCount: number;
    userQuota?: number | null;
  };
  onInviteUser: () => void;
}

interface DomainUser {
  id: string;
  domainId: string;
  email: string;
  role: string;
  hardcodedOtp: string | null;
  createdAt: string;
  status?: string;
  lastActive?: string;
  licenseType?: string;
  group?: string;
}

export default function AdminUserDetails({ domainId, domain, onInviteUser }: AdminUserDetailsProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('standard');
  const [newUserLicense, setNewUserLicense] = useState('basic');

  const { data: users = [], isLoading } = useQuery<DomainUser[]>({
    queryKey: ['/api/domain-admin/users', domainId],
    enabled: !!domainId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      return apiRequest(`/api/domain-admin/users/${domainId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users', domainId] });
      toast({ title: 'Invitation sent', description: 'User has been invited to join.' });
      setIsInviteDialogOpen(false);
      setNewUserEmail('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/domain-admin/users/${domainId}/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users', domainId] });
      toast({ title: 'User removed', description: 'User has been removed from the domain.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = filteredUsers.filter(u => u.status !== 'pending');
  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');

  const seatsUsed = domain?.userCount || users.length;
  const seatsTotal = domain?.userQuota || 50;

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = (userList: DomainUser[]) => {
    if (selectedUsers.length === userList.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(userList.map(u => u.id));
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'inactive') {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      operator: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      analyst: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      standard: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    };
    return <Badge className={roleColors[role] || roleColors.standard}>{role}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="metric-seats">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Seats Used/Total</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{seatsUsed}/{seatsTotal}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+8.5%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-new-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">New Users</span>
              <button 
                className="text-xs text-primary hover:underline"
                onClick={() => setIsInviteDialogOpen(true)}
                data-testid="link-invite-user"
              >
                Invite User
              </button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+8.5%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="metric-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Licenses</span>
              <button className="text-xs text-primary hover:underline" data-testid="link-assign-license">
                Assign License
              </button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-red-500">-8.5%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table with Tabs */}
      <Card>
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all-users">
                All Users ({activeUsers.length})
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending-invites">
                Pending Invites ({pendingUsers.length})
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-users"
                />
              </div>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="all" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedUsers.length === activeUsers.length && activeUsers.length > 0}
                      onCheckedChange={() => toggleAllUsers(activeUsers)}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>User Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  activeUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{getInitials(user.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.email.split('@')[0]}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-muted-foreground">{user.group || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Key className="h-3 w-3" />
                          {user.licenseType || 'Basic'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.lastActive || 'Recently'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`menu-user-${user.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Key className="h-4 w-4 mr-2" />
                              Assign License
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Users className="h-4 w-4 mr-2" />
                              Add to Group
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Shield className="h-4 w-4 mr-2" />
                              Disable User
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="pending" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox />
                  </TableHead>
                  <TableHead>User Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No pending invites
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-pending-${user.id}`}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 opacity-50">
                            <AvatarFallback className="text-xs">{getInitials(user.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm text-muted-foreground">{user.email.split('@')[0]}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-muted-foreground">{user.group || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Key className="h-3 w-3" />
                          {user.licenseType || 'Basic'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Approve Invite
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Invite
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent data-testid="dialog-invite-user">
          <DialogHeader>
            <DialogTitle>Invite Users to your team</DialogTitle>
            <DialogDescription>
              An invite link will be sent to the entered email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@company.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="w-40">
                <Label>License</Label>
                <Select value={newUserLicense} onValueChange={setNewUserLicense}>
                  <SelectTrigger data-testid="select-license-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {seatsUsed}/{seatsTotal} team seats used
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => inviteMutation.mutate({ email: newUserEmail, role: newUserRole })}
              disabled={!newUserEmail || inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
