import { DOMAIN } from '../constants'
import { Model } from '../types'

// 检查是否支持ReadableStream
function supportsReadableStream(): boolean {
  try {
    return typeof ReadableStream !== 'undefined' &&
           typeof ReadableStream.prototype.getReader === 'function'
  } catch (e) {
    return false
  }
}

// 支持流式输出的fetch函数
export async function fetchStream({
  headers,
  body,
  type,
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
  type: string,
  apiKey?: string,
  onMessage?: (data: any) => void,
  onError?: (error: any) => void,
  onOpen?: () => void,
  onClose?: () => void,
  abortController?: AbortController | null,
  timeout?: number
}) {
  const apiUrl = `${DOMAIN}/chat/completions`

  // 构建请求头
  const requestHeaders: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers
  }

  // 如果提供了 API key，添加 Authorization header
  if (apiKey) {
    requestHeaders['Authorization'] = `Bearer ${apiKey}`
    console.log('✅ API Key added to headers:', apiKey.substring(0, 10) + '...')
  } else {
    console.log('❌ No API Key provided to fetchStream')
  }

  console.log('Request URL:', apiUrl)
  console.log('Request headers:', JSON.stringify(requestHeaders, null, 2))
  console.log('Timeout:', timeout, 'ms')

  try {
    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort('timeout'), timeout)

    // 合并两个信号源
    const combinedSignal = new AbortController()
    const signals = [controller.signal, abortController?.signal].filter(Boolean)
    if (signals.length > 0) {
      signals.forEach(signal => {
        signal.addEventListener('abort', () => combinedSignal.abort(signal.reason))
      })
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: combinedSignal.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    if (onOpen) onOpen()

    // 优先使用ReadableStream进行流式读取
    if (supportsReadableStream()) {
      console.log('✅ Using ReadableStream for streaming')
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log('✅ Stream complete')
            if (onClose) onClose()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                console.log('✅ Received [DONE]')
                if (onClose) onClose()
                return
              }
              try {
                const parsed = JSON.parse(data)
                console.log('📦 [fetchStream] 解析数据:', JSON.stringify(parsed, null, 2))
                if (onMessage) onMessage(parsed)
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
                console.log('原始数据:', data)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      console.log('⚠️ ReadableStream not supported, using text-based streaming')

      // Fallback: 读取完整响应然后按行分割模拟流式效果
      try {
        const text = await response.text()
        const lines = text.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data)
                console.log('📦 [fetchStream-fallback] 解析数据:', JSON.stringify(parsed, null, 2))
                if (onMessage) onMessage(parsed)
                // 模拟流式延迟
                await new Promise(resolve => setTimeout(resolve, 50))
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
                console.log('原始数据:', data)
              }
            }
          }
        }

        if (onClose) onClose()
      } catch (parseError) {
        throw new Error('Failed to parse response: ' + parseError)
      }
    }
  } catch (error) {
    console.error('Fetch stream error:', error)
    if (onError) onError(error)
    if (onClose) onClose()
  }
}

// 保持向后兼容的 EventSource 包装器
export function getEventSource({
  headers,
  body,
  type,
  apiKey
} : {
  headers?: any,
  body: any,
  type: string,
  apiKey?: string
}) {
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

export function getChatType(type: Model) {
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