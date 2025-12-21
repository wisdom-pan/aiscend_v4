// React Native 标准fetch API请求（流式响应）
export async function fetchStream({
  headers,
  body,
  apiKey,
  onMessage,
  onError,
  onOpen,
  onClose,
  abortController,
  timeout = 300000
}: {
  headers?: any,
  body: any,
  apiKey?: string,
  onMessage?: (data: any) => void,
  onError?: (error: any) => void,
  onOpen?: () => void,
  onClose?: () => void,
  abortController?: AbortController | null,
  timeout?: number
}) {
  // 使用云端API地址
  const apiUrl = "https://yunwu.ai/v1/chat/completions"

  // 构建请求头
  const requestHeaders: any = {
    'Accept': body.stream ? 'text/event-stream' : 'application/json',
    'Authorization': `Bearer ${apiKey || 'sk-ORS9JAXURvGyG3PqAZ3GzsKv8KQ1wJaDjhNM1NOY6eMMx5uM'}`,
    'Content-Type': 'application/json',
    ...headers
  }

  // 如果提供了 API key，使用它；否则使用默认值
  if (apiKey) {
    requestHeaders['Authorization'] = `Bearer ${apiKey}`
    console.log('✅ API Key added to headers:', apiKey.substring(0, 10) + '...')
  } else {
    console.log('❌ No API Key provided, using default')
  }

  console.log('Request URL:', apiUrl)
  console.log('Request headers:', JSON.stringify(requestHeaders, null, 2))
  console.log('Timeout:', timeout, 'ms')
  console.log('Stream mode:', body.stream ? 'ENABLED' : 'DISABLED')

  if (onOpen) onOpen()

  // 使用 AbortController 控制超时
  const controller = abortController || new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
    if (onClose) onClose()
  }, timeout)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 流式处理响应
    if (body.stream) {
      console.log('🚀 Starting stream processing...')
      // 直接获取文本，不使用复杂的 Reader API
      const text = await response.text()
      console.log('📝 Raw response length:', text.length)

      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6).trim()
        if (data === '[DONE]' || data === '') continue

        // 只解析有效的JSON数据
        if (!/^[{\[]/.test(data)) {
          console.warn('⚠️ Skipping non-JSON:', data.substring(0, 50))
          continue
        }

        try {
          const parsed = JSON.parse(data)
          if (onMessage) onMessage(parsed)
        } catch (e: any) {
          console.error('❌ JSON parse error:', data.substring(0, 50), e.message)
        }
      }
    } else {
      // 非流式响应
      const data = await response.json()
      if (onMessage) onMessage(data)
    }

    clearTimeout(timeoutId)
    if (onClose) onClose()

  } catch (error: any) {
    console.error('Fetch error:', error)
    clearTimeout(timeoutId)
    if (onError) onError(error)
    if (onClose) onClose()
    throw error
  }
}

// 保持向后兼容的 EventSource 包装器
export function getEventSource() {
  console.warn('getEventSource is deprecated, use fetchStream instead')
  return null
}

export function getFirstNCharsOrLess(text:string, numChars:number = 1000) {
  if (text.length <= numChars) {
    return text;
  }
  return text.substring(0, numChars);
}

export function getFirstN({ messages, size = 10 } : { size?: number, messages: any[] }) {
  if (messages.length > size) {
    const firstN = new Array()
    for(let i = 0; i < size; i++) {
      firstN.push(messages[i])
    }
    return firstN
  } else {
    return messages
  }
}

export function getChatType(type: { label: string }) {
  if (type.label.includes('gpt')) {
    return 'completions'
  }
  if (type.label.includes('cohere')) {
    return 'cohere'
  }
  if (type.label.includes('mistral')) {
    return 'mistral'
  }
  if (type.label.includes('gemini')) {
    return 'gemini'
  }
  else return 'claude'
}