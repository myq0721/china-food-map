import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', name: 'home', component: () => import('@/pages/HomePage.vue') },
        { path: 'cities', name: 'cities', component: () => import('@/pages/CitiesPage.vue') },
        {
          path: 'cities/:city',
          name: 'city-detail',
          component: () => import('@/pages/CityDetailPage.vue'),
        },
        { path: 'cuisines', name: 'cuisines', component: () => import('@/pages/CuisinesPage.vue') },
        {
          path: 'cuisines/:slug',
          name: 'cuisine-detail',
          component: () => import('@/pages/CuisineDetailPage.vue'),
        },
        {
          path: 'r/:id',
          name: 'restaurant',
          component: () => import('@/pages/RestaurantDetailPage.vue'),
        },
        { path: 'about', name: 'about', component: () => import('@/pages/AboutPage.vue') },
        { path: 'guestbook', name: 'guestbook', component: () => import('@/pages/GuestbookPage.vue') },
        { path: 'submit', name: 'submit', component: () => import('@/pages/SubmitPage.vue') },
        { path: 'import', name: 'import', component: () => import('@/pages/ImportPage.vue') },
      ],
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
