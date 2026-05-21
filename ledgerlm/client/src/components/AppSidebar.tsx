import {
  Home,
  Vault,
  Grid3x3,
  TrendingUp,
  Plus,
  ChevronDown,
  Search,
  LogOut,
  Settings,
  User,
  PanelLeftClose,
  Building2,
  Users,
  Shield,
  Bot,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { LuLayoutDashboard } from "react-icons/lu"
import { GoHomeFill } from "react-icons/go";
import { FaFolderClosed } from "react-icons/fa6";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthUser, clearAuthUser } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat } from "@shared/schema";

const menuItems = [
  {
    title: "Home",
    url: "/dashboard",
    icon: GoHomeFill,
  },
  {
    title: "Vault",
    url: "/vault",
    icon: FaFolderClosed,
  },
  {
    title: "Boards",
    url: "/boards",
    icon: LuLayoutDashboard,
  },
  // {
  //   title: "Market Intelligence",
  //   url: "/market-intelligence",
  //   icon: TrendingUp,
  // },
];

const adminMenuItems = [
  {
    title: "Enterprise Data",
    url: "/admin/enterprise",
    icon: Building2,
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Agentic Workflow",
    url: "/admin/agentic-workflow",
    icon: Bot,
  },
];

const superAdminMenuItems = [
  {
    title: "Domain Management",
    url: "/super-admin",
    icon: Shield,
  },
];

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: {
    id: string;
    name: string;
  };
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const [showAllChats, setShowAllChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingChat, setRenamingChat] = useState<Chat | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const currentUser = useAuthUser();
  const { toast } = useToast();
  const { data: chats, isLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
  });

  const { data: domainInfo } = useQuery<DomainInfo>({
    queryKey: ["/api/domain-admin/my-domain"],
    enabled: !!currentUser,
  });

  const isSuperAdmin = currentUser?.username?.toLowerCase() === 'customer@ledgerlm.ai';
  const isDomainAdmin = domainInfo?.isSuperAdmin || !!domainInfo?.domain;
  const hasAdminAccess = currentUser?.role === 'admin' || isDomainAdmin || isSuperAdmin;
  const isBoschUser = currentUser?.username?.toLowerCase().endsWith('@in.bosch.com') || 
                      currentUser?.username?.toLowerCase().endsWith('@bosch.com');

  const displayName = currentUser?.displayName || "User";
  const username = currentUser?.username || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    clearAuthUser();
    queryClient.clear();
    setLocation("/");
  };

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const chat = await apiRequest<Chat>("POST", "/api/chats", {
        title: "New Analysis",
        preview: "Configure your data sources to get started",
      });
      return chat;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setLocation(`/chat/${chat.id}?openDataSources=true`);
    },
    onError: (error) => {
      console.error("Chat creation failed:", error);
      toast({
        title: "Error",
        description: "Failed to create new analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renameChatMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const chat = await apiRequest<Chat>("PATCH", `/api/chats/${id}`, { title });
      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setRenameDialogOpen(false);
      setRenamingChat(null);
      setRenameValue("");
      toast({
        title: "Success",
        description: "Chat renamed successfully.",
      });
    },
    onError: (error) => {
      console.error("Chat rename failed:", error);
      toast({
        title: "Error",
        description: "Failed to rename chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/chats/${id}`);
      return id; // Return the id so we can check it in onSuccess
    },
    onSuccess: (deletedId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Success",
        description: "Chat deleted successfully.",
      });
      // Only redirect if we deleted the currently viewed chat
      if (location === `/chat/${deletedId}`) {
        setLocation("/dashboard");
      }
    },
    onError: (error) => {
      console.error("Chat deletion failed:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNewAnalysis = async () => {
    // Check if the most recent chat is empty (has 0 messages)
    if (chats && chats.length > 0) {
      const latestChat = chats[0];
      try {
        const data = await apiRequest<{ hasMessages: boolean; messageCount: number }>(
          "GET",
          `/api/chats/${latestChat.id}/has-messages`
        );
        if (!data.hasMessages) {
          // Reuse the existing empty chat
          setLocation(`/chat/${latestChat.id}?openDataSources=true`);
          return;
        }
      } catch (error) {
        console.error("Failed to check chat messages:", error);
      }
    }
    // Create a new chat
    createChatMutation.mutate();
  };

  const handleRenameChat = (chat: Chat) => {
    setRenamingChat(chat);
    setRenameValue(chat.title);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (renamingChat && renameValue.trim()) {
      renameChatMutation.mutate({ id: renamingChat.id, title: renameValue.trim() });
    }
  };

  const handleDeleteChat = (chat: Chat) => {
    if (confirm(`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`)) {
      deleteChatMutation.mutate(chat.id);
    }
  };

  const filteredChats = chats?.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4 bg-primary/10">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="flex items-center justify-center w-full" data-testid="button-toggle-sidebar">
                <img
                  src="/Images - Logo/PNGs/120px.png"
                  alt="LedgerLM Logo"
                  className="h-8 w-9"
                />
              </SidebarTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src="/Images - Logo/PNGs/120px.png"
                alt="LedgerLM Logo"
                className="h-8 w-9"
              />
              <span className="text-xl font-bold text-foreground">LedgerLM</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="h-6 w-6 p-0" data-testid="button-toggle-sidebar">
                  <PanelLeftClose className="h-4 w-4" />
                </SidebarTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Collapse sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-4 bg-primary/10">
        {isCollapsed ? (
          <div className="py-3 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10"
                  data-testid="button-search"
                >
                  <Search className="w-5 h-5 text-muted-foreground/60" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Search chats</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
              <Input
                type="search"
                placeholder="Search for chats..."
                className="h-9 text-sm pl-9 bg-white text-black"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-chats"
              />
            </div>
          </div>
        )}

        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location === item.url;
                const menuItem = (
                  <Link
                    href={item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white border border-border/50 shadow-sm"
                        : "hover-elevate"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 shrink-0 flex items-center justify-center ${
                        isActive ? "text-primary" : "text-muted-foreground/60"
                      }`}
                    >
                      <item.icon
                        className="w-5 h-5"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </div>
                    {!isCollapsed && (
                      <span
                        className={`text-sm flex-1 ${
                          isActive
                            ? "text-foreground font-medium"
                            : "text-muted-foreground/80 font-normal"
                        }`}
                      >
                        {item.title}
                      </span>
                    )}
                  </Link>
                );

                return (
                  <SidebarMenuItem key={item.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      menuItem
                    )}
                  </SidebarMenuItem>
                );
              })}
              {isBoschUser && (() => {
                const isActive = location === '/agentic-workflow';
                const menuItem = (
                  <Link
                    href="/agentic-workflow"
                    data-testid="link-agentic-workflow"
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white border border-border/50 shadow-sm"
                        : "hover-elevate"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 shrink-0 flex items-center justify-center ${
                        isActive ? "text-primary" : "text-muted-foreground/60"
                      }`}
                    >
                      <Bot className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {!isCollapsed && (
                      <span
                        className={`text-sm flex-1 ${
                          isActive
                            ? "text-foreground font-medium"
                            : "text-muted-foreground/80 font-normal"
                        }`}
                      >
                        Agentic Workflow
                      </span>
                    )}
                  </Link>
                );
                return (
                  <SidebarMenuItem key="agentic-workflow">
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Agentic Workflow</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      menuItem
                    )}
                  </SidebarMenuItem>
                );
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasAdminAccess && (
          <SidebarGroup className="px-0">
            {!isCollapsed && <SidebarGroupLabel className="text-sm font-bold text-black">Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {adminMenuItems.map((item) => {
                  const isActive = location === item.url;
                  const menuItem = (
                    <Link
                      href={item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-white border border-border/50 shadow-sm"
                          : "hover-elevate"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 shrink-0 flex items-center justify-center ${
                          isActive ? "text-primary" : "text-muted-foreground/60"
                        }`}
                      >
                        <item.icon
                          className="w-5 h-5"
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </div>
                      {!isCollapsed && (
                        <span
                          className={`text-sm flex-1 ${
                            isActive
                              ? "text-foreground font-medium"
                              : "text-muted-foreground/80 font-normal"
                          }`}
                        >
                          {item.title}
                        </span>
                      )}
                    </Link>
                  );

                  return (
                    <SidebarMenuItem key={item.title}>
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        menuItem
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup className="px-0">
            {!isCollapsed && <SidebarGroupLabel className="text-sm font-bold text-black">Super Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {superAdminMenuItems.map((item) => {
                  const isActive = location === item.url;
                  const menuItem = (
                    <Link
                      href={item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-white border border-border/50 shadow-sm"
                          : "hover-elevate"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 shrink-0 flex items-center justify-center ${
                          isActive ? "text-primary" : "text-muted-foreground/60"
                        }`}
                      >
                        <item.icon
                          className="w-5 h-5"
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </div>
                      {!isCollapsed && (
                        <span
                          className={`text-sm flex-1 ${
                            isActive
                              ? "text-foreground font-medium"
                              : "text-muted-foreground/80 font-normal"
                          }`}
                        >
                          {item.title}
                        </span>
                      )}
                    </Link>
                  );

                  return (
                    <SidebarMenuItem key={item.title}>
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        menuItem
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {!isCollapsed && (
          <SidebarGroup className="px-0 flex-1 flex flex-col overflow-hidden">
            <SidebarGroupLabel className="text-sm font-bold text-black flex-shrink-0">
              Recent Chats
            </SidebarGroupLabel>
            <SidebarGroupContent className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="py-2 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredChats.length > 0 ? (
                <>
                  <SidebarMenu>
                    {(showAllChats ? filteredChats : filteredChats.slice(0, 5)).map(
                      (chat, index) => (
                        <SidebarMenuItem key={chat.id} className="group/chat">
                          <div className="flex items-center w-full">
                            <SidebarMenuButton
                              asChild
                              isActive={location === `/chat/${chat.id}`}
                              className="flex-1 min-w-0"
                            >
                              <Link
                                href={`/chat/${chat.id}`}
                                data-testid={`link-chat-${index}`}
                              >
                                <span className="text-sm truncate">
                                  {chat.title}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover/chat:opacity-100 transition-opacity flex-shrink-0"
                                  data-testid={`button-chat-menu-${index}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => handleRenameChat(chat)}
                                  data-testid={`menu-item-rename-${index}`}
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteChat(chat)}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`menu-item-delete-${index}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </SidebarMenuItem>
                      ),
                    )}
                  </SidebarMenu>
                  {filteredChats.length > 5 && (
                    <div className="px-2 pt-2">
                      <button
                        onClick={() => setShowAllChats(!showAllChats)}
                        className="text-xs text-primary hover:underline cursor-pointer"
                        data-testid="link-view-all"
                      >
                        {showAllChats ? "View Less ←" : "View All →"}
                      </button>
                    </div>
                  )}
                </>
              ) : chats && chats.length > 0 ? (
                <div className="py-2 text-sm text-muted-foreground">
                  No chats found matching "{searchQuery}"
                </div>
              ) : (
                <div className="py-2 text-sm text-muted-foreground">
                  No chats yet
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-4 py-4 bg-primary/10">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNewAnalysis}
                  size="icon"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid="button-new-analysis"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>New Analysis</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="w-9 h-9 cursor-pointer hover-elevate" data-testid="button-user-profile">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {username}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-item-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <>
            <Button
              onClick={handleNewAnalysis}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-new-analysis"
            >
              New Analysis
              <Plus className="w-4 h-4 mr-2" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer mt-2 bg-white -top-2 relative"
                  data-testid="button-user-profile"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {username}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-item-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </SidebarFooter>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter chat name"
              data-testid="input-rename-chat"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={renameChatMutation.isPending || !renameValue.trim()}
              data-testid="button-confirm-rename"
            >
              {renameChatMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
