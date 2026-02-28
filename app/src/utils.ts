// React Native 标准fetch API请求（模拟流式响应）
// 注意：React Native 的 fetch polyfill 不支持真正的流式读取
// 我们使用分段处理文本的方式模拟流式效果
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
    'Authorization': `Bearer ${apiKey || 'sk-7bW8PnA4sv9mt7ipJsNzkDDtYSOYlb60kusyzJmqaTo52zld'}`,
    'Content-Type': 'application/json',
    ...headers
  }

  // 如果提供了 API key，使用它；否则使用默认值
  if (apiKey) {
    requestHeaders['Authorization'] = `Bearer ${apiKey}`
  }

  console.log('Request URL:', apiUrl)
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

    // 获取完整响应文本
    const fullText = await response.text()
    console.log('📝 Response received, length:', fullText.length)

    // 解析响应格式
    let content = ''

    // 检查是否是 SSE 格式 (data: {...})
    if (fullText.includes('data: ')) {
      console.log('📡 Detected SSE format')
      const lines = fullText.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6).trim()
        if (data === '[DONE]' || data === '') continue

        try {
          const parsed = JSON.parse(data)
          // 只提取 content，不要 reasoning_content（思维链）
          const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''

          if (delta) {
            content += delta
            if (onMessage) {
              // 构建模拟的流式数据
              onMessage({
                choices: [{
                  delta: { content: delta },
                  finish_reason: null
                }]
              })
            }
          }
        } catch (e: any) {
          // 忽略解析错误，但记录到日志
          console.log('⚠️ Parse skip:', data.substring(0, 50))
        }
      }
    }
    // 检查是否是 OpenAI 格式的流式响应
    else if (fullText.includes('"object":"chat.completion.chunk"')) {
      console.log('📡 Detected OpenAI streaming format')
      try {
        // 尝试解析为 NDJSON 格式
        const lines = fullText.split(/\r?\n/).filter(l => l.trim())
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            // 只提取 content，不要 reasoning_content
            const delta = parsed.choices?.[0]?.delta?.content || ''
            const finish_reason = parsed.choices?.[0]?.finish_reason

            if (delta) {
              content += delta
              if (onMessage) {
                onMessage({
                  choices: [{
                    delta: { content: delta },
                    finish_reason: finish_reason || null
                  }]
                })
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      } catch (e) {
        console.warn('Failed to parse OpenAI format')
      }
    }
    // 非流式响应 - 一次性返回完整结果
    else {
      console.log('📦 Non-streaming response detected')
      try {
        const parsed = JSON.parse(fullText)
        content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || ''

        // 模拟流式输出：逐字或逐词发送
        if (content && onMessage) {
          // 发送空的开始消息
          onMessage({
            choices: [{
              delta: { content: '' },
              finish_reason: null
            }]
          })

          // 按字符或小段模拟流式
          const chars = content.split('')
          for (let i = 0; i < chars.length; i++) {
            // 批量发送以提高性能（每10个字符发送一次）
            if (i % 10 === 0 || i === chars.length - 1) {
              const chunk = chars.slice(Math.max(0, i - 9), i + 1).join('')
              onMessage({
                choices: [{
                  delta: { content: chunk },
                  finish_reason: null
                }]
              })
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse response:', e)
      }
    }

    // 发送完成信号
    if (content && onMessage) {
      onMessage({
        choices: [{
          delta: { content: '' },
          finish_reason: 'stop'
        }]
      })
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