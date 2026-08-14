import { NavLink, useLocation } from 'react-router-dom'
import { Home, Users } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useMenu } from '@/hooks/useMenu'
import { usePublicSettings } from '@/hooks/usePublicSettings'
import { SupportContact } from '@/components/SupportContact'
import type { MenuItem } from '@/services/menuService'
import { resolveIcon } from '@/layouts/icon-map'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

// The API returns permission-filtered results already (see backend
// src/controllers/menu.controller.js) — a member with no module
// permissions gets back an empty menu, an admin gets the full tree.
// Nothing here re-filters by role; it just renders whatever came back.

function itemHref(item: MenuItem) {
  return `/${item.key}`
}

// Subtle blue-tinted highlight for the active item — the design system's
// "blue accent for active/primary states" applied without overriding the
// sidebar's neutral hover state everywhere else.
const activeItemClasses =
  'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary data-active:bg-primary/10 data-active:text-primary'

function MenuLink({ item, pathname }: { item: MenuItem; pathname: string }) {
  const Icon = resolveIcon(item.icon)
  const href = itemHref(item)
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  if (item.children.length > 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={item.label}
          className={cn(isActive && activeItemClasses)}
        >
          <Icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
        <SidebarMenuSub>
          {item.children.map((child) => {
            const childHref = itemHref(child)
            const childActive = pathname === childHref
            return (
              <SidebarMenuSubItem key={child.key}>
                <SidebarMenuSubButton
                  asChild
                  isActive={childActive}
                  className={cn(childActive && activeItemClasses)}
                >
                  <NavLink to={childHref}>{child.label}</NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.label}
        className={cn(isActive && activeItemClasses)}
      >
        <NavLink to={href}>
          <Icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { groups, status } = useMenu()
  const { appName } = usePublicSettings()
  const { pathname } = useLocation()
  const currentUser = useAuthStore((s) => s.user)

  const isDashboardActive = pathname === ROUTES.dashboard
  // Users management isn't a backend module (see CLAUDE.md — auth/users/
  // leads stay explicit mounts, not modules), so it's not driven by
  // GET /api/menu like Products/Sales. It's static core admin chrome,
  // gated client-side the same way the page itself is gated server-side.
  const canViewUsers = currentUser?.permissions.includes('users:read') ?? false
  const isUsersActive = pathname.startsWith(ROUTES.users)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <NavLink
          to={ROUTES.dashboard}
          className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
            S
          </div>
          {/* Collapses with the rest of the sidebar's labels — left as-is
              it overflows the icon-only rail and covers the trigger button
              in the topbar next to it (see AppSidebar collapsible fix). */}
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">{appName ?? 'Slokabase'}</span>
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {/* Static entry point back to the dashboard — not module-driven
            like the groups below, since the dashboard itself isn't a
            registered backend module. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isDashboardActive}
                  tooltip="Dashboard"
                  className={cn(isDashboardActive && activeItemClasses)}
                >
                  <NavLink to={ROUTES.dashboard}>
                    <Home />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canViewUsers && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isUsersActive}
                    tooltip="Users"
                    className={cn(isUsersActive && activeItemClasses)}
                  >
                    <NavLink to={ROUTES.users}>
                      <Users />
                      <span>Users</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {status === 'loading' && (
          <p className="text-muted-foreground px-4 py-2 text-sm">Loading menu…</p>
        )}
        {status === 'error' && (
          <p className="text-destructive px-4 py-2 text-sm">Couldn&apos;t load the menu.</p>
        )}
        {groups.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <MenuLink key={item.key} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SupportContact />
      </SidebarFooter>
    </Sidebar>
  )
}
