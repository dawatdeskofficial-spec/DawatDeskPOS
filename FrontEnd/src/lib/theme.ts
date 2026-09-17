import { ref } from 'vue'

export const isDarkMode = ref(false)

function checkDarkMode() {
  if (typeof document !== 'undefined') {
    isDarkMode.value = document.documentElement.classList.contains('dark')
  }
}

if (typeof window !== 'undefined') {
  // Initial check
  checkDarkMode()

  // Observe class changes on <html>
  const observer = new MutationObserver(() => {
    checkDarkMode()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // Also listen for system theme changes if no explicit storage
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      isDarkMode.value = e.matches
    }
  })
}

export function toggleDarkMode() {
  if (typeof document !== 'undefined') {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    isDarkMode.value = next
  }
}
