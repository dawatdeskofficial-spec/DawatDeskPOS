import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, parseRole } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('@/views/Login.vue') },
  { path: '/admin/dashboard', component: () => import('@/views/admin/Dashboard.vue') },
  { path: '/admin/restaurants', component: () => import('@/views/admin/Restaurants.vue') },
  { path: '/admin/users', component: () => import('@/views/admin/Users.vue') },
  { path: '/admin/logs', component: () => import('@/views/admin/Logs.vue') },
  { path: '/admin/settings', component: () => import('@/views/admin/Settings.vue') },
  { path: '/admin/reports', component: () => import('@/views/restaurant/Reports.vue') },
  { path: '/restaurant/dashboard', component: () => import('@/views/restaurant/Dashboard.vue') },
  { path: '/restaurant/orders', component: () => import('@/views/restaurant/Orders.vue') },
  { path: '/restaurant/tables', component: () => import('@/views/restaurant/Tables.vue') },
  { path: '/restaurant/menu', component: () => import('@/views/restaurant/Menu.vue') },
  { path: '/restaurant/staff', component: () => import('@/views/restaurant/Staff.vue') },
  { path: '/restaurant/reports', component: () => import('@/views/restaurant/Reports.vue') },
  { path: '/restaurant/hotel', component: () => import('@/views/restaurant/Hotel.vue') },
  { path: '/waiter', component: () => import('@/views/waiter/index.vue') },
  { path: '/chef', component: () => import('@/views/chef/index.vue') },
  { path: '/cashier', component: () => import('@/views/cashier/index.vue') },
  { path: '/cashier/hotel', component: () => import('@/views/cashier/Hotel.vue') },
  { path: '/service-unavailable', component: () => import('@/views/ServiceUnavailable.vue') },
  { path: '/profile', component: () => import('@/views/Profile.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  if (auth.loading) {
    try {
      await auth.initAuth()
    } catch {
      auth.loading = false
    }
  }

  const role = auth.role || (auth.user?.role ? parseRole(auth.user.role) : null)

  // Compute destination home path for logged-in user
  let homePath: string | null = null
  if (role === 'main_admin') homePath = '/admin/dashboard'
  else if (role === 'restaurant_admin') homePath = '/restaurant/dashboard'
  else if (role) homePath = `/${role.split('_')[0]}`

  // 1. Authenticated user visiting login: forward to their home dashboard
  if (to.path === '/login' && auth.user) {
    if (homePath && homePath !== '/login') {
      return next(homePath)
    }
    // If role cannot be resolved, sign out to prevent infinite loop
    auth.signOut()
    return next()
  }

  // 2. Visiting root path '/'
  if (to.path === '/') {
    if (auth.user && homePath && homePath !== '/login') {
      return next(homePath)
    }
    return next('/login')
  }

  // 3. Unauthenticated user trying to access protected routes
  if (to.path !== '/login' && to.path !== '/service-unavailable' && !auth.user) {
    return next('/login')
  }

  // 4. Venue deactivation check for non-main-admin users
  if (auth.user && role !== 'main_admin' && to.path !== '/service-unavailable' && to.path !== '/login' && to.path !== '/profile') {
    const restObj = typeof auth.user.restaurantId === 'object' ? auth.user.restaurantId as any : null
    if (restObj && (restObj.status === 'INACTIVE' || restObj.status === 'CLOSED' || restObj.isActive === false)) {
      return next('/service-unavailable')
    }
  }

  // 5. Role-based access control: prevent non-main_admin from accessing /admin/* routes
  if (to.path.startsWith('/admin') && role !== 'main_admin') {
    return next(homePath || '/login')
  }

  // 6. Hotel Room Management module role check
  if (to.path === '/restaurant/hotel' && role !== 'main_admin' && role !== 'restaurant_admin') {
    return next(homePath || '/login')
  }
  if (to.path === '/cashier/hotel' && role !== 'cashier' && role !== 'restaurant_admin' && role !== 'main_admin') {
    return next(homePath || '/login')
  }

  return next()
})

export default router
