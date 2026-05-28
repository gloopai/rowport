import {ref} from 'vue'

export function useAppFeedback({addLog, logContext}) {
  const message = ref('')
  const confirmDialogOpen = ref(false)
  const confirmDialog = ref({title: '', body: '', action: '确认'})
  let confirmResolve = null

  function setMessage(value, level = 'info', context = logContext()) {
    message.value = value
    addLog(level, value, context)
  }

  function askConfirm(title, body, action = '确认') {
    addLog('warn', 'Open confirmation dialog', logContext({title, action}))
    confirmDialog.value = {title, body, action}
    confirmDialogOpen.value = true
    return new Promise((resolve) => {
      confirmResolve = resolve
    })
  }

  function resolveConfirm(value) {
    confirmDialogOpen.value = false
    addLog(value ? 'warn' : 'debug', value ? 'Confirm dialog accepted' : 'Confirm dialog cancelled', logContext({title: confirmDialog.value.title}))
    if (confirmResolve) {
      confirmResolve(value)
      confirmResolve = null
    }
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(`${label}已复制`, 'success', logContext())
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'copy'}))
    }
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], {type})
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function errorMessage(error) {
    return error?.message || String(error)
  }

  return {
    message,
    confirmDialogOpen,
    confirmDialog,
    setMessage,
    askConfirm,
    resolveConfirm,
    copyText,
    downloadText,
    errorMessage
  }
}
