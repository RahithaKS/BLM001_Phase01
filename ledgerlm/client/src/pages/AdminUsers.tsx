import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuthUser } from '@/lib/auth';
import { Trash2, UserPlus, Key, Edit, Globe, Shield, CheckCircle } from 'lucide-react';

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: {
    id: string;
    name: string;
    adminEmail: string;
    defaultOtp: string | null;
    userCount: number;
    userQuota?: number | null;
  };
  domains?: Array<{
    id: string;
    name: string;
    adminEmail: string;
    defaultOtp: string | null;
    userQuota?: number | null;
  }>;
}

interface DomainUser {
  id: string;
  domainId: string;
  email: string;
  role: string;
  hardcodedOtp: string | null;
  createdAt: string;
}

export default function AdminUsers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DomainUser | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [newUser, setNewUser] = useState({ email: '', role: 'standard', hardcodedOtp: '' });
  const [editUser, setEditUser] = useState({ role: 'standard', hardcodedOtp: '' });
  const { toast } = useToast();
  const currentUser = useAuthUser();

  const isSuperAdmin = currentUser?.username?.toLowerCase() === 'customer@ledgerlm.ai';

  const { data: domainInfo, isLoading: domainLoading } = useQuery<DomainInfo>({
    queryKey: ['/api/domain-admin/my-domain'],
  });

  const currentDomainId = isSuperAdmin 
    ? selectedDomainId 
    : domainInfo?.domain?.id || '';

  const currentDomain = isSuperAdmin
    ? domainInfo?.domains?.find(d => d.id === selectedDomainId)
    : domainInfo?.domain;

  const { data: users = [], isLoading: usersLoading } = useQuery<DomainUser[]>({
    queryKey: ['/api/domain-admin/users', currentDomainId],
    queryFn: async () => {
      const url = isSuperAdmin 
        ? `/api/domain-admin/users?domainId=${currentDomainId}`
        : '/api/domain-admin/users';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!currentDomainId,
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      return apiRequest('POST', '/api/domain-admin/users', {
        email: data.email,
        role: data.role,
        hardcodedOtp: data.hardcodedOtp || null,
        domainId: isSuperAdmin ? selectedDomainId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/my-domain'] });
      setIsAddDialogOpen(false);
      setNewUser({ email: '', role: 'standard', hardcodedOtp: '' });
      toast({ title: 'User added successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editUser }) => {
      return apiRequest('PUT', `/api/domain-admin/users/${id}`, {
        role: data.role,
        hardcodedOtp: data.hardcodedOtp || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({ title: 'User updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/domain-admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/my-domain'] });
      toast({ title: 'User removed successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.email) {
      addUserMutation.mutate(newUser);
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data: editUser });
    }
  };

  const openEditDialog = (user: DomainUser) => {
    setSelectedUser(user);
    setEditUser({ role: user.role, hardcodedOtp: user.hardcodedOtp || '' });
    setIsEditDialogOpen(true);
  };

  if (domainLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-primary/10">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isSuperAdmin && !domainInfo?.domain) {
    return (
      <div className="h-full flex items-center justify-center bg-primary/10">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You are not a domain administrator. Contact your administrator to get access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-page-title">
                User Management
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-page-description">
                {isSuperAdmin 
                  ? 'Select a domain and manage its users' 
                  : `Manage users in ${domainInfo?.domain?.name}`}
              </p>
            </div>
            {currentDomainId && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-invite-user">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                    <DialogDescription>
                      Add a user to {currentDomain?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-email">Email Address</Label>
                      <Input
                        id="user-email"
                        type="email"
                        placeholder={`user@${currentDomain?.name || 'domain.com'}`}
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                        data-testid="input-invite-email"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email must match the domain: @{currentDomain?.name}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-role">Role</Label>
                      <Select 
                        value={newUser.role} 
                        onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard User</SelectItem>
                          <SelectItem value="admin">Domain Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-otp">Hardcoded OTP (optional)</Label>
                      <Input
                        id="user-otp"
                        placeholder="6-digit code"
                        value={newUser.hardcodedOtp}
                        onChange={(e) => setNewUser({ ...newUser, hardcodedOtp: e.target.value })}
                        maxLength={10}
                        data-testid="input-user-otp"
                      />
                      <p className="text-xs text-muted-foreground">
                        If set, this user will use this code instead of email OTP
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={addUserMutation.isPending}
                      data-testid="button-send-invitation"
                    >
                      {addUserMutation.isPending ? 'Adding...' : 'Add User'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Select Domain
                  </CardTitle>
                  <CardDescription>Choose a domain to manage its users</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                    <SelectTrigger className="w-full" data-testid="select-domain">
                      <SelectValue placeholder="Select a domain to manage" />
                    </SelectTrigger>
                    <SelectContent>
                      {domainInfo?.domains?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} - {d.adminEmail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {domainInfo?.domains?.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      No domains created yet. Go to Domain Management to create one.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!isSuperAdmin && domainInfo?.domain && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Domain Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Domain:</span>
                      <span className="ml-2 font-medium" data-testid="text-domain-name">{domainInfo.domain.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Admin:</span>
                      <span className="ml-2 font-medium">{domainInfo.domain.adminEmail}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Default OTP:</span>
                      <span className="ml-2 font-medium">
                        {domainInfo.domain.defaultOtp || 'Email OTP'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Users:</span>
                      <span className="ml-2 font-medium" data-testid="text-user-count">
                        {domainInfo.domain.userCount}
                        {domainInfo.domain.userQuota && (
                          <span className="text-muted-foreground"> / {domainInfo.domain.userQuota}</span>
                        )}
                      </span>
                    </div>
                    {domainInfo.domain.userQuota && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Quota Usage:</span>
                        <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              (domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.9 
                                ? 'bg-destructive' 
                                : (domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.7 
                                  ? 'bg-yellow-500' 
                                  : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, (domainInfo.domain.userCount / domainInfo.domain.userQuota) * 100)}%` }}
                          />
                        </div>
                        {(domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.9 && (
                          <p className="text-xs text-destructive mt-1">
                            Approaching user limit. Contact support to increase quota.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentDomainId && (
              <Card>
                <CardHeader>
                  <CardTitle>Domain Users</CardTitle>
                  <CardDescription>Users registered in {currentDomain?.name || 'this domain'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No users in this domain yet. Click "Invite User" to add someone.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>OTP</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                              {user.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                  <CheckCircle className="h-3 w-3" />
                                  Admin
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Standard</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.hardcodedOtp ? (
                                <span className="inline-flex items-center gap-1 text-sm font-mono">
                                  <Key className="h-3 w-3" />
                                  {user.hardcodedOtp}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Email OTP</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(`Remove user "${user.email}"?`)) {
                                      deleteUserMutation.mutate(user.id);
                                    }
                                  }}
                                  disabled={deleteUserMutation.isPending}
                                  data-testid={`button-delete-user-${user.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {!currentDomainId && isSuperAdmin && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select a domain above to manage its users
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.email}</DialogTitle>
            <DialogDescription>Update user settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select 
                value={editUser.role} 
                onValueChange={(value) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard User</SelectItem>
                  <SelectItem value="admin">Domain Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-otp">Hardcoded OTP (optional)</Label>
              <Input
                id="edit-otp"
                placeholder="6-digit code"
                value={editUser.hardcodedOtp}
                onChange={(e) => setEditUser({ ...editUser, hardcodedOtp: e.target.value })}
                maxLength={10}
                data-testid="input-edit-otp"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use email-based OTP
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit-user">
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
