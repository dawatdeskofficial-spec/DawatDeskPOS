import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('@/views/Login.vue') },
  { path: '/admin/dashboard', component: () => import('@/views/admin/Dashboard.vue') },
  { path: '/admin/restaurants', component: () => import('@/views/admin/Restaurants.vue') },
  { path: '/admin/users', component: () => import('@/views/admin/Users.vue') },
  { path: '/admin/logs', component: () => import('@/views/admin/Logs.vue') },
  { path: '/admin/settings', component: () => import('@/views/admin/Settings.vue') },
  { path: '/restaurant/dashboard', component: () => import('@/views/restaurant/Dashboard.vue') },
  { path: '/restaurant/orders', component: () => import('@/views/restaurant/Orders.vue') },
  { path: '/restaurant/tables', component: () => import('@/views/restaurant/Tables.vue') },
  { path: '/restaurant/menu', component: () => import('@/views/restaurant/Menu.vue') },
  { path: '/restaurant/staff', component: () => import('@/views/restaurant/Staff.vue') },
  { path: '/waiter', component: () => import('@/views/waiter/index.vue') },
  { path: '/chef', component: () => import('@/views/chef/index.vue') },
  { path: '/cashier', component: () => import('@/views/cashier/index.vue') },
  { path: '/customer-ordering', component: () => import('@/views/customer-ordering/index.vue') },
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
    await auth.initAuth()
  }
  
  if (to.path !== '/login' && !auth.user) {
    next('/login')
  } else if (to.path === '/login' && auth.user) {
    let redirectPath = '/'
    const role = auth.role?.toLowerCase()
    if (role === 'main_admin') redirectPath = '/admin/dashboard'
    else if (role === 'restaurant_admin') redirectPath = '/restaurant/dashboard'
    else if (role) redirectPath = `/${role.split('_')[0]}`
    next(redirectPath)
  } else {
    next()
  }
})

export default router
