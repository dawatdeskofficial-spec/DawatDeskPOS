<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Globe } from 'lucide-vue-next'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import DropdownMenuLabel from '@/components/ui/DropdownMenuLabel.vue'
import DropdownMenuSeparator from '@/components/ui/DropdownMenuSeparator.vue'
import { DropdownMenuTrigger } from 'radix-vue'

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' }
]

const currentLang = ref('en')

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  if (match) return match[2]
  return ''
}

onMounted(() => {
  const googtrans = getCookie('googtrans')
  if (googtrans) {
    const segment = googtrans.split('/').pop()
    if (segment) {
       const found = languages.find(l => l.code === segment)
       if(found) currentLang.value = segment
    }
  }
})

function changeLanguage(code: string) {
  if (code === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';'
  } else {
    document.cookie = `googtrans=/en/${code}; path=/;`
  }
  window.location.href = '/'
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button 
        class="h-9 px-3 flex items-center justify-center rounded-xl bg-card hover:bg-muted text-muted-foreground border border-border shadow-xs transition cursor-pointer"
        title="Change Language"
      >
        <Globe class="h-4 w-4" />
        <span class="ml-2 text-[11px] font-bold uppercase tracking-wider hidden sm:inline">{{ currentLang }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44 p-2 bg-card rounded-2xl shadow-xl">
      <DropdownMenuLabel class="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2 py-1.5">
        App Language
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        v-for="lang in languages" 
        :key="lang.code" 
        @click="changeLanguage(lang.code)"
        class="cursor-pointer font-bold text-xs flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition mb-1 last:mb-0"
      >
        <div class="flex items-center gap-2.5">
          <span class="text-base leading-none drop-shadow-sm">{{ lang.flag }}</span>
          <span>{{ lang.name }}</span>
        </div>
        <span v-if="currentLang === lang.code" class="text-primary text-[9px] font-black tracking-widest px-1.5 py-0.5 bg-primary/10 rounded uppercase">
          Active
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
